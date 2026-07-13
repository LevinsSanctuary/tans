import { createClerkClient } from '@clerk/backend';

// Backend Clerk client — talks to Clerk's API with the secret key. Used only
// to look up a user's email when we first provision their Mongo doc; token
// verification itself is done statelessly with `verifyToken` in context.ts.
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set (see .env.local.example)');

export const clerkClient = createClerkClient({ secretKey });

// Primary email for a Clerk user id. Session tokens don't carry email by
// default, so on first sign-in we fetch it once from Clerk to seed the doc.
export async function clerkPrimaryEmail(clerkId: string): Promise<string> {
  const user = await clerkClient.users.getUser(clerkId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? '';
}
