import { z } from 'zod';
import type { WithId } from 'mongodb';
import type { HabitDoc, UserDoc, EveningCheckInDoc } from '../db/collections';

// Local-day date string (YYYY-MM-DD). All date-bearing inputs come FROM the
// client so we keep the app's local-time semantics — the server never computes
// "today" (its clock is UTC).
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

// Non-crypto v4 uuid for embedded todo ids (fine for app-local ids).
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- DTO mappers: ObjectId -> string `id`, drop server-only fields, so the
// wire shape matches the RN app's lib/types.ts. ---

export function habitDTO(h: WithId<HabitDoc>) {
  return {
    id: h._id.toString(),
    name: h.name,
    createdAt: h.createdAt,
    active: h.active,
    graduatedAt: h.graduatedAt,
    holiday: h.holiday,
    entries: h.entries,
    missedDays: h.missedDays,
  };
}

export function userDTO(u: WithId<UserDoc>) {
  return {
    id: u._id.toString(),
    email: u.email,
    createdAt: u.createdAt,
    onboardingComplete: u.onboardingComplete,
    solvedPuzzles: u.solvedPuzzles,
    settings: u.settings,
    todoMeta: u.todoMeta,
    todos: u.todos,
  };
}

export function checkinDTO(c: WithId<EveningCheckInDoc>) {
  return {
    date: c.date,
    likelihoodScore: c.likelihoodScore,
    nextHabitIdea: c.nextHabitIdea,
  };
}
