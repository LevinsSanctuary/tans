import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { checkinDTO, zDate } from '../util';

export const checkinsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const docs = await ctx.cols.eveningCheckIns
      .find({ userId: ctx.userId })
      .sort({ date: 1 })
      .toArray();
    return docs.map(checkinDTO);
  }),

  // One check-in per (user, date) — upsert replaces the same-day entry.
  save: protectedProcedure
    .input(
      z.object({
        date: zDate,
        likelihoodScore: z.number().int().min(1).max(10),
        nextHabitIdea: z.string().max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.eveningCheckIns.updateOne(
        { userId: ctx.userId, date: input.date },
        {
          $set: {
            likelihoodScore: input.likelihoodScore,
            nextHabitIdea: input.nextHabitIdea,
          },
        },
        { upsert: true },
      );
      return { ok: true };
    }),

  // Most recent non-empty "what to add next" idea — pre-fills the add-habit sheet.
  latestNextHabitIdea: protectedProcedure.query(async ({ ctx }) => {
    const doc = await ctx.cols.eveningCheckIns
      .find({ userId: ctx.userId, nextHabitIdea: { $ne: '' } })
      .sort({ date: -1 })
      .limit(1)
      .next();
    return doc?.nextHabitIdea ?? '';
  }),
});
