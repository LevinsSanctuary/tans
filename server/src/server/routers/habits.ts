import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { habitDTO, zDate } from '../util';
import type { HabitDoc } from '../../db/collections';

// Mirrored from lib/store.ts. The full add-gating (one/week, recent full week)
// is derived and stays client-side; the server only enforces the hard cap.
const MAX_ACTIVE_HABITS = 3;

export const habitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const docs = await ctx.cols.habits.find({ userId: ctx.userId }).toArray();
    return docs.map(habitDTO);
  }),

  add: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80), today: zDate }))
    .mutation(async ({ ctx, input }) => {
      const activeCount = await ctx.cols.habits.countDocuments({
        userId: ctx.userId,
        active: true,
        graduatedAt: { $exists: false },
      });
      if (activeCount >= MAX_ACTIVE_HABITS) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can hold at most three active habits.',
        });
      }
      const doc: HabitDoc = {
        userId: ctx.userId,
        name: input.name,
        createdAt: input.today,
        active: true,
        entries: [],
        missedDays: [],
      };
      const res = await ctx.cols.habits.insertOne(doc);
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $set: { onboardingComplete: true } },
      );
      return habitDTO({ ...doc, _id: res.insertedId });
    }),

  rename: protectedProcedure
    .input(z.object({ habitId: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateOne(
        { _id: new ObjectId(input.habitId), userId: ctx.userId },
        { $set: { name: input.name } },
      );
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ habitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.deleteOne({
        _id: new ObjectId(input.habitId),
        userId: ctx.userId,
      });
      return { ok: true };
    }),

  // Toggle a single day's completion. Read-modify-write to preserve the store's
  // semantics (un-completing clears that day's reflection). The write itself is
  // a targeted positional update — the whole habit doc is never rewritten.
  toggleDay: protectedProcedure
    .input(z.object({ habitId: z.string(), date: zDate }))
    .mutation(async ({ ctx, input }) => {
      const _id = new ObjectId(input.habitId);
      const habit = await ctx.cols.habits.findOne({ _id, userId: ctx.userId });
      if (!habit) throw new TRPCError({ code: 'NOT_FOUND' });

      const existing = habit.entries.find((e) => e.date === input.date);
      if (existing) {
        const completed = !existing.completed;
        await ctx.cols.habits.updateOne(
          { _id, 'entries.date': input.date } as never,
          {
            $set: {
              'entries.$.completed': completed,
              'entries.$.reflection': completed ? existing.reflection : '',
            },
          } as never,
        );
      } else {
        await ctx.cols.habits.updateOne(
          { _id },
          { $push: { entries: { date: input.date, completed: true, reflection: '' } } },
        );
      }
      return { ok: true };
    }),

  setReflection: protectedProcedure
    .input(z.object({ habitId: z.string(), date: zDate, reflection: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateOne(
        { _id: new ObjectId(input.habitId), userId: ctx.userId, 'entries.date': input.date } as never,
        { $set: { 'entries.$.reflection': input.reflection } } as never,
      );
      return { ok: true };
    }),

  setHoliday: protectedProcedure
    .input(z.object({ habitId: z.string(), startDate: zDate, days: z.number().int().min(1).max(7) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateOne(
        { _id: new ObjectId(input.habitId), userId: ctx.userId },
        { $set: { holiday: { startDate: input.startDate, days: input.days } } },
      );
      return { ok: true };
    }),

  clearHoliday: protectedProcedure
    .input(z.object({ habitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateOne(
        { _id: new ObjectId(input.habitId), userId: ctx.userId },
        { $unset: { holiday: '' } },
      );
      return { ok: true };
    }),

  // The graduation flip (9 consecutive full weeks) is computed client-side;
  // this persists the result.
  graduate: protectedProcedure
    .input(z.object({ habitId: z.string(), graduatedAt: zDate }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.habits.updateOne(
        { _id: new ObjectId(input.habitId), userId: ctx.userId },
        { $set: { active: false, graduatedAt: input.graduatedAt } },
      );
      return { ok: true };
    }),

  saveMissedDay: protectedProcedure
    .input(
      z.object({
        habitId: z.string(),
        date: zDate,
        kind: z.enum(['badge', 'achievement']),
        badge: z.enum(['rest', 'overwhelmed', 'forgot', 'unwell', 'busy', 'low-energy']).optional(),
        achievement: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const _id = new ObjectId(input.habitId);
      const { habitId: _habitId, ...entry } = input;
      // Replace any existing missed entry for this date (one per date grain).
      await ctx.cols.habits.updateOne(
        { _id, userId: ctx.userId },
        { $pull: { missedDays: { date: input.date } } },
      );
      await ctx.cols.habits.updateOne(
        { _id, userId: ctx.userId },
        { $push: { missedDays: entry } },
      );
      return { ok: true };
    }),
});
