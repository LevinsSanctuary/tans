export interface HabitHoliday {
  // First paused day, inclusive (YYYY-MM-DD, local).
  startDate: string;
  // Number of paused days, 1..7. Days 4-7 are the "danger zone".
  days: number;
}

export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  active: boolean;
  // Set when a habit completes 9 consecutive full weeks (63 days) and moves
  // to the permanent habit box. Once set, the habit is no longer `active`.
  graduatedAt?: string;
  // An active per-habit holiday hold (counting paused). Cleared when expired.
  holiday?: HabitHoliday;
}

export interface DayEntry {
  date: string;
  habitId: string;
  completed: boolean;
  reflection: string;
}

export type MissedKind = 'badge' | 'achievement';
export type MissedBadge =
  | 'rest'
  | 'overwhelmed'
  | 'forgot'
  | 'unwell'
  | 'busy'
  | 'low-energy';

export interface MissedDay {
  date: string;
  habitId: string;
  kind: MissedKind;
  badge?: MissedBadge;
  achievement?: string;
}

export interface EveningCheckIn {
  date: string;
  likelihoodScore: number;
  nextHabitIdea: string;
}

export interface WeekReview {
  weekStartDate: string;
  habitId: string;
  allDaysCompleted: boolean;
  eveningCheckIns: EveningCheckIn[];
  chosenNextHabit: string | null;
}

export interface AppState {
  habits: Habit[];
  dayEntries: DayEntry[];
  eveningCheckIns: EveningCheckIn[];
  weekReviews: WeekReview[];
  onboardingComplete: boolean;
  missedDays?: MissedDay[];
  // Map of weekStart (YYYY-MM-DD, Monday) -> true once the tangram assembly
  // puzzle has been solved for that week.
  solvedPuzzles?: Record<string, boolean>;
}

// --- To-do list (a separate, lightweight domain stored under its own key) ---

export type TodoStatus = 'open' | 'started' | 'completed';

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
  createdAt: string; // YYYY-MM-DD
  completedAt?: string;
  // True once a stale item has already cost a tangram piece (so it's only
  // deducted once).
  penaltyApplied?: boolean;
  history: { at: string; from: TodoStatus; to: TodoStatus }[];
}

export interface DeletedTodo {
  id: string;
  text: string;
  reason: string; // >= 20 chars — future-you should know why you let it go
  deletedAt: string;
  createdAt: string;
}

export interface TodoState {
  items: TodoItem[];
  deleted: DeletedTodo[];
  slotCount: number; // 5 free, 1-10 pro
  // Date the daily rollover was last run, YYYY-MM-DD.
  lastRollover?: string;
  // Tangram pieces taken away by stale items this week.
  penaltyPieces: number;
  // ISO week-start the penalty counter applies to.
  penaltyWeekStart?: string;
}
