import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppState,
  DayEntry,
  EveningCheckIn,
  Habit,
  HabitHoliday,
  MissedDay,
} from './types';
import { addDays, getDaysOfWeek, getToday, getWeekStart } from './date';

const STORAGE_KEY = 'tans:state:v1';
const SCHEMA_VERSION = 1;

// --- Game rules (kept here as the single source of truth; mirrored in the
// in-app "Game Rules" screen). ---
// You can stack at most three habits at once.
export const MAX_ACTIVE_HABITS = 3;
// Nine consecutive fully-completed weeks (63 days) graduates a habit to the
// permanent box; 9 because it's divisible by 7 (a whole tangram each week).
export const GRADUATION_WEEKS = 9;
// A holiday hold pauses counting for up to 7 days. Research suggests ~3 days
// is the safe ceiling, so 4-7 days is flagged as the danger zone.
export const MAX_HOLIDAY_DAYS = 7;
export const HOLIDAY_DANGER_DAYS = 4;

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
  const activeHabits = state.habits.filter((h) => h.active && !h.graduatedAt);
  const graduatedHabits = state.habits.filter((h) => !!h.graduatedAt);

  // --- Holiday (per-habit counting pause) ---
  const isHabitPausedOn = useCallback((habit: Habit, date: string) => {
    if (!habit.holiday) return false;
    const end = addDays(habit.holiday.startDate, habit.holiday.days); // exclusive
    return date >= habit.holiday.startDate && date < end;
  }, []);

  // Live holiday info for *today*, or null if no hold is currently active.
  const getHabitHolidayInfo = useCallback(
    (habit: Habit) => {
      if (!habit.holiday) return null;
      const end = addDays(habit.holiday.startDate, habit.holiday.days);
      if (today < habit.holiday.startDate || today >= end) return null;
      let remaining = 0;
      let d = today;
      while (d < end) {
        remaining += 1;
        d = addDays(d, 1);
      }
      return {
        remaining,
        total: habit.holiday.days,
        endsOn: end,
        danger: habit.holiday.days >= HOLIDAY_DANGER_DAYS,
      };
    },
    [today],
  );

  // --- Completion / earning ---
  const entryDone = useCallback(
    (habitId: string, date: string) =>
      state.dayEntries.some(
        (e) => e.habitId === habitId && e.date === date && e.completed,
      ),
    [state.dayEntries],
  );

  // A day earns a tangram piece only if every active, non-paused habit that
  // already existed that day is completed (AND semantics across habits).
  const isDayEarned = useCallback(
    (date: string) => {
      const due = activeHabits.filter(
        (h) => date >= h.createdAt && !isHabitPausedOn(h, date),
      );
      if (due.length === 0) return false;
      return due.every((h) => entryDone(h.id, date));
    },
    [activeHabits, isHabitPausedOn, entryDone],
  );

  // A habit's week is "full" if every day it was due (existed, not on holiday,
  // not in the future) is completed.
  const isHabitWeekFull = useCallback(
    (habit: Habit, weekStart: string) => {
      const required = getDaysOfWeek(weekStart).filter(
        (d) =>
          d >= habit.createdAt && d <= today && !isHabitPausedOn(habit, d),
      );
      if (required.length === 0) return false;
      return required.every((d) => entryDone(habit.id, d));
    },
    [today, isHabitPausedOn, entryDone],
  );

  // Longest / current run of consecutive *elapsed* full weeks since creation.
  const habitGraduationProgress = useCallback(
    (habit: Habit) => {
      const firstWeek = getWeekStart(habit.createdAt);
      let wk = firstWeek;
      let run = 0;
      let max = 0;
      while (wk <= currentWeekStart) {
        const elapsed = getDaysOfWeek(wk)[6] <= today;
        const full = isHabitWeekFull(habit, wk);
        if (elapsed) {
          if (full) {
            run += 1;
            if (run > max) max = run;
          } else {
            run = 0;
          }
        }
        // The current, not-yet-elapsed week neither counts nor breaks the run.
        wk = getWeekStart(addDays(wk, 7));
      }
      return { current: run, max };
    },
    [currentWeekStart, today, isHabitWeekFull],
  );

  // A habit "slipped" if the previous fully-elapsed week (past the creation
  // week's grace) wasn't full — used to prompt the user to drop it.
  const habitSlipped = useCallback(
    (habit: Habit) => {
      const firstWeek = getWeekStart(habit.createdAt);
      const lastWeek = getWeekStart(addDays(currentWeekStart, -1));
      if (lastWeek <= firstWeek) return false;
      if (getHabitHolidayInfo(habit)) return false; // currently on holiday
      return !isHabitWeekFull(habit, lastWeek);
    },
    [currentWeekStart, isHabitWeekFull, getHabitHolidayInfo],
  );

  // --- Add-habit gating ---
  const weekEarned = useCallback(
    (weekStart: string) => getDaysOfWeek(weekStart).every((d) => isDayEarned(d)),
    [isDayEarned],
  );

  const addedHabitThisWeek = state.habits.some(
    (h) => getWeekStart(h.createdAt) === currentWeekStart,
  );
  // A full week earns the right to one new habit: this week (e.g. right after
  // assembling the puzzle), or last week / the week before as a grace window.
  const completedRecentWeek =
    weekEarned(currentWeekStart) ||
    weekEarned(getWeekStart(addDays(currentWeekStart, -1))) ||
    weekEarned(getWeekStart(addDays(currentWeekStart, -8)));

  const setHabitHoliday = useCallback((habitId: string, days: number) => {
    const clamped = Math.max(1, Math.min(MAX_HOLIDAY_DAYS, Math.round(days)));
    const holiday: HabitHoliday = { startDate: getToday(), days: clamped };
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        h.id === habitId ? { ...h, holiday } : h,
      ),
    }));
  }, []);

  const clearHabitHoliday = useCallback((habitId: string) => {
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        h.id === habitId ? { ...h, holiday: undefined } : h,
      ),
    }));
  }, []);

  // Auto-graduate any habit that has reached 9 consecutive full weeks.
  useEffect(() => {
    if (!hydrated) return;
    const ids = state.habits
      .filter(
        (h) =>
          h.active &&
          !h.graduatedAt &&
          habitGraduationProgress(h).max >= GRADUATION_WEEKS,
      )
      .map((h) => h.id);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        idSet.has(h.id) ? { ...h, active: false, graduatedAt: getToday() } : h,
      ),
    }));
  }, [hydrated, state.habits, state.dayEntries, habitGraduationProgress]);

  const addHabit = useCallback(
    (name: string) => {
      setState((prev) => {
        if (
          prev.habits.filter((h) => h.active && !h.graduatedAt).length >=
          MAX_ACTIVE_HABITS
        )
          return prev;
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
    if (activeHabits.length === 0) return true; // the very first habit
    if (activeHabits.length >= MAX_ACTIVE_HABITS) return false;
    if (addedHabitThisWeek) return false;
    return completedRecentWeek;
  }, [activeHabits.length, addedHabitThisWeek, completedRecentWeek]);

  // Human-readable reason the add-habit action is unavailable, or null if it's
  // allowed. Drives the messaging on the add sheet / FAB.
  const addHabitBlockReason = useCallback((): string | null => {
    if (activeHabits.length === 0) return null;
    if (activeHabits.length >= MAX_ACTIVE_HABITS)
      return 'You can hold three habits at once. Wait until one graduates at week 9 before adding another.';
    if (addedHabitThisWeek)
      return 'One new habit per week — come back next week to add another.';
    if (!completedRecentWeek)
      return 'Complete a full week with your current habit(s) first — then you’ve earned a new one.';
    return null;
  }, [activeHabits.length, addedHabitThisWeek, completedRecentWeek]);

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
      const habits = prev.habits.filter((h) => h.active && !h.graduatedAt);
      if (habits.length === 0) return prev;
      const days = getDaysOfWeek(currentWeekStart);
      const ids = new Set(habits.map((h) => h.id));
      const others = prev.dayEntries.filter(
        (e) => !(ids.has(e.habitId) && days.includes(e.date)),
      );
      const filled: DayEntry[] = habits.flatMap((h) =>
        days.map((d) => ({
          date: d,
          habitId: h.id,
          completed: true,
          reflection: '',
        })),
      );
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
    graduatedHabits,
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
    addHabitBlockReason,
    isDayEarned,
    isHabitPausedOn,
    getHabitHolidayInfo,
    habitGraduationProgress,
    habitSlipped,
    setHabitHoliday,
    clearHabitHoliday,
    markPuzzleSolved,
    isPuzzleSolved,
    devFillWeek,
    devClearWeek,
    devTogglePuzzleSolved,
    devResetAll,
  };
}
