import { router } from '../trpc';
import { userRouter } from './user';
import { habitsRouter } from './habits';
import { todosRouter } from './todos';
import { checkinsRouter } from './checkins';
import { devRouter } from './dev';

export const appRouter = router({
  user: userRouter,
  habits: habitsRouter,
  todos: todosRouter,
  checkins: checkinsRouter,
  dev: devRouter,
});

// The type the RN client imports for end-to-end typesafety.
export type AppRouter = typeof appRouter;
