import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { TodoItem, TodoState, TodoStatus } from './types';
import { getToday, getWeekStart } from './date';
import { trpc } from './trpc';
import type { BootstrapData } from './bootstrap';

export const DEFAULT_TODO_SLOTS = 5;
// An item left untouched for a week costs you a tangram piece.
export const TODO_STALE_DAYS = 7;
// Deleting a to-do needs at least this much reasoning, so future-you knows why.
export const TODO_DELETE_MIN_CHARS = 20;

const defaultState: TodoState = {
  items: [],
  deleted: [],
  slotCount: DEFAULT_TODO_SLOTS,
  penaltyPieces: 0,
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.floor((db - da) / 86400000);
}

// Adapt the bootstrap payload's user doc into local TodoState. The deleted[]
// audit log lives only server-side now (deletedTodos collection).
function fromBootstrap(b: BootstrapData): TodoState {
  return {
    items: b.user.todos,
    deleted: [],
    slotCount: b.user.todoMeta.slotCount,
    lastRollover: b.user.todoMeta.lastRollover,
    penaltyPieces: b.user.todoMeta.penaltyPieces,
    penaltyWeekStart: b.user.todoMeta.penaltyWeekStart,
  };
}

// `bootstrap` is the hydration payload (null until loaded / after sign-out).
// `resync` re-runs bootstrap; the recovery path when a mutation fails.
export function useTodoStore(bootstrap: BootstrapData | null, resync: () => void) {
  const [state, setState] = useState<TodoState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (bootstrap) {
      setState(fromBootstrap(bootstrap));
      setHydrated(true);
    } else {
      setState(defaultState);
      setHydrated(false);
    }
  }, [bootstrap]);

  const fire = useCallback(
    (p: Promise<unknown>) => {
      p.catch(() => {
        Alert.alert('Sync failed', 'Reloading your data.');
        resync();
      });
    },
    [resync],
  );

  const today = getToday();
  const week = getWeekStart(today);

  // Rollover + stale-item penalties now run server-side; the returned
  // { todos, todoMeta } is authoritative — replace, don't merge. Idempotent
  // per day. Runs once hydrated (never against the empty default).
  const runDailyMaintenance = useCallback(async () => {
    try {
      const res = await trpc.todos.runDailyMaintenance.mutate({ today, weekStart: week });
      setState((prev) => ({
        ...prev,
        items: res.todos,
        slotCount: res.todoMeta.slotCount,
        lastRollover: res.todoMeta.lastRollover,
        penaltyPieces: res.todoMeta.penaltyPieces,
        penaltyWeekStart: res.todoMeta.penaltyWeekStart,
      }));
    } catch {
      // Non-critical — retried on next launch.
    }
  }, [today, week]);

  useEffect(() => {
    if (hydrated) runDailyMaintenance();
  }, [hydrated, runDailyMaintenance]);

  const addItem = useCallback(
    async (text: string) => {
      if (state.items.length >= state.slotCount) return;
      try {
        const item = await trpc.todos.add.mutate({ text, today });
        setState((prev) => ({ ...prev, items: [...prev.items, item] }));
      } catch {
        Alert.alert('Could not add to-do', 'Please try again.');
      }
    },
    [today, state.items.length, state.slotCount],
  );

  // Text edits fire per keystroke; local update immediate, server write
  // debounced 500ms per id.
  const textTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const setItemText = useCallback(
    (id: string, text: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === id ? { ...i, text } : i)),
      }));
      const timers = textTimers.current;
      const pending = timers.get(id);
      if (pending) clearTimeout(pending);
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          fire(trpc.todos.setText.mutate({ id, text }));
        }, 500),
      );
    },
    [fire],
  );

  const cycleStatus = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) => {
          if (i.id !== id) return i;
          const next: TodoStatus =
            i.status === 'open'
              ? 'started'
              : i.status === 'started'
                ? 'completed'
                : 'open';
          return {
            ...i,
            status: next,
            completedAt: next === 'completed' ? today : undefined,
            history: [...i.history, { at: today, from: i.status, to: next }],
          };
        }),
      }));
      fire(trpc.todos.cycleStatus.mutate({ id, today }));
    },
    [today, fire],
  );

  const deleteItem = useCallback(
    (id: string, reason: string) => {
      if (reason.trim().length < TODO_DELETE_MIN_CHARS) return false;
      setState((prev) => {
        const item = prev.items.find((i) => i.id === id);
        if (!item) return prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== id) };
      });
      fire(trpc.todos.remove.mutate({ id, reason: reason.trim(), today }));
      return true;
    },
    [today, fire],
  );

  const staleAgeDays = useCallback(
    (item: TodoItem) => daysBetween(item.createdAt, today),
    [today],
  );

  return {
    state,
    hydrated,
    today,
    runDailyMaintenance,
    addItem,
    setItemText,
    cycleStatus,
    deleteItem,
    staleAgeDays,
    penaltyPieces: state.penaltyWeekStart === week ? state.penaltyPieces : 0,
  };
}
