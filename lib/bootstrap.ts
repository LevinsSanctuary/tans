import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { trpc } from './trpc';
import { getToday } from './date';

export type BootstrapData = Awaited<ReturnType<typeof trpc.user.bootstrap.mutate>>;

// One "load my world" call per sign-in. Also the resync target after any
// failed optimistic mutation.
export function useBootstrap() {
  const { isSignedIn } = useAuth();
  const [data, setData] = useState<BootstrapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await trpc.user.bootstrap.mutate({ today: getToday() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) load();
    else setData(null); // sign-out clears everything
  }, [isSignedIn, load]);

  return { data, error, reload: load };
}
