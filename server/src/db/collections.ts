import type { ObjectId } from 'mongodb';
import clientPromise from './client';

// Document interfaces are declared WITHOUT `_id` — the driver's `WithId<T>`
// adds it on reads, and `insertOne` accepts docs without it. `userId` is a
// normal ObjectId field (a reference to the owning user's _id).

export type MissedBadge = 'rest' | 'overwhelmed' | 'forgot' | 'unwell' | 'busy' | 'low-energy';
export type MissedKind = 'badge' | 'achievement';
export type TodoStatus = 'open' | 'started' | 'completed';

export interface HabitEntry {
  date: string;
  completed: boolean;
  reflection: string;
}

export interface HabitMissedDay {
  date: string;
  kind: MissedKind;
  badge?: MissedBadge;
  achievement?: string;
}

export interface HabitDoc {
  userId: ObjectId;
  name: string;
  createdAt: string;
  active: boolean;
  graduatedAt?: string;
  holiday?: { startDate: string; days: number };
  entries: HabitEntry[];
  missedDays: HabitMissedDay[];
}

export interface TodoSub {
  id: string;
  text: string;
  status: TodoStatus;
  createdAt: string;
  completedAt?: string;
  penaltyApplied?: boolean;
  history: { at: string; from: TodoStatus; to: TodoStatus }[];
}

export interface TodoMeta {
  slotCount: number;
  lastRollover?: string;
  penaltyPieces: number;
  penaltyWeekStart?: string;
}

export interface UserDoc {
  clerkId: string;
  email: string;
  createdAt: string;
  onboardingComplete: boolean;
  solvedPuzzles: Record<string, boolean>;
  settings?: { notificationTimes?: { morning: string; evening: string } };
  todoMeta: TodoMeta;
  todos: TodoSub[];
}

export interface EveningCheckInDoc {
  userId: ObjectId;
  date: string;
  likelihoodScore: number;
  nextHabitIdea: string;
}

export interface DeletedTodoDoc {
  userId: ObjectId;
  text: string;
  reason: string;
  deletedAt: string;
  createdAt: string;
}

export async function collections() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB || 'tans');
  return {
    users: db.collection<UserDoc>('users'),
    habits: db.collection<HabitDoc>('habits'),
    eveningCheckIns: db.collection<EveningCheckInDoc>('eveningCheckIns'),
    deletedTodos: db.collection<DeletedTodoDoc>('deletedTodos'),
  };
}

export type Collections = Awaited<ReturnType<typeof collections>>;
