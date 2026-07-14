# tans server

Next.js (App Router) + tRPC + the native MongoDB driver. Backend for the
[tans](../) React Native app, talking to MongoDB Atlas.

## Why a backend at all

A React Native client can't (and mustn't) connect to Atlas directly — no driver
over TCP from a phone, and credentials can't ship in the client. The old
serverless options (Atlas App Services / Data API / Device Sync) are deprecated
(sunset ~Sept 2025), so the current path is a thin API service:

```
RN app  ──HTTPS──▶  this server (mongodb driver)  ──▶  Atlas
```

## Data model

Four collections (see [src/db/schema.ts](src/db/schema.ts) for the `$jsonSchema`
validators). Rule of thumb: **bounded + read-together → embed; unbounded → own
collection.**

| Collection        | Grain            | Notes                                                        |
|-------------------|------------------|-------------------------------------------------------------|
| `users`           | one per user     | embeds `solvedPuzzles`, `todoMeta`, `todos` (<=10)          |
| `habits`          | one per habit    | embeds `entries[]` + `missedDays[]` (same date grain)      |
| `eveningCheckIns` | one per user/day | own collection — unbounded, not tied to a habit            |
| `deletedTodos`    | append-only log  | own collection — unbounded audit trail                     |

Dates are `YYYY-MM-DD` **strings** (local day), never BSON `Date`, to preserve
the app's local-time semantics. All date-bearing inputs come from the client.

## Setup

1. Create a free Atlas cluster (M0). Add your IP to the access list and a DB user.
2. Create a Clerk app; grab the secret key (Dashboard → API keys).
3. `cp .env.local.example .env.local` and fill in `MONGODB_URI` + `CLERK_SECRET_KEY`.
4. `pnpm install`
5. `pnpm db:setup` — creates collections with validators + indexes (idempotent).
6. `pnpm dev` — serves on <http://localhost:4000>, tRPC at `/api/trpc`.

## Auth

Clerk. The Expo app sends the Clerk session token as `Authorization: Bearer
<token>`. [context.ts](src/server/context.ts) verifies it statelessly with
`verifyToken` (no round-trip to Clerk) and resolves `clerkId` → the Mongo user.
Two middlewares in [trpc.ts](src/server/trpc.ts):

- `authedProcedure` — valid token, user may not exist yet (gate for `bootstrap`).
- `protectedProcedure` — a provisioned Mongo user exists (`ctx.userId` non-null).

`user.bootstrap({ today })` find-or-creates the Mongo user for the verified
Clerk identity, fetching the email server-side from Clerk (never trusted from
the client), and returns the full hydration payload.

## Notes

- `db:setup` uses `bsonType: 'number'` (not `int`) for numeric fields — JS
  numbers serialize to BSON `double`, which an `int` validator would reject.
- Metro (the RN bundler) should not crawl `server/node_modules`; if it does, add
  this dir to the Metro `blockList`.
