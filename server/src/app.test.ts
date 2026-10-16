import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { savePokemon } from './seed.ts';
import type { ApiPokemon } from './seed.ts';

const fixture = (id: number, name: string, types: string[]): ApiPokemon => ({
  id,
  name,
  height: 4,
  weight: 60,
  base_experience: 112,
  sprites: { front_default: `${name}.png`, other: { 'official-artwork': { front_default: `${name}-art.png` } } },
  types: types.map((t, i) => ({ slot: i + 1, type: { name: t } })),
  abilities: [{ ability: { name: 'static' } }],
  stats: [{ base_stat: 35, stat: { name: 'hp' } }],
});

const db = openDb(':memory:');
savePokemon(db, fixture(1, 'bulbasaur', ['grass', 'poison']));
savePokemon(db, fixture(25, 'pikachu', ['electric']));
savePokemon(db, fixture(26, 'raichu', ['electric']));
savePokemon(db, fixture(25, 'pikachu', ['electric'])); // re-seed must not duplicate types

const server = createApp(db).listen(0);
await once(server, 'listening');
after(() => server.close());
const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
const request = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const get = (path: string) => request('GET', path);
const names = (items: { name: string }[]) => items.map((p) => p.name);

test('lists pokemon ordered by id with total', async () => {
  const { body } = await get('/pokemon');
  assert.equal(body.total, 3);
  assert.deepEqual(names(body.items), ['bulbasaur', 'pikachu', 'raichu']);
  assert.deepEqual(body.items[0], { id: 1, name: 'bulbasaur', sprite: 'bulbasaur.png', types: ['grass', 'poison'] });
});

test('searches and paginates', async () => {
  assert.deepEqual(names((await get('/pokemon?search=CHU')).body.items), ['pikachu', 'raichu']);
  const page2 = (await get('/pokemon?limit=1&page=2')).body;
  assert.equal(page2.total, 3);
  assert.deepEqual(names(page2.items), ['pikachu']);
});

test('rejects invalid query params', async () => {
  assert.equal((await get('/pokemon?limit=0')).status, 400);
  assert.equal((await get('/pokemon?page=abc')).status, 400);
  assert.equal((await get('/pokemon?search=a&search=b')).status, 400);
});

test('login creates the account on first use, then checks the password', async () => {
  const created = await request('POST', '/login', { username: ' ash ', password: 'pikachu' });
  assert.equal(created.status, 201);
  assert.equal(created.body.username, 'ash');
  assert.match(created.body.id, /^[0-9a-f-]{36}$/);

  const again = await request('POST', '/login', { username: 'ash', password: 'pikachu' });
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, created.body);

  assert.equal((await request('POST', '/login', { username: 'ash', password: 'wrong' })).status, 401);
  assert.equal((await request('POST', '/login', { username: 'misty' })).status, 400);
});

test('adds, lists and removes favorites', async () => {
  const { id } = (await request('POST', '/login', { username: 'brock', password: 'onix' })).body;
  const favs = `/users/${id}/favorites`;

  assert.equal((await request('PUT', `${favs}/26`)).status, 204);
  assert.equal((await request('PUT', `${favs}/1`)).status, 204);
  assert.equal((await request('PUT', `${favs}/1`)).status, 204); // idempotent
  assert.equal((await request('PUT', `${favs}/999`)).status, 404);
  assert.deepEqual(names((await get(favs)).body), ['bulbasaur', 'raichu']);

  savePokemon(db, fixture(1, 'bulbasaur', ['grass', 'poison'])); // re-seed keeps favorites
  assert.equal((await get(favs)).body.length, 2);

  assert.equal((await request('DELETE', `${favs}/1`)).status, 204);
  assert.deepEqual(names((await get(favs)).body), ['raichu']);

  assert.equal((await get('/users/nope/favorites')).status, 404);
});

test('malformed JSON body is a 400, not a 500', async () => {
  const res = await fetch(`${base}/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(res.status, 400);
});
