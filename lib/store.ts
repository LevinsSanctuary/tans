import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppState,
  DayEntry,
  EveningCheckIn,
  Habit,
  MissedDay,
} from './types';
import { getDaysOfWeek, getToday, getWeekStart } from './date';

const STORAGE_KEY = 'tans:state:v1';
const SCHEMA_VERSION = 1;

interface PersistedBlob {
  schemaVersion: number;
  data: AppState;
}

const defaultState: AppState = {
  habits: [],
  dayEntries: [],
  eveningCheckIns: [],
  weekReviews: [],
  onboardingComplete: false,
  missedDays: [],
  solvedPuzzles: {},
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useHabitStore() {
  const [state, setState] = useState<AppState>(defaultState);
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
            if (!cancelled) {
              setState({
                ...defaultState,
                ...parsed.data,
                missedDays: parsed.data.missedDays ?? [],
                solvedPuzzles: parsed.data.solvedPuzzles ?? {},
              });
            }
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

  // Persist on every change, debounced — bursty edits (e.g. typing a
  // reflection) coalesce into one disk write. Never persist before
  // hydration finishes or we'd overwrite real data with the empty default.
  const stateRef = useRef(state);
  stateRef.current = state;

  const flush = useCallback(() => {
    const blob: PersistedBlob = {
      schemaVersion: SCHEMA_VERSION,
      data: stateRef.current,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blob)).catch(() => {
      // Best-effort persistence.
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(flush, 300);
    return () => clearTimeout(t);
  }, [state, hydrated, flush]);

  // Flush immediately when the app goes to the background so a pending
  // debounced write isn't lost on close.
  useEffect(() => {
    if (!hydrated) return;
    const sub = RNAppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') flush();
    });
    return () => sub.remove();
  }, [hydrated, flush]);

  const today = getToday();
  const currentWeekStart = getWeekStart(today);
  const activeHabits = state.habits.filter((h) => h.active);

  const addHabit = useCallback(
    (name: string) => {
      setState((prev) => {
        if (prev.habits.filter((h) => h.active).length >= 5) return prev;
        const habit: Habit = {
          id: uuid(),
          name,
          createdAt: today,
          active: true,
        };
        return {
          ...prev,
          habits: [...prev.habits, habit],
          onboardingComplete: true,
        };
      });
    },
    [today],
  );

  const toggleDay = useCallback((habitId: string, date: string) => {
    setState((prev) => {
      const existing = prev.dayEntries.find(
        (e) => e.habitId === habitId && e.date === date,
      );
      if (existing) {
        return {
          ...prev,
          dayEntries: prev.dayEntries.map((e) =>
            e.habitId === habitId && e.date === date
              ? {
                  ...e,
                  completed: !e.completed,
                  reflection: !e.completed ? e.reflection : '',
                }
              : e,
          ),
        };
      }
      const entry: DayEntry = {
        date,
        habitId,
        completed: true,
        reflection: '',
      };
      return { ...prev, dayEntries: [...prev.dayEntries, entry] };
    });
  }, []);

  const setReflection = useCallback(
    (habitId: string, date: string, reflection: string) => {
      setState((prev) => ({
        ...prev,
        dayEntries: prev.dayEntries.map((e) =>
          e.habitId === habitId && e.date === date
            ? { ...e, reflection: reflection.slice(0, 200) }
            : e,
        ),
      }));
    },
    [],
  );

  const saveEveningCheckIn = useCallback((checkIn: EveningCheckIn) => {
    setState((prev) => {
      const filtered = prev.eveningCheckIns.filter(
        (c) => c.date !== checkIn.date,
      );
      return { ...prev, eveningCheckIns: [...filtered, checkIn] };
    });
  }, []);

  const getDayEntry = useCallback(
    (habitId: string, date: string) =>
      state.dayEntries.find(
        (e) => e.habitId === habitId && e.date === date,
      ),
    [state.dayEntries],
  );

  const getEveningCheckIn = useCallback(
    (date: string) => state.eveningCheckIns.find((c) => c.date === date),
    [state.eveningCheckIns],
  );

  // Most recent non-empty "what habit could you add next" idea, used to
  // pre-fill the add-habit sheet after a puzzle is completed.
  const getLatestNextHabitIdea = useCallback((): string => {
    let latest: EveningCheckIn | undefined;
    for (const c of state.eveningCheckIns) {
      if (c.nextHabitIdea.trim() && (!latest || c.date > latest.date)) {
        latest = c;
      }
    }
    return latest?.nextHabitIdea.trim() ?? '';
  }, [state.eveningCheckIns]);

  const saveMissedDay = useCallback((entry: MissedDay) => {
    setState((prev) => {
      const others = (prev.missedDays ?? []).filter(
        (m) => !(m.habitId === entry.habitId && m.date === entry.date),
      );
      return { ...prev, missedDays: [...others, entry] };
    });
  }, []);

  const getMissedDay = useCallback(
    (habitId: string, date: string) =>
      (state.missedDays ?? []).find(
        (m) => m.habitId === habitId && m.date === date,
      ),
    [state.missedDays],
  );

  const getWeekCompletionForHabit = useCallback(
    (habitId: string, weekStart: string) => {
      const days = getDaysOfWeek(weekStart);
      return days.map((d) => {
        const entry = state.dayEntries.find(
          (e) => e.habitId === habitId && e.date === d,
        );
        return { date: d, completed: entry?.completed ?? false };
      });
    },
    [state.dayEntries],
  );

  const isWeekComplete = useCallback(
    (habitId: string, weekStart: string) =>
      getWeekCompletionForHabit(habitId, weekStart).every((d) => d.completed),
    [getWeekCompletionForHabit],
  );

  const deleteHabit = useCallback((habitId: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.filter((h) => h.id !== habitId),
      dayEntries: prev.dayEntries.filter((e) => e.habitId !== habitId),
      missedDays: (prev.missedDays ?? []).filter((m) => m.habitId !== habitId),
      weekReviews: prev.weekReviews.filter((r) => r.habitId !== habitId),
    }));
  }, []);

  const editHabit = useCallback((habitId: string, newName: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        h.id === habitId ? { ...h, name: newName } : h,
      ),
    }));
  }, []);

  const canAddNewHabit = useCallback(() => {
    return activeHabits.length < 5;
  }, [activeHabits]);

  const markPuzzleSolved = useCallback((weekStart: string) => {
    setState((prev) => ({
      ...prev,
      solvedPuzzles: { ...(prev.solvedPuzzles ?? {}), [weekStart]: true },
    }));
  }, []);

  const isPuzzleSolved = useCallback(
    (weekStart: string) => !!(state.solvedPuzzles ?? {})[weekStart],
    [state.solvedPuzzles],
  );

  // ---- Dev-only helpers (gated by __DEV__ at the call site) ----
  const devFillWeek = useCallback(() => {
    setState((prev) => {
      const habit = prev.habits.find((h) => h.active);
      if (!habit) return prev;
      const days = getDaysOfWeek(currentWeekStart);
      const others = prev.dayEntries.filter(
        (e) => !(e.habitId === habit.id && days.includes(e.date)),
      );
      const filled: DayEntry[] = days.map((d) => ({
        date: d,
        habitId: habit.id,
        completed: true,
        reflection: '',
      }));
      return { ...prev, dayEntries: [...others, ...filled] };
    });
  }, [currentWeekStart]);

  const devClearWeek = useCallback(() => {
    setState((prev) => {
      const days = getDaysOfWeek(currentWeekStart);
      return {
        ...prev,
        dayEntries: prev.dayEntries.filter((e) => !days.includes(e.date)),
        solvedPuzzles: Object.fromEntries(
          Object.entries(prev.solvedPuzzles ?? {}).filter(
            ([k]) => k !== currentWeekStart,
          ),
        ),
      };
    });
  }, [currentWeekStart]);

  const devTogglePuzzleSolved = useCallback(() => {
    setState((prev) => {
      const current = !!(prev.solvedPuzzles ?? {})[currentWeekStart];
      const next = { ...(prev.solvedPuzzles ?? {}) };
      if (current) delete next[currentWeekStart];
      else next[currentWeekStart] = true;
      return { ...prev, solvedPuzzles: next };
    });
  }, [currentWeekStart]);

  const devResetAll = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setState(defaultState);
  }, []);

  return {
    state,
    hydrated,
    activeHabits,
    today,
    currentWeekStart,
    addHabit,
    toggleDay,
    setReflection,
    saveEveningCheckIn,
    getDayEntry,
    getEveningCheckIn,
    getLatestNextHabitIdea,
    saveMissedDay,
    getMissedDay,
    getWeekCompletionForHabit,
    isWeekComplete,
    deleteHabit,
    editHabit,
    canAddNewHabit,
    markPuzzleSolved,
    isPuzzleSolved,
    devFillWeek,
    devClearWeek,
    devTogglePuzzleSolved,
    devResetAll,
  };
}
