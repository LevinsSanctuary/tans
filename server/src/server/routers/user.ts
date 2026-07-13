import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure, protectedProcedure } from '../trpc';
import { userDTO, habitDTO, checkinDTO, zDate } from '../util';
import { clerkPrimaryEmail } from '../clerk';
import type { UserDoc } from '../../db/collections';

export const userRouter = router({
  // The app's single "load my world" call on open. Find-or-create the Mongo
  // user for the verified Clerk identity (email fetched server-side from
  // Clerk, not trusted from the client) and return the full hydration payload.
  bootstrap: authedProcedure
    .input(z.object({ today: zDate }))
    .mutation(async ({ ctx, input }) => {
      // Fast path: returning user. Only hit Clerk's API to fetch the email on
      // the very first sign-in, when we actually have to create the doc.
      let user = await ctx.cols.users.findOne({ clerkId: ctx.clerkId });
      if (!user) {
        const newUser: UserDoc = {
          clerkId: ctx.clerkId,
          email: await clerkPrimaryEmail(ctx.clerkId),
          createdAt: input.today,
          onboardingComplete: false,
          solvedPuzzles: {},
          todoMeta: { slotCount: 5, penaltyPieces: 0 },
          todos: [],
        };
        user = await ctx.cols.users.findOneAndUpdate(
          { clerkId: ctx.clerkId },
          { $setOnInsert: newUser },
          { upsert: true, returnDocument: 'after' },
        );
      }
      if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [habits, checkins] = await Promise.all([
        ctx.cols.habits.find({ userId: user._id }).toArray(),
        ctx.cols.eveningCheckIns.find({ userId: user._id }).sort({ date: 1 }).toArray(),
      ]);

      return {
        user: userDTO(user),
        habits: habits.map(habitDTO),
        checkins: checkins.map(checkinDTO),
      };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.cols.users.findOne({ _id: ctx.userId });
    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    return userDTO(user);
  }),

  markPuzzleSolved: protectedProcedure
    .input(z.object({ weekStart: zDate }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $set: { [`solvedPuzzles.${input.weekStart}`]: true } } as never,
      );
      return { ok: true };
    }),

  setOnboardingComplete: protectedProcedure
    .input(z.object({ value: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.cols.users.updateOne(
        { _id: ctx.userId },
        { $set: { onboardingComplete: input.value } },
      );
      return { ok: true };
    }),
});
