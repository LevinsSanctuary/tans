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
