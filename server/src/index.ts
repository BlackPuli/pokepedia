import { createApp } from './app.ts';
import { DB_PATH, POKEMON_LIMIT, PORT } from './config.ts';
import { openDb } from './db.ts';
import { seed } from './seed.ts';

const db = openDb(DB_PATH);

const { count } = db.prepare('SELECT COUNT(*) AS count FROM pokemon').get() as { count: number };
if (count === 0) {
  console.log(`Empty database, seeding ${POKEMON_LIMIT} Pokémon from PokeAPI...`);
  console.log(`Seeded ${await seed(db, POKEMON_LIMIT)} Pokémon`);
}

createApp(db).listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
