import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Requires a verified Clerk session token. The Mongo user may not exist yet —
// this is the gate for `bootstrap`, which provisions it. `ctx.clerkId` is
// narrowed to a non-null string for downstream resolvers.
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid Clerk session token',
    });
  }
  return next({ ctx: { ...ctx, clerkId: ctx.clerkId } });
});

// Requires a provisioned Mongo user (i.e. bootstrap has run for this Clerk
// identity). Every data procedure gets `ctx.userId` as a non-null ObjectId.
export const protectedProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not provisioned — call user.bootstrap first',
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
