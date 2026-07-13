# Execution plan: wire the tans app to MongoDB via the server

**Status:** planned, not started.
**Decision already made:** fresh start — existing AsyncStorage data is NOT migrated. The server (MongoDB Atlas) becomes the single source of truth; the app becomes online-required for v2 (offline mode is explicitly future work).
**Prerequisites (already done):** Clerk auth on both sides; server verifies Bearer tokens in `server/src/server/context.ts`; `user.bootstrap` JIT-provisions the Mongo user by `clerkId`.

This document is written to be executed step-by-step by an engineer (or model) without further design decisions. Every store method is mapped to a tRPC procedure, every new server procedure is specified with its exact MongoDB operations, and §9 explains the MongoDB driver concepts used (read it first if the driver is new to you).

---

## 0. Architecture decision (do not revisit)

**Keep both store hook APIs exactly as they are** (`useHabitStore()`, `useTodoStore()` — same method names, same signatures, same derived getters). Only the persistence layer changes:

- **Hydration:** one `user.bootstrap` tRPC call after sign-in replaces AsyncStorage reads. The payload hydrates BOTH stores.
- **Mutations:** local `setState` stays (optimistic UI, unchanged code paths) and additionally fires the corresponding tRPC mutation. Two policies:
  - **Awaited** (block until server responds) for mutations that create server-generated IDs: `habits.add`, `todos.add`. The returned document (with its real Mongo `_id`) goes into local state — never invent a client-side ID for a server-owned document.
  - **Fire-and-forget optimistic** for everything else. On error: show an `Alert` and call `resync()` (re-runs bootstrap, replaces local state wholesale). No queues, no retries, no conflict resolution — simplest correct recovery.
- **AsyncStorage is removed from both stores entirely.** No debounced writes, no background flush, no `tans:state:v1` / `tans:todos:v1` keys. (One-time cleanup deletes the old keys, see §6.5.)
- **Vanilla `@trpc/client`** — NOT `@trpc/react-query`. The stores already manage state with `useState`; React Query would duplicate that and force a rewrite of `app/index.tsx`'s ~30 synchronous store-method call sites. Do not add React Query.

Why this shape: all the game logic (`isDayEarned`, `habitGraduationProgress`, `habitSlipped`, add-gating…) is pure functions over local state and stays byte-for-byte identical. Only ~2 files get rewritten internals and the UI barely changes.

---

## 1. Server: make `AppRouter` importable from the app (type-only)

The app needs `import type { AppRouter } from '../server/src/server/routers/_app'` for end-to-end typesafety. Type-only imports are erased at runtime (Metro never bundles server code) but **TypeScript must be able to resolve the whole import graph** — and the server files use the `@/` alias, which resolves differently in the root tsconfig (`@/*` → `./*`) than in the server tsconfig (`@/*` → `./src/*`). Root `tsc` would resolve `@/db/collections` to the wrong place.

**Fix: convert `@/` imports to relative imports in every file reachable from `AppRouter`'s type graph:**

| File | Change |
|---|---|
| `server/src/server/context.ts` | `@/db/collections` → `../db/collections` |
| `server/src/server/util.ts` | `@/db/collections` → `../db/collections` |
| `server/src/server/routers/user.ts` | `@/db/collections` → `../../db/collections` |
| `server/src/server/routers/habits.ts` | `@/db/collections` → `../../db/collections` |
| `server/src/server/routers/todos.ts` | `@/db/collections` → `../../db/collections` |

`server/src/server/clerk.ts`, `routers/_app.ts`, `routers/checkins.ts`, `db/collections.ts`, `db/client.ts` already use only relative imports — verify, don't assume. `server/src/app/api/trpc/[trpc]/route.ts` is NOT in the type graph (nothing the client imports reaches it); leave its `@/` imports alone.

Also **remove `"server"` from the root `tsconfig.json` `exclude` array? NO — keep it.** `exclude` only filters the `include` globs; files pulled in via an explicit import are still type-checked. That is exactly what we want: server files enter the root program only through the `AppRouter` import chain, with relative imports that resolve identically everywhere.

Note on `mongodb`/`zod`/`@trpc/server` types inside server files: TypeScript resolves those from `server/node_modules` (resolution walks up from the *importing file*), so the root app does not need them installed.

**Verify:** `pnpm exec tsc --noEmit` (root) and `pnpm --dir server exec tsc --noEmit` both pass after the import changes.

---

## 2. Server: new procedure `todos.runDailyMaintenance`

The daily rollover + stale-penalty logic currently lives only in `lib/todoStore.ts` (`runDailyMaintenance`). It must move server-side so the outcome persists. Add to `server/src/server/routers/todos.ts`:

```ts
// Idempotent daily maintenance, mirroring the client store's semantics:
//  1. new week  -> reset the weekly penalty counter
//  2. new day   -> clear completed items (rollover)
//  3. stale     -> charge one penalty piece per item >= 7 days old, once each
// `today`/`weekStart` come from the client (local-day semantics — the server
// clock is UTC and must never compute "today"). Read-modify-write on the one
// user doc: single-user data, no contention, so replacing the whole todos
// array in one $set is simpler and safer than three racing partial updates.
runDailyMaintenance: protectedProcedure
  .input(z.object({ today: zDate, weekStart: zDate }))
  .mutation(async ({ ctx, input }) => {
    const user = await ctx.cols.users.findOne({ _id: ctx.userId });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

    let { penaltyPieces, penaltyWeekStart, lastRollover, slotCount } = user.todoMeta;
    let todos = user.todos;

    if (penaltyWeekStart !== input.weekStart) {
      penaltyWeekStart = input.weekStart;
      penaltyPieces = 0;
    }
    if (lastRollover !== input.today) {
      todos = todos.filter((t) => t.status !== 'completed');
      lastRollover = input.today;
    }
    todos = todos.map((t) => {
      if (t.penaltyApplied) return t;
      if (daysBetween(t.createdAt, input.today) >= TODO_STALE_DAYS) {
        penaltyPieces += 1;
        return { ...t, penaltyApplied: true };
      }
      return t;
    });

    const todoMeta = { slotCount, lastRollover, penaltyPieces, penaltyWeekStart };
    await ctx.cols.users.updateOne({ _id: ctx.userId }, { $set: { todos, todoMeta } });
    return { todos, todoMeta };
  }),
```

Add to the same file (copy from `lib/todoStore.ts`, keep values identical):

```ts
const TODO_STALE_DAYS = 7;
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.floor((db - da) / 86400000);
}
```

Careful with `todoMeta`: `lastRollover` and `penaltyWeekStart` are optional in the schema — writing them once set is fine (validator allows them; pattern `YYYY-MM-DD`).

**The client will replace its local todo state with the returned `{ todos, todoMeta }`** — the server's answer is authoritative.

---

## 3. Server: new dev-only router

`components/DevMenu.tsx` (dev builds only, `__DEV__`-gated) calls `devFillWeek` / `devClearWeek` / `devTogglePuzzleSolved` / `devResetAll` on the habit store. These mutate state that now lives in Mongo, so they need server procedures. Create `server/src/server/routers/dev.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { zDate } from '../util';

// Dev-only helpers backing the in-app DevMenu (__DEV__ builds). Hard-disabled
// in production deployments.
const devProcedure = protectedProcedure.use(({ next }) => {
  if (process.env.NODE_ENV === 'production') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Dev endpoints are disabled in production.' });
  }
  return next();
});

export const devRouter = router({
  // Mark all 7 days of the week completed for every active habit.
  fillWeek: devProcedure
    .input(z.object({ days: z.array(zDate).length(7) }))
    .mutation(async ({ ctx, input }) => {
      const habits = await ctx.cols.habits
        .find({ userId: ctx.userId, active: true, graduatedAt: { $exists: false } })
        .toArray();
      for (const h of habits) {
        const others = h.entries.filter((e) => !input.days.includes(e.date));
        const filled = input.days.map((date) => ({ date, completed: true, reflection: '' }));
        await ctx.cols.habits.updateOne(
          { _id: h._id },
          { $set: { entries: [...others, ...filled] } },
        );
      }
      return { ok: true };
    }),

  // Remove all entries in the given week for every habit, and un-solve the puzzle.
  clearWeek: devProcedure
    .input(z.object({ days: z.array(zDate).length(7), weekStart: zDate }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateMany(
        { userId: ctx.userId },
        { $pull: { entries: { date: { $in: input.days } } } },
      );
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $unset: { [`solvedPuzzles.${input.weekStart}`]: '' } } as never,
      );
      return { ok: true };
    }),

  setPuzzleSolved: devProcedure
    .input(z.object({ weekStart: zDate, solved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        input.solved
          ? ({ $set: { [`solvedPuzzles.${input.weekStart}`]: true } } as never)
          : ({ $unset: { [`solvedPuzzles.${input.weekStart}`]: '' } } as never),
      );
      return { ok: true };
    }),

  // Wipe everything for this user back to a fresh account (keeps the user doc).
  resetAll: devProcedure.mutation(async ({ ctx }) => {
    await ctx.cols.habits.deleteMany({ userId: ctx.userId });
    await ctx.cols.eveningCheckIns.deleteMany({ userId: ctx.userId });
    await ctx.cols.deletedTodos.deleteMany({ userId: ctx.userId });
    await ctx.cols.users.updateOne(
      { _id: ctx.userId },
      {
        $set: {
          onboardingComplete: false,
          solvedPuzzles: {},
          todos: [],
          todoMeta: { slotCount: 5, penaltyPieces: 0 },
        },
      },
    );
    return { ok: true };
  }),
});
```

Register it in `server/src/server/routers/_app.ts`: `dev: devRouter`.

Note `fillWeek` takes the 7 `days` from the client rather than computing the week server-side — same reason as everywhere: the server never computes local dates.

---

## 4. Client: tRPC client setup

### 4.1 Dependency

In the **root** `package.json` add `@trpc/client` at the same major/minor as the server's `@trpc/server` (`^11.0.0`). Install with `pnpm add @trpc/client`. No transformer (the server's `initTRPC.create()` uses none — do not add superjson on one side only, it would break deserialization).

### 4.2 `lib/trpc.ts` (new file)

```ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { getClerkInstance } from '@clerk/expo';
import { TRPC_URL } from './api';
// Type-only import — erased at runtime; Metro never bundles server code.
import type { AppRouter } from '../server/src/server/routers/_app';

// Vanilla (non-React) client so the stores can call procedures imperatively.
// The Clerk session token is attached per-request via the singleton instance
// (hooks aren't available here). getToken() caches and refreshes internally.
export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      headers: async () => {
        const token = await getClerkInstance().session?.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
```

`lib/api.ts` already exists with `TRPC_URL` (base `EXPO_PUBLIC_API_URL`, default `http://localhost:4000`). **iOS simulator reaches the Mac's localhost directly — no change needed for dev. A physical device cannot**; for device testing set `EXPO_PUBLIC_API_URL=http://<mac-LAN-ip>:4000` in `.env`. Production builds bake in the Vercel URL.

### 4.3 `lib/bootstrap.ts` (new file) — shared hydration hook

`app/index.tsx` owns both store instances, so one hook fetches the world and feeds both:

```ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { trpc } from './trpc';
import { getToday } from './date';

export type BootstrapData = Awaited<ReturnType<typeof trpc.user.bootstrap.mutate>>;

// One "load my world" call per sign-in. Also the resync target after any
// failed optimistic mutation. status: 'loading' | 'error' | 'ready'.
export function useBootstrap() {
  const { isSignedIn } = useAuth();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await trpc.user.bootstrap.mutate({ today: getToday() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) load();
    else setData(null); // sign-out clears everything
  }, [isSignedIn, load]);

  return { data, error, reload: load };
}
```

The store hooks receive `data` (and `reload` as the resync callback) as parameters — see §5/§6.

---

## 5. Client: rewrite `lib/store.ts` internals

New signature: `useHabitStore(bootstrap: BootstrapData | null, resync: () => void)`. Everything exported stays; `hydrated` now means "bootstrap payload applied".

### 5.1 Hydration (replaces the AsyncStorage effect)

The server shape differs from `AppState` — entries and missed days are **embedded per habit** on the server and **flat arrays with `habitId`** on the client. Adapter (pure function, put it in the file):

```ts
function fromBootstrap(b: BootstrapData): AppState {
  return {
    habits: b.habits.map(({ entries, missedDays, ...h }) => h),
    dayEntries: b.habits.flatMap((h) =>
      h.entries.map((e) => ({ ...e, reflection: e.reflection ?? '', habitId: h.id })),
    ),
    missedDays: b.habits.flatMap((h) =>
      h.missedDays.map((m) => ({ ...m, habitId: h.id })),
    ),
    eveningCheckIns: b.checkins,
    weekReviews: [],            // legacy web-port field; server never stores it
    onboardingComplete: b.user.onboardingComplete,
    solvedPuzzles: b.user.solvedPuzzles,
  };
}
```

Effect: when the `bootstrap` param becomes non-null → `setState(fromBootstrap(bootstrap)); setHydrated(true);`. When it becomes null (sign-out) → `setState(defaultState); setHydrated(false);`.

Delete: `STORAGE_KEY`, `SCHEMA_VERSION`, `PersistedBlob`, the hydrate effect, `stateRef`, `flush`, both persistence effects, the `uuid()` helper, and the `AsyncStorage`/`RNAppState` imports.

### 5.2 Mutation mapping (exact table)

Every method keeps its optimistic local `setState` exactly as-is, plus the server call. `fire(p)` is a tiny helper: `p.catch(() => { Alert.alert('Sync failed', 'Reloading your data.'); resync(); })`.

| Store method | tRPC call | Policy / notes |
|---|---|---|
| `addHabit(name)` | `trpc.habits.add.mutate({ name, today })` | **Awaited.** Becomes `async`. On success, insert the returned habit DTO (drop its `entries`/`missedDays` — both empty) into `state.habits` and set `onboardingComplete: true`. Remove the local `uuid()` path entirely. Keep the client-side `MAX_ACTIVE_HABITS` guard. On error → Alert + resync. |
| `toggleDay(habitId, date)` | `trpc.habits.toggleDay.mutate({ habitId, date })` | Optimistic. Server mirrors the un-complete-clears-reflection rule. |
| `setReflection(habitId, date, reflection)` | `trpc.habits.setReflection.mutate({ habitId, date, reflection })` | Optimistic **and debounced 500 ms per (habitId, date)** — it fires on every keystroke of the reflection box. Keep a `useRef<Map<string, Timeout>>` keyed `habitId|date`; local setState immediate, server call debounced. |
| `saveEveningCheckIn(checkIn)` | `trpc.checkins.save.mutate(checkIn)` | Optimistic. Server upserts on (userId, date) — same replace-same-day semantics. |
| `saveMissedDay(entry)` | `trpc.habits.saveMissedDay.mutate(entry)` | Optimistic. `entry` already has `{habitId, date, kind, badge?, achievement?}` — matches input. |
| `deleteHabit(habitId)` | `trpc.habits.remove.mutate({ habitId })` | Optimistic. Server-side, entries/missedDays die with the habit doc (embedded); client also prunes its flat arrays — keep that code. |
| `editHabit(habitId, newName)` | `trpc.habits.rename.mutate({ habitId, name: newName })` | Optimistic. |
| `setHabitHoliday(habitId, days)` | `trpc.habits.setHoliday.mutate({ habitId, startDate: getToday(), days: clamped })` | Optimistic. Send the SAME clamped value used locally. |
| `clearHabitHoliday(habitId)` | `trpc.habits.clearHoliday.mutate({ habitId })` | Optimistic. |
| `markPuzzleSolved(weekStart)` | `trpc.user.markPuzzleSolved.mutate({ weekStart })` | Optimistic. |
| auto-graduate effect | `trpc.habits.graduate.mutate({ habitId, graduatedAt })` | Keep the effect; after the local flip, fire one `graduate` call per id with the same `getToday()` value written locally. Effect can't loop: flipped habits fail the `!h.graduatedAt` filter. |
| `devFillWeek()` | `trpc.dev.fillWeek.mutate({ days: getDaysOfWeek(currentWeekStart) })` | Optimistic (local code unchanged). |
| `devClearWeek()` | `trpc.dev.clearWeek.mutate({ days, weekStart: currentWeekStart })` | Optimistic. |
| `devTogglePuzzleSolved()` | `trpc.dev.setPuzzleSolved.mutate({ weekStart, solved })` | Compute `solved` = the NEW value the local toggle produced. |
| `devResetAll()` | `trpc.dev.resetAll.mutate()` | **Awaited**, then `resync()`. Drop the AsyncStorage removal. |

All pure getters (`isDayEarned`, `entryDone`, `isHabitWeekFull`, `habitGraduationProgress`, `habitSlipped`, `canAddNewHabit`, `addHabitBlockReason`, `getDayEntry`, `getEveningCheckIn`, `getLatestNextHabitIdea`, `getMissedDay`, `getWeekCompletionForHabit`, `isWeekComplete`, `isPuzzleSolved`, `isHabitPausedOn`, `getHabitHolidayInfo`) — **unchanged, byte for byte**.

`getLatestNextHabitIdea` stays local (computed over hydrated check-ins); the server's `checkins.latestNextHabitIdea` exists but is redundant — don't call it.

### 5.3 ID semantics change

Habit ids are now Mongo `ObjectId` hex strings (24 chars) instead of UUIDs. Nothing in the app parses id formats — verify with a grep for `uuid` outside the stores; expected: no usages.

---

## 6. Client: rewrite `lib/todoStore.ts` internals

New signature: `useTodoStore(bootstrap: BootstrapData | null, resync: () => void)`.

### 6.1 Hydration

```ts
function fromBootstrap(b: BootstrapData): TodoState {
  return {
    items: b.user.todos,
    deleted: [],                       // audit log is server-only now (deletedTodos collection)
    slotCount: b.user.todoMeta.slotCount,
    lastRollover: b.user.todoMeta.lastRollover,
    penaltyPieces: b.user.todoMeta.penaltyPieces,
    penaltyWeekStart: b.user.todoMeta.penaltyWeekStart,
  };
}
```

`TodoSub` (server) and `TodoItem` (client) are structurally identical — no mapping needed. The client-side `deleted` array is dead weight now; keep the field (type stability) but it stays empty. Check `components/TodoList.tsx` + `DeleteTodoSheet.tsx` for any read of `state.deleted` — expected: none.

### 6.2 Daily maintenance moves server-side

Replace the body of `runDailyMaintenance` with:

```ts
const res = await trpc.todos.runDailyMaintenance.mutate({ today, weekStart: week });
setState((prev) => ({ ...prev, items: res.todos, ...metaOf(res.todoMeta) }));
```

Still triggered by the same `useEffect` once hydrated. The server response is authoritative — replace, don't merge. Keep the "only after hydration" guard for the same reason as before (don't run against nothing).

### 6.3 Mutation mapping

| Store method | tRPC call | Policy |
|---|---|---|
| `addItem(text)` | `trpc.todos.add.mutate({ text, today })` | **Awaited**; push the returned item (server-generated id). Keep the local slot-count guard. |
| `setItemText(id, text)` | `trpc.todos.setText.mutate({ id, text })` | Optimistic + **debounced 500 ms per id** (fires per keystroke in the slot inputs). |
| `cycleStatus(id)` | `trpc.todos.cycleStatus.mutate({ id, today })` | Optimistic. Server computes the same open→started→completed→open cycle + history append. |
| `deleteItem(id, reason)` | `trpc.todos.remove.mutate({ id, reason, today })` | Optimistic. Keep the client `TODO_DELETE_MIN_CHARS` guard (server enforces `min(20)` too). Local `deleted` push can be dropped. |

`staleAgeDays` and the `penaltyPieces` derived getter: unchanged.

### 6.4 Deletions

Same as store.ts: remove AsyncStorage, RNAppState, flush/debounce persistence, `uuid()`, `PersistedBlob`, `STORAGE_KEY`.

### 6.5 One-time cleanup of the old local data

In `app/_layout.tsx`'s mount effect, fire-and-forget:

```ts
AsyncStorage.multiRemove(['tans:state:v1', 'tans:todos:v1']).catch(() => {});
```

Leave `@react-native-async-storage/async-storage` installed (Clerk's token cache machinery and this cleanup still touch storage).

---

## 7. Client: `app/index.tsx` wiring

1. `const boot = useBootstrap();` then `useHabitStore(boot.data, boot.reload)` / `useTodoStore(boot.data, boot.reload)`.
2. After the existing auth gate (`!authLoaded` → null, `!isSignedIn` → `<SignInScreen />`), add a **data gate**:
   - `boot.error` → small centered error view: "Couldn’t reach the server." + a retry `Pressable` calling `boot.reload()` (style with existing theme constants; typographic apostrophe — lint rule).
   - `!store.hydrated` → centered `<ActivityIndicator color={colors.primary} />` on `colors.background`.
3. `DevMenu`: check its props — if it only receives the store object, no change; if it calls removed helpers, align names.
4. Everything else in the component tree is untouched (same store API).

---

## 8. Execution order & verification

Work in this order; each step leaves the tree compiling:

1. §1 server relative imports → both typechecks pass.
2. §2 + §3 new server procedures + router registration → server typecheck.
3. §4 client dep + `lib/trpc.ts` + `lib/bootstrap.ts` → root typecheck.
4. §5 store.ts rewrite. 5. §6 todoStore.ts rewrite. 6. §7 index.tsx + _layout cleanup.
7. `pnpm exec tsc --noEmit` && `pnpm run lint` && `pnpm --dir server exec tsc --noEmit`.
8. Manual E2E (server running: `pnpm --dir server dev`; Atlas env in `server/.env.local`; `pnpm --dir server db:setup` run once):
   - Sign in → app shows empty fresh state (old local data gone).
   - Add a habit → appears; check Atlas (`habits` collection has a doc with your `userId`).
   - Toggle today → `entries` array on the habit doc updates.
   - Type a reflection → after ~1 s the entry's `reflection` field updates (debounce works).
   - Add a to-do, cycle it, delete it with a ≥20-char reason → `deletedTodos` gets an audit doc.
   - Force-quit the app, relaunch → same data returns (now from Mongo, not disk).
   - Kill the server, relaunch app → error screen with retry; restart server, tap retry → recovers.
9. Update `CLAUDE.md`: persistence-model section (AsyncStorage → server), new commands, online-required note.

---

## 9. MongoDB driver primer (what this codebase uses and why)

Read alongside the files — every concept below is live in this repo.

**Connection (`server/src/db/client.ts`).** `new MongoClient(uri).connect()` opens a **connection pool** (default ~100 sockets), not a single connection. You create ONE client per process and share it. The `globalThis._mongoClientPromise` trick exists because Next.js dev-mode hot-reload re-evaluates modules on every edit — without stashing the promise globally, each edit would leak a new pool and exhaust Atlas's connection limit. In production the module evaluates once, so a plain module-level client is fine.

**Databases and collections (`server/src/db/collections.ts`).** `client.db(name).collection<T>('name')` returns lightweight handles — no I/O happens until you run an operation. The generic `<UserDoc>` is a **compile-time-only** contract: the driver types your queries/updates against it but validates nothing at runtime (that's what the `$jsonSchema` validators are for). Documents are declared **without `_id`**; the driver's `WithId<T>` adds `_id: ObjectId` on reads, and `insertOne` auto-generates it on writes.

**ObjectId.** Mongo's native 12-byte id (24-char hex when stringified) — embeds a timestamp, so ids sort roughly by creation time. Over the wire we always convert to strings (`habitDTO` etc. do `_id.toString()`); incoming id strings are wrapped back with `new ObjectId(str)`. `ObjectId.isValid(str)` guards malformed input. Note two id styles coexist deliberately: top-level docs (habits, users) use ObjectId; **embedded** to-dos use string UUIDs (`util.ts#uuid`) because embedded array elements don't get `_id`s automatically.

**Update operators — the heart of the driver.** You almost never rewrite a whole document; you describe a partial change:
- `$set` / `$unset` — set or delete fields. Dotted paths reach into nested docs and arrays: `{ $set: { 'todoMeta.slotCount': 5 } }`, computed keys for map fields: `` { $set: { [`solvedPuzzles.${weekStart}`]: true } } `` (`user.ts`).
- `$push` / `$pull` — append to / remove-matching-from an embedded array: `{ $push: { todos: item } }`, `{ $pull: { entries: { date: { $in: days } } } }`.
- **Positional `$`** — updates the array element matched by the *query*: filter `{ 'entries.date': date }` + update `{ $set: { 'entries.$.completed': true } }` edits exactly that entry (`habits.toggleDay`, `todos.setText`). One element per operation.
- `$setOnInsert` — fields applied only when an **upsert** creates the doc (see next).

**Upserts and `findOneAndUpdate` (`user.bootstrap`).** `updateOne(filter, update, { upsert: true })` = update if a doc matches, insert otherwise — how `checkins.save` gets one-checkin-per-day for free (filter on `{userId, date}`). `findOneAndUpdate(..., { returnDocument: 'after' })` additionally returns the resulting doc atomically — the find-or-create in `bootstrap` uses it so concurrent first requests can't create two users (the unique `clerkId` index backs that up).

**Reads.** `findOne(filter)`, or `find(filter)` returning a **cursor**: chain `.sort({ date: 1 })`, `.limit(1)`, then `.toArray()` (materialize all) or `.next()` (first row). `countDocuments(filter)` for counts (`habits.add`'s cap check).

**Indexes (`server/src/db/setup.ts`).** `createIndex({ userId: 1 })` makes per-user queries O(log n) instead of collection scans; `{ unique: true }` (on `clerkId`, `email`, and the compound `{userId, date}` for check-ins) turns duplicates into write errors — uniqueness is enforced by the index, not application code. `createIndex` is idempotent, hence the re-runnable setup script.

**Schema validation (`server/src/db/schema.ts`).** Optional per-collection `$jsonSchema` the server checks on writes (`validationLevel: 'moderate'` = only validates inserts and updates to already-valid docs). Defense-in-depth behind zod. **The gotcha baked into this repo:** JS numbers serialize to BSON `double`, so a validator demanding `bsonType: 'int'` rejects every number the driver writes — that's why every numeric field says `bsonType: 'number'` (the any-numeric alias) and integer-ness lives in zod instead.

**Modeling rationale (`schema.ts` header).** Embed what's bounded and always read together (entries/missedDays inside habits; ≤10 todos inside users) — one read fetches everything, one positional update edits a day. Split what's unbounded or independently queried into collections (`eveningCheckIns`: one/day forever; `deletedTodos`: append-only log). This "embed vs reference" call is THE core MongoDB design skill.

**What this repo deliberately does NOT use** (know they exist): aggregation pipelines (`.aggregate([...])` — server-side transforms/joins; our per-user data is small enough to compute in JS), transactions (multi-doc atomicity; single-doc updates are already atomic, which the embedded design exploits), and change streams (real-time watch; a future sync feature would start there).

---

## Out of scope (explicitly)

- Offline support / mutation queueing / conflict resolution — future work; v2 is online-required.
- Migrating existing AsyncStorage data — fresh start was accepted; old keys are deleted (§6.5).
- Settings screen, notification-time sync, `weekReviews` (legacy field stays client-side and empty).
- Moving game-rule derivations (graduation, gating) server-side — they stay client-side pure functions; the server persists outcomes only.
