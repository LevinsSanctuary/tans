export interface Habit {
  id: string;
  name: string;
  createdAt: string;
  active: boolean;
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
