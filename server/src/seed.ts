import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { DB_PATH, POKEMON_LIMIT } from './config.ts';
import { openDb } from './db.ts';

const API = 'https://pokeapi.co/api/v2';

// Only the PokeAPI fields we store.
export interface ApiPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number | null;
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
  types: { slot: number; type: { name: string } }[];
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PokeAPI ${res.status} ${res.statusText}: ${url}`);
  return res.json() as Promise<T>;
}

export function savePokemon(db: DatabaseSync, p: ApiPokemon) {
  db.prepare(
    // Upsert, not INSERT OR REPLACE: REPLACE deletes the row first, which breaks favorites pointing at it.
    `INSERT INTO pokemon (id, name, height, weight, base_experience, sprite, artwork, abilities, stats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, height = excluded.height, weight = excluded.weight,
       base_experience = excluded.base_experience, sprite = excluded.sprite, artwork = excluded.artwork,
       abilities = excluded.abilities, stats = excluded.stats`,
  ).run(
    p.id,
    p.name,
    p.height,
    p.weight,
    p.base_experience,
    p.sprites.front_default,
    p.sprites.other?.['official-artwork']?.front_default ?? null,
    JSON.stringify(p.abilities.map((a) => a.ability.name)),
    JSON.stringify(Object.fromEntries(p.stats.map((s) => [s.stat.name, s.base_stat]))),
  );
  db.prepare('DELETE FROM pokemon_types WHERE pokemon_id = ?').run(p.id);
  const insertType = db.prepare('INSERT INTO pokemon_types (pokemon_id, slot, type) VALUES (?, ?, ?)');
  for (const t of p.types) insertType.run(p.id, t.slot, t.type.name);
}

export async function seed(db: DatabaseSync, limit: number) {
  const list = await getJson<{ results: { url: string }[] }>(`${API}/pokemon?limit=${limit}`);
  const urls = list.results.map((r) => r.url);

  const pokemon: ApiPokemon[] = [];
  // ponytail: fixed batches of 10 keep PokeAPI happy; switch to a worker pool if seeding all ~1300 feels slow
  for (let i = 0; i < urls.length; i += 10) {
    pokemon.push(...(await Promise.all(urls.slice(i, i + 10).map((u) => getJson<ApiPokemon>(u)))));
  }

  // Fetch everything first, then write in one transaction: a failed fetch leaves the DB untouched.
  db.exec('BEGIN');
  try {
    for (const p of pokemon) savePokemon(db, p);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return pokemon.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = await seed(openDb(DB_PATH), POKEMON_LIMIT);
  console.log(`Seeded ${count} Pokémon into ${DB_PATH}`);
}
