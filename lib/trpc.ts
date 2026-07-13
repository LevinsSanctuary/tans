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
