import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeletedTodo, TodoItem, TodoState, TodoStatus } from './types';
import { getToday, getWeekStart } from './date';

// A second, independent persistence key alongside the habit store's
// `tans:state:v1`. The to-do domain is deliberately decoupled from habits
// (mirrors the web reference app); they only meet at the piece counter, where
// stale-to-do penalties subtract from the week's earned tangram pieces.
const STORAGE_KEY = 'tans:todos:v1';
const SCHEMA_VERSION = 1;

export const DEFAULT_TODO_SLOTS = 5;
// An item left untouched for a week costs you a tangram piece.
export const TODO_STALE_DAYS = 7;
// Deleting a to-do needs at least this much reasoning, so future-you knows why.
export const TODO_DELETE_MIN_CHARS = 20;

interface PersistedBlob {
  schemaVersion: number;
  data: TodoState;
}

const defaultState: TodoState = {
  items: [],
  deleted: [],
  slotCount: DEFAULT_TODO_SLOTS,
  penaltyPieces: 0,
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.floor((db - da) / 86400000);
}

export function useTodoStore() {
  const [state, setState] = useState<TodoState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as PersistedBlob;
          if (parsed.schemaVersion === SCHEMA_VERSION && parsed.data) {
            if (!cancelled) setState({ ...defaultState, ...parsed.data });
          }
        }
      } catch {
        // Corrupt blob — fall back to defaults silently.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence — never write before hydration finishes or we'd
  // clobber stored data with the empty default. Mirrors useHabitStore.
  const stateRef = useRef(state);
  stateRef.current = state;

  const flush = useCallback(() => {
    const blob: PersistedBlob = {
      schemaVersion: SCHEMA_VERSION,
      data: stateRef.current,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blob)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(flush, 300);
    return () => clearTimeout(t);
  }, [state, hydrated, flush]);

  useEffect(() => {
    if (!hydrated) return;
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') flush();
    });
    return () => sub.remove();
  }, [hydrated, flush]);

  const today = getToday();
  const week = getWeekStart(today);

  // Rollover + stale-item penalties. Idempotent per day. Runs once hydration
  // completes (NOT on raw mount — the empty default would otherwise stamp
  // lastRollover before real data arrives).
  const runDailyMaintenance = useCallback(() => {
    setState((prev) => {
      let next = prev;

      // Reset the weekly penalty counter when the week rolls over.
      if (next.penaltyWeekStart !== week) {
        next = { ...next, penaltyWeekStart: week, penaltyPieces: 0 };
      }

      // Rollover: clear completed items once per day.
      if (next.lastRollover !== today) {
        next = {
          ...next,
          items: next.items.filter((i) => i.status !== 'completed'),
          lastRollover: today,
        };
      }

      // Charge a piece for each item >= 7 days old not yet penalized.
      let newPenalties = 0;
      const updated = next.items.map((i) => {
        if (i.penaltyApplied) return i;
        if (daysBetween(i.createdAt, today) >= TODO_STALE_DAYS) {
          newPenalties += 1;
          return { ...i, penaltyApplied: true };
        }
        return i;
      });
      if (newPenalties > 0) {
        next = {
          ...next,
          items: updated,
          penaltyPieces: next.penaltyPieces + newPenalties,
        };
      }
      return next;
    });
  }, [today, week]);

  useEffect(() => {
    if (hydrated) runDailyMaintenance();
  }, [hydrated, runDailyMaintenance]);

  const addItem = useCallback(
    (text: string) => {
      setState((prev) => {
        if (prev.items.length >= prev.slotCount) return prev;
        const item: TodoItem = {
          id: uuid(),
          text,
          status: 'open',
          createdAt: today,
          history: [],
        };
        return { ...prev, items: [...prev.items, item] };
      });
    },
    [today],
  );

  const setItemText = useCallback((id: string, text: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === id ? { ...i, text } : i)),
    }));
  }, []);

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
    },
    [today],
  );

  const deleteItem = useCallback(
    (id: string, reason: string) => {
      if (reason.trim().length < TODO_DELETE_MIN_CHARS) return false;
      setState((prev) => {
        const item = prev.items.find((i) => i.id === id);
        if (!item) return prev;
        const entry: DeletedTodo = {
          id: item.id,
          text: item.text,
          reason: reason.trim(),
          deletedAt: today,
          createdAt: item.createdAt,
        };
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== id),
          deleted: [...prev.deleted, entry],
        };
      });
      return true;
    },
    [today],
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
