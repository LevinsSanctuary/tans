import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type {
  AppState,
  DayEntry,
  EveningCheckIn,
  Habit,
  HabitHoliday,
  MissedDay,
} from './types';
import { addDays, getDaysOfWeek, getToday, getWeekStart } from './date';
import { trpc } from './trpc';
import type { BootstrapData } from './bootstrap';

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

const defaultState: AppState = {
  habits: [],
  dayEntries: [],
  eveningCheckIns: [],
  weekReviews: [],
  onboardingComplete: false,
  missedDays: [],
  solvedPuzzles: {},
};

// Adapt the server's bootstrap payload (entries/missedDays embedded per habit)
// into the app's flat AppState shape (dayEntries/missedDays keyed by habitId).
function fromBootstrap(b: BootstrapData): AppState {
  return {
    habits: b.habits.map(({ entries, missedDays, ...h }) => h),
    dayEntries: b.habits.flatMap((h) =>
      h.entries.map((e) => ({ ...e, reflection: e.reflection ?? '', habitId: h.id })),
    ),
    missedDays: b.habits.flatMap((h) =>
      h.missedDays.map((m) => ({ ...m, habitId: h.id })),
    ),
    eveningCheckIns: b.checkins,
    weekReviews: [], // legacy web-port field; server never stores it
    onboardingComplete: b.user.onboardingComplete,
    solvedPuzzles: b.user.solvedPuzzles,
  };
}

// `bootstrap` is the hydration payload (null until loaded / after sign-out).
// `resync` re-runs bootstrap; it's the recovery path when an optimistic
// mutation fails on the server.
export function useHabitStore(bootstrap: BootstrapData | null, resync: () => void) {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from (or clear on) the bootstrap payload.
  useEffect(() => {
    if (bootstrap) {
      setState(fromBootstrap(bootstrap));
      setHydrated(true);
    } else {
      setState(defaultState);
      setHydrated(false);
    }
  }, [bootstrap]);

  // Fire-and-forget optimistic write. On failure, alert and re-pull the world
  // (no queues / retries — the simplest correct recovery).
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

  const setHabitHoliday = useCallback(
    (habitId: string, days: number) => {
      const clamped = Math.max(1, Math.min(MAX_HOLIDAY_DAYS, Math.round(days)));
      const startDate = getToday();
      const holiday: HabitHoliday = { startDate, days: clamped };
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habitId ? { ...h, holiday } : h,
        ),
      }));
      fire(trpc.habits.setHoliday.mutate({ habitId, startDate, days: clamped }));
    },
    [fire],
  );

  const clearHabitHoliday = useCallback(
    (habitId: string) => {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habitId ? { ...h, holiday: undefined } : h,
        ),
      }));
      fire(trpc.habits.clearHoliday.mutate({ habitId }));
    },
    [fire],
  );

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
    const graduatedAt = getToday();
    const idSet = new Set(ids);
    setState((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        idSet.has(h.id) ? { ...h, active: false, graduatedAt } : h,
      ),
    }));
    ids.forEach((habitId) =>
      fire(trpc.habits.graduate.mutate({ habitId, graduatedAt })),
    );
  }, [hydrated, state.habits, state.dayEntries, habitGraduationProgress, fire]);

  const addHabit = useCallback(
    async (name: string) => {
      if (activeHabits.length >= MAX_ACTIVE_HABITS) return;
      try {
        const created = await trpc.habits.add.mutate({ name, today });
        const { entries: _e, missedDays: _m, ...habit } = created;
        setState((prev) => ({
          ...prev,
          habits: [...prev.habits, habit],
          onboardingComplete: true,
        }));
      } catch {
        Alert.alert('Could not add habit', 'Please try again.');
      }
    },
    [today, activeHabits.length],
  );

  const toggleDay = useCallback(
    (habitId: string, date: string) => {
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
      fire(trpc.habits.toggleDay.mutate({ habitId, date }));
    },
    [fire],
  );

  // Reflection text fires on every keystroke; the local update is immediate but
  // the server write is debounced 500ms per (habitId, date).
  const reflectionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const setReflection = useCallback(
    (habitId: string, date: string, reflection: string) => {
      const clipped = reflection.slice(0, 200);
      setState((prev) => ({
        ...prev,
        dayEntries: prev.dayEntries.map((e) =>
          e.habitId === habitId && e.date === date
            ? { ...e, reflection: clipped }
            : e,
        ),
      }));
      const key = `${habitId}|${date}`;
      const timers = reflectionTimers.current;
      const pending = timers.get(key);
      if (pending) clearTimeout(pending);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          fire(
            trpc.habits.setReflection.mutate({ habitId, date, reflection: clipped }),
          );
        }, 500),
      );
    },
    [fire],
  );

  const saveEveningCheckIn = useCallback(
    (checkIn: EveningCheckIn) => {
      setState((prev) => {
        const filtered = prev.eveningCheckIns.filter(
          (c) => c.date !== checkIn.date,
        );
        return { ...prev, eveningCheckIns: [...filtered, checkIn] };
      });
      fire(trpc.checkins.save.mutate(checkIn));
    },
    [fire],
  );

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

  const saveMissedDay = useCallback(
    (entry: MissedDay) => {
      setState((prev) => {
        const others = (prev.missedDays ?? []).filter(
          (m) => !(m.habitId === entry.habitId && m.date === entry.date),
        );
        return { ...prev, missedDays: [...others, entry] };
      });
      fire(trpc.habits.saveMissedDay.mutate(entry));
    },
    [fire],
  );

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

  const deleteHabit = useCallback(
    (habitId: string) => {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.filter((h) => h.id !== habitId),
        dayEntries: prev.dayEntries.filter((e) => e.habitId !== habitId),
        missedDays: (prev.missedDays ?? []).filter((m) => m.habitId !== habitId),
        weekReviews: prev.weekReviews.filter((r) => r.habitId !== habitId),
      }));
      fire(trpc.habits.remove.mutate({ habitId }));
    },
    [fire],
  );

  const editHabit = useCallback(
    (habitId: string, newName: string) => {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habitId ? { ...h, name: newName } : h,
        ),
      }));
      fire(trpc.habits.rename.mutate({ habitId, name: newName }));
    },
    [fire],
  );

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

  const markPuzzleSolved = useCallback(
    (weekStart: string) => {
      setState((prev) => ({
        ...prev,
        solvedPuzzles: { ...(prev.solvedPuzzles ?? {}), [weekStart]: true },
      }));
      fire(trpc.user.markPuzzleSolved.mutate({ weekStart }));
    },
    [fire],
  );

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
    fire(trpc.dev.fillWeek.mutate({ days: getDaysOfWeek(currentWeekStart) }));
  }, [currentWeekStart, fire]);

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
    fire(
      trpc.dev.clearWeek.mutate({
        days: getDaysOfWeek(currentWeekStart),
        weekStart: currentWeekStart,
      }),
    );
  }, [currentWeekStart, fire]);

  const devTogglePuzzleSolved = useCallback(() => {
    const solved = !isPuzzleSolved(currentWeekStart);
    setState((prev) => {
      const current = !!(prev.solvedPuzzles ?? {})[currentWeekStart];
      const next = { ...(prev.solvedPuzzles ?? {}) };
      if (current) delete next[currentWeekStart];
      else next[currentWeekStart] = true;
      return { ...prev, solvedPuzzles: next };
    });
    fire(trpc.dev.setPuzzleSolved.mutate({ weekStart: currentWeekStart, solved }));
  }, [currentWeekStart, isPuzzleSolved, fire]);

  const devResetAll = useCallback(async () => {
    try {
      await trpc.dev.resetAll.mutate();
      resync();
    } catch {
      Alert.alert('Reset failed', 'Please try again.');
    }
  }, [resync]);

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
