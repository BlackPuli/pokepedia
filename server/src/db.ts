import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pokemon (
      id              INTEGER PRIMARY KEY,
      name            TEXT    NOT NULL UNIQUE,
      height          INTEGER NOT NULL,  -- decimetres
      weight          INTEGER NOT NULL,  -- hectograms
      base_experience INTEGER,
      sprite          TEXT,
      artwork         TEXT,
      abilities       TEXT    NOT NULL,  -- JSON array of ability names
      stats           TEXT    NOT NULL   -- JSON object: { "hp": 35, "attack": 55, ... }
    );

    CREATE TABLE IF NOT EXISTS pokemon_types (
      pokemon_id INTEGER NOT NULL REFERENCES pokemon(id) ON DELETE CASCADE,
      slot       INTEGER NOT NULL,
      type       TEXT    NOT NULL,
      PRIMARY KEY (pokemon_id, slot)
    );

    CREATE INDEX IF NOT EXISTS idx_pokemon_types_type ON pokemon_types(type);

    CREATE TABLE IF NOT EXISTS users (
      id       TEXT PRIMARY KEY,  -- crypto.randomUUID()
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL      -- ponytail: plain text by request; hash with crypto.scrypt before any real use
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pokemon_id INTEGER NOT NULL REFERENCES pokemon(id),
      PRIMARY KEY (user_id, pokemon_id)
    );
  `);
  return db;
}
