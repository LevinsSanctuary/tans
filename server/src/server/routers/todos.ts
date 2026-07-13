import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { uuid, zDate } from '../util';
import type { TodoSub } from '../../db/collections';

// Mirrored from lib/todoStore.ts — keep these identical to the client values.
const TODO_STALE_DAYS = 7;
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.floor((db - da) / 86400000);
}

// To-dos live embedded on the user doc (bounded by slotCount, <=10). The
// deleted-todo audit log is the unbounded part and lives in its own collection.
export const todosRouter = router({
  add: protectedProcedure
    .input(z.object({ text: z.string().max(200), today: zDate }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.cols.users.findOne({ _id: ctx.userId });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      if (user.todos.length >= user.todoMeta.slotCount) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'No free to-do slots.' });
      }
      const item: TodoSub = {
        id: uuid(),
        text: input.text,
        status: 'open',
        createdAt: input.today,
        history: [],
      };
      await ctx.cols.users.updateOne({ _id: ctx.userId }, { $push: { todos: item } });
      return item;
    }),

  setText: protectedProcedure
    .input(z.object({ id: z.string(), text: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.users.updateOne(
        { _id: ctx.userId, 'todos.id': input.id } as never,
        { $set: { 'todos.$.text': input.text } } as never,
      );
      return { ok: true };
    }),

  // open -> started -> completed -> open. Stamps completedAt and appends history.
  cycleStatus: protectedProcedure
    .input(z.object({ id: z.string(), today: zDate }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.cols.users.findOne({ _id: ctx.userId });
      const item = user?.todos.find((t) => t.id === input.id);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const next: TodoSub['status'] =
        item.status === 'open' ? 'started' : item.status === 'started' ? 'completed' : 'open';
      const history = [...item.history, { at: input.today, from: item.status, to: next }];

      const set: Record<string, unknown> = {
        'todos.$.status': next,
        'todos.$.history': history,
      };
      const update: Record<string, unknown> = { $set: set };
      if (next === 'completed') set['todos.$.completedAt'] = input.today;
      else update.$unset = { 'todos.$.completedAt': '' };

      await ctx.cols.users.updateOne(
        { _id: ctx.userId, 'todos.id': input.id } as never,
        update as never,
      );
      return { status: next };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(20), today: zDate }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.cols.users.findOne({ _id: ctx.userId });
      const item = user?.todos.find((t) => t.id === input.id);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $pull: { todos: { id: input.id } } },
      );
      await ctx.cols.deletedTodos.insertOne({
        userId: ctx.userId,
        text: item.text,
        reason: input.reason.trim(),
        deletedAt: input.today,
        createdAt: item.createdAt,
      });
      return { ok: true };
    }),

  setSlotCount: protectedProcedure
    .input(z.object({ count: z.number().int().min(1).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $set: { 'todoMeta.slotCount': input.count } },
      );
      return { ok: true };
    }),

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

      let { penaltyPieces, penaltyWeekStart, lastRollover } = user.todoMeta;
      const { slotCount } = user.todoMeta;
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
});
