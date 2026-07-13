// Integration seam between the Expo app and the tans API (the Next.js + tRPC
// server in ../server). The app is still AsyncStorage-backed today; when the
// tRPC client is wired up, it imports from here.

// Base URL of the API. Dev points at the local `next dev -p 4000`; production
// is baked into the EAS build via EXPO_PUBLIC_API_URL (e.g. your Vercel URL).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export const TRPC_URL = `${API_BASE_URL}/api/trpc`;

// The server authenticates every request from the Clerk session token in the
// Authorization header (see ../server/src/server/context.ts). The token comes
// from Clerk's `useAuth().getToken()` — a hook, so the tRPC client must be
// created inside a component/provider. Wire it like this:
//
//   import { useAuth } from '@clerk/expo';
//   import { httpBatchLink } from '@trpc/client';
//   import { TRPC_URL } from '@/lib/api';
//
//   function TRPCProvider({ children }) {
//     const { getToken } = useAuth();
//     const [client] = useState(() =>
//       trpc.createClient({
//         links: [
//           httpBatchLink({
//             url: TRPC_URL,
//             headers: async () => {
//               const token = await getToken();
//               return token ? { Authorization: `Bearer ${token}` } : {};
//             },
//           }),
//         ],
//       }),
//     );
//     ...
//   }
