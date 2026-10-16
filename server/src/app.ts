import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

// Types as a JSON array ordered by slot, e.g. '["grass","poison"]'.
const TYPES_SQL = `(SELECT json_group_array(type) FROM
  (SELECT type FROM pokemon_types t WHERE t.pokemon_id = p.id ORDER BY slot)) AS types`;

// Returns null when the value is present but invalid.
function intParam(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function strParam(value: unknown) {
  if (value === undefined) return '';
  return typeof value === 'string' ? value.trim() : null;
}

// Body must be { username, password } with non-empty strings; returns null otherwise.
function credentials(body: unknown) {
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) return null;
  return { username: username.trim(), password };
}

const withTypes = (r: { types: string }) => ({ ...r, types: JSON.parse(r.types) as string[] });

export function createApp(db: DatabaseSync) {
  const app = express();
  app.use(express.json());

  // GET /api/pokemon?search=pika&page=1&limit=20
  app.get('/api/pokemon', (req, res) => {
    const search = strParam(req.query.search);
    const page = intParam(req.query.page, 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = intParam(req.query.limit, 20, 1, 100);
    if (search === null || page === null || limit === null) {
      res.status(400).json({ error: 'Invalid query: search must be a string, page >= 1, limit 1-100' });
      return;
    }

    const where: string[] = [];
    const params: string[] = [];
    if (search) {
      where.push('p.name LIKE ?'); // LIKE is case-insensitive for ASCII in SQLite
      params.push(`%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM pokemon p ${whereSql}`).get(...params) as {
      total: number;
    };
    const rows = db
      .prepare(`SELECT p.id, p.name, p.sprite, ${TYPES_SQL} FROM pokemon p ${whereSql} ORDER BY p.id LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit) as { types: string }[];

    res.json({ items: rows.map(withTypes), total, page, limit });
  });

  // POST /api/login { username, password } -> { id, username }
  // Logs in, or creates the account when the username is new (201). Wrong password for an existing user -> 401.
  // ponytail: no sessions/tokens; the client keeps the returned id and uses it in favorites URLs.
  app.post('/api/login', (req, res) => {
    const creds = credentials(req.body);
    if (!creds) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }
    // DO NOTHING on an existing username, so concurrent sign-ups can't race into a 500.
    const { changes } = db
      .prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?) ON CONFLICT(username) DO NOTHING')
      .run(randomUUID(), creds.username, creds.password);
    const user = db
      .prepare('SELECT id, username FROM users WHERE username = ? AND password = ?')
      .get(creds.username, creds.password);
    if (!user) {
      res.status(401).json({ error: 'Wrong password for this username' });
      return;
    }
    res.status(changes ? 201 : 200).json(user);
  });

  // Every /api/users/:userId/... route 404s for unknown users.
  app.param('userId', (req, res, next, userId: string) => {
    if (db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) next();
    else res.status(404).json({ error: 'User not found' });
  });

  app.get('/api/users/:userId/favorites', (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.sprite, ${TYPES_SQL}
         FROM favorites f JOIN pokemon p ON p.id = f.pokemon_id
         WHERE f.user_id = ? ORDER BY p.id`,
      )
      .all(req.params.userId) as { types: string }[];
    res.json(rows.map(withTypes));
  });

  // Idempotent: adding an existing favorite is a no-op.
  app.put('/api/users/:userId/favorites/:pokemonId', (req, res) => {
    if (!db.prepare('SELECT 1 FROM pokemon WHERE id = ?').get(req.params.pokemonId)) {
      res.status(404).json({ error: 'Pokémon not found' });
      return;
    }
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, pokemon_id) VALUES (?, ?)').run(
      req.params.userId,
      req.params.pokemonId,
    );
    res.status(204).end();
  });

  app.delete('/api/users/:userId/favorites/:pokemonId', (req, res) => {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND pokemon_id = ?').run(req.params.userId, req.params.pokemonId);
    res.status(204).end();
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Express sets status on client errors such as malformed JSON bodies.
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
  });

  return app;
}
