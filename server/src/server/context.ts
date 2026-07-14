import { ObjectId } from 'mongodb';
import { verifyToken } from '@clerk/backend';
import { collections } from '../db/collections';

// Built once per request. We verify the Clerk session token statelessly (no
// call to Clerk) and resolve it to our Mongo user. `clerkId` is set for any
// valid token; `userId` is set only once that Clerk identity has been
// provisioned into a users doc (see user.bootstrap). The trpc middlewares
// (authedProcedure / protectedProcedure) gate on these two fields.
export async function createContext({ req }: { req: Request }) {
  const cols = await collections();

  let clerkId: string | null = null;
  const authz = req.headers.get('authorization');
  const token = authz?.startsWith('Bearer ') ? authz.slice(7) : null;
  if (token) {
    try {
      const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
      clerkId = claims.sub;
    } catch {
      // Invalid/expired/tampered token → treated as unauthenticated. The
      // procedure middleware turns the missing clerkId into a 401.
      clerkId = null;
    }
  }

  let userId: ObjectId | null = null;
  if (clerkId) {
    const existing = await cols.users.findOne({ clerkId }, { projection: { _id: 1 } });
    userId = existing?._id ?? null;
  }

  return { cols, clerkId, userId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
