# Pokédex

Fullstack Pokédex: search Pokémon by name and save favorites. A Node/Express REST API serves Pokémon from its own SQLite database, which is seeded from [PokeAPI](https://pokeapi.co/). The React frontend only talks to this API, never to PokeAPI directly.

## Requirements

- Node.js **22.18+** (24 recommended, see `.nvmrc`). The server runs TypeScript natively and uses Node's built-in SQLite, so there is no database to install.

## Run

```bash
npm install
npm run dev
```

On first start the server sees an empty database and seeds all the Pokémon from PokeAPI (a few seconds). Then open **http://localhost:5173**. The API runs on http://localhost:3001, and Vite proxies `/api` to it.

Other commands:

| Command | What it does |
|---|---|
| `npm run seed` | Re-fetch from PokeAPI and upsert into the DB |
| `npm test` | API tests (Node's built-in test runner, in-memory DB) |
| `npm run typecheck -w server` | TypeScript type check |

Environment variables (all optional):

| Variable | Default | |
|---|---|---|
| `PORT` | `3001` | API port |
| `DB_PATH` | `data/pokemon.db` | SQLite file, relative to `server/` |
| `POKEMON_LIMIT` | `1350` | How many Pokémon to seed (`1350` ≈ all) |

## API

### Pokémon

`GET /api/pokemon?search=&page=&limit=`

| Query | Default | |
|---|---|---|
| `search` | | Partial name match, case-insensitive |
| `page` | `1` | |
| `limit` | `20` | 1–100 |

```json
{
  "items": [{ "id": 4, "name": "charmander", "sprite": "https://…/4.png", "types": ["fire"] }],
  "total": 151,
  "page": 1,
  "limit": 20
}
```

### Users

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/login` | `{ "username", "password" }` | `201 { "id", "username" }` if the account was just created, `200` if it existed, `401` on a wrong password |

There is no separate sign-up: logging in with a new username creates the account.

`id` is a UUID. There are no sessions or tokens: the client keeps the `id` returned by login and uses it in the favorites URLs.

> Passwords are stored in plain text to keep the challenge simple. Don't reuse a real password.

### Favorites

| Method | Path | Response |
|---|---|---|
| `GET` | `/api/users/:userId/favorites` | Array of Pokémon, same shape as list `items` |
| `PUT` | `/api/users/:userId/favorites/:pokemonId` | `204` (adding twice is a no-op), `404` if the Pokémon is unknown |
| `DELETE` | `/api/users/:userId/favorites/:pokemonId` | `204` |

An unknown `userId` returns `404`.

Errors return `{ "error": "message" }` with status `400`, `401`, `404` or `500`.

## Architecture

```
server/src/
  index.ts     entry: open DB, seed if empty, listen
  app.ts       Express routes (createApp(db), so tests inject an in-memory DB)
  db.ts        SQLite connection + schema
  seed.ts      PokeAPI → DB import
  config.ts    env vars
client/        React + Vite frontend
```



## AI usage

### Tools

| Tool | Version | How I used it |
|---|---|---|
| Claude Code (CLI) | 2.1.301 | Pair-programming assistant in the terminal |
| Claude Opus 5.5 (`claude-opus-5-5`) | — | Model behind Claude Code |
| gstack `browse` (headless Chromium) | — | Scripted UI checks (login, search, favorites, scrolling, mobile width) |

I set the scope and made the product decisions, giving Claude Code one feature at a time. It wrote the implementation for each feature. I then reviewed the result, adjusted it, and decided the next step. In practice that covered:

- **Architecture:** I set the architecture, folder structure and stack: an npm-workspaces monorepo with a REST `server/` and a React `client/`. I used Claude to compare options against the challenge requirements before deciding.
- **Server and database:** Claude generated the Express API, SQLite schema and seed script from my specs. I then cut the API down to the scope I wanted and changed the seed size.
- **Tests:** Claude wrote all the automated tests (`server/src/app.test.ts`).
- **Frontend:** I defined the screens and behavior (one login/sign-up form with an auto-create notice, name search, favorites, infinite scroll), and Claude implemented them in React.
- **Docs:** Claude drafted the API reference in this README.

### Prompts

The main prompts, in order:

1. Shared the challenge requirements and asked for a recommended stack and architecture.
2. "Create the base project, and almost the complete server and database."
3. "Users may add Pokémon to favorites. Create a user with a unique identifier, the username and a password. Don't encrypt it, make it as simple as possible."
4. "Create the frontend. It only needs to search by Pokémon name and add to favorites. Create a login/signup screen with a disclaimer like 'If your user doesn't exist we'll create the account automatically'."
5. "Instead of pages, add a virtualized list with infinite scroll to avoid clicking for more Pokémon."

### Technical decisions

**Mine:**

- **Architecture, folder structure and stack:** an npm-workspaces monorepo (`server/` + `client/`) in fullstack TypeScript (Express + React/Vite), with Pokémon copied into our own SQLite database instead of proxying PokeAPI. I settled on this after reviewing the options Claude laid out, because PokeAPI can't search or filter and SQLite needs no setup from reviewers.
- **API scope:** name search and favorites only. I removed the type filter, the detail endpoint and `/api/types` from the generated server.
- **Full Pokédex:** seed all 1,350 Pokémon instead of the first 151 (`POKEMON_LIMIT`).
- **User model:** unique id, username and a plain-text password, as a deliberate simplification for the challenge.
- **Login UX:** a single form that creates the account if the username is new.
- **Infinite scroll:** a virtualized grid instead of pagination, once the full Pokédex was loaded.

**Suggested by Claude, accepted after review:**

- **Node built-ins:** Node's built-in SQLite and native TypeScript support, so the server needs no ORM and no build step.
- **Ids and sessions:** UUID user ids with no sessions; the client sends its id in the favorites URLs.
- **One login endpoint:** sign-up merged into `POST /api/login`, so a login is one request.
- **Virtualization library:** `@tanstack/react-virtual`.
- **Re-seeding:** upsert existing Pokémon so favorites survive a re-seed.

### Verification

- **API tests (written by Claude):** `npm test` runs against an in-memory database. It covers search, pagination, validation, login and auto-creation, favorites, and re-seeding without losing favorites.
- **Types and build:** `npm run typecheck` (both workspaces) and `npm run build`.
- **Real data:** seeded from the live PokeAPI and spot-checked the endpoints with `curl`.
- **Browser checks:**
  - Sign-up, wrong password and re-login.
  - Search and adding/removing favorites (confirmed in the database).
  - Infinite scroll through all 1,350 Pokémon, at desktop and phone widths.
  - No console errors.

  These checks caught two issues that were fixed before delivery: noisy `409` console errors on login, and long names stretching grid columns.
- **Hands-on changes:** I edited the generated server myself (the API scope and seed size above) and re-seeded the database.


## Bonus points

### With more time

- **React Query (TanStack Query) for API state:** caching, request deduplication, retries and infinite queries (`useInfiniteQuery`). This would also give one consistent place for loading, error and auth handling, replacing the hand-written fetch, debounce and stale-response logic in `Pokedex.tsx`.
- **Separate login and sign-up forms:** clearer intent and error messages, plus room for sign-up validation such as password rules and username availability.
- **Pokémon detail page:** stats, abilities, height and weight, artwork and evolutions, so the app is useful beyond a list. The database already stores most of this data.
- **A state manager** (e.g. Zustand) for session and favorites, instead of passing them down as props, so new screens don't need extra plumbing.
- **Host on AWS:** frontend on S3 + CloudFront; API as a Docker container on ECS Fargate or App Runner; database moved from SQLite to RDS PostgreSQL. CloudFront routes `/api/*` to the API, so there's still no CORS.
- **CI/CD and infrastructure as code:** GitHub Actions to test and deploy each part, with AWS CDK or Terraform for the infrastructure and secrets in Secrets Manager.
- **Split the monorepo** into `pokepedia-api` and `pokepedia-web` once they need separate teams or release schedules. That needs a shared API contract (OpenAPI-generated types), a `/api/v1` prefix so each side deploys independently, and a configurable API URL.
- **Production readiness:** hashed passwords with real sessions (or Cognito), rate limiting on login, a health-check endpoint, CloudWatch logs and alarms, and seeding as a one-off job instead of on server start.

### Time spent

**~1 hour** in total.

### Issues hit and how they were debugged

- **Build failed with `Rolldown failed to resolve import "react"`.** The type check passed, so the code was fine. Checking `client/package.json` showed that `react` and `react-dom` had never been saved to it, even though the install command reported success. Fixed by reinstalling them into the workspace.
- **Every Pokémon list request returned 500 after removing the type filter.** The validation `if` still referenced the deleted `type` variable, which throws a `ReferenceError` at runtime. Node runs the `.ts` files without type-checking them, so the error only appeared once a request came in. Fixed the condition. `npm run typecheck` catches this kind of leftover before running anything.
- **Red `409 Conflict` errors in the browser console on every login.** Found during browser testing. The client called sign-up first and fell back to login when the username existed. Fixed by making `POST /api/login` create unknown users, so a login is one request with no expected errors.
- **Re-seeding could break favorites.** The original seed used `INSERT OR REPLACE`, which deletes and re-inserts the row, so favorites pointing at that Pokémon would break. Switched to an upsert (`ON CONFLICT DO UPDATE`). A test re-seeds a Pokémon and asserts its favorites survive.
- **Long names stretched grid columns past the screen edge** (e.g. "Magearna-Original-Mega"). Found with screenshots after seeding the full Pokédex. A `1fr` grid column can't shrink below its content, so the columns use `minmax(0, 1fr)` and long names truncate with an ellipsis.
- **Node's built-in SQLite prints an `ExperimentalWarning` on every start.** Silenced with `--disable-warning=ExperimentalWarning` in the npm scripts.

### Scalability notes

- **Reads:** the Pokémon data only changes when re-seeded, so the list endpoint could send `Cache-Control`/`ETag` headers or sit behind a CDN, taking most of the load off the server.
- **Search:** `LIKE '%term%'` can't use an index and scans every row. That's fine for ~1,350 rows, but for a larger dataset I'd use SQLite FTS5 or a Postgres trigram index (`pg_trgm`).
- **Pagination:** `LIMIT/OFFSET` gets slower deeper into the list. Keyset pagination (`WHERE id > :lastId`) keeps every page equally fast, and fits infinite scroll well.
- **Database:** SQLite allows one writer at a time, which is enough for this read-heavy app on a single server. Running several API instances, or handling heavy write traffic on favorites, would mean moving to Postgres. The SQL is standard, so the migration is mostly the driver.
- **API servers:** the API keeps no state in memory, so it can run behind a load balancer as-is once the database is shared.
- **Auth:** the current model (plain-text passwords, user id in the URL) is a challenge-only simplification. A real system needs hashed passwords (`scrypt`/`argon2`), sessions or JWTs, and favorites routes based on the authenticated user instead of a URL parameter.
- **Frontend:** the virtualized grid keeps about 40 cards in the page no matter how many are loaded, and sprites are lazy-loaded with fixed dimensions. Scrolling stays smooth with the full Pokédex.

### Accessibility and responsive design

- **Labels:** every input has a label (a visible `<label>`, or `aria-label` on the search box).
- **Favorite buttons:** they use `aria-pressed` and a descriptive label ("Add Charizard to favorites"), not just a ★ icon.
- **Errors:** messages use `role="alert"` so screen readers announce them.
- **Tabs:** All and Favorites use `role="tab"` and `aria-selected`.
- **Keyboard:** everything works by keyboard, with a visible focus outline (`:focus-visible`).
- **Contrast:** type badge colors are darkened for white text. Dark mode follows the OS setting (`prefers-color-scheme`).
- **Images:** sprites are decorative (`alt=""`), since the name is right below. Fixed `width`/`height` prevent layout shift.
- **Responsive layout:** the grid computes its column count from the container width (6 on desktop, 2 on a phone), there's no horizontal scrolling at 375px, and the header drops the username on narrow screens.
- **Known gaps:**
  - The tabs don't support arrow-key navigation.
  - Screen readers only see the cards currently rendered by the virtualized list.
  - The result count isn't announced through an `aria-live` region.
