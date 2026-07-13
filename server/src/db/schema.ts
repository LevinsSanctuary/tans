// MongoDB $jsonSchema validators for the four tans collections.
//
// Modeling recap (why these four):
//   users            — bounded, read-on-open. Embeds the small/bounded things:
//                      solvedPuzzles (map), todoMeta (singleton), todos (<=10).
//   habits           — one doc per habit. Embeds entries[] + missedDays[]
//                      (same grain, always read together with the habit).
//   eveningCheckIns  — own collection: unbounded (1/day), NOT tied to a habit.
//   deletedTodos     — own collection: append-only audit log, unbounded.
//
// GOTCHA baked in below: JS numbers serialize to BSON `double` by default, so a
// validator that demands bsonType `int` REJECTS values the driver writes. We
// use bsonType `number` (the alias matching int/long/double/decimal) for every
// numeric field and enforce integer-ness / ranges in the tRPC input layer (zod).

const DATE = '^\\d{4}-\\d{2}-\\d{2}$'; // YYYY-MM-DD (local-day strings, not BSON Date)

const MISSED_BADGES = ['rest', 'overwhelmed', 'forgot', 'unwell', 'busy', 'low-energy'];

export const usersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['clerkId', 'email', 'createdAt', 'onboardingComplete', 'solvedPuzzles', 'todoMeta', 'todos'],
    properties: {
      clerkId: { bsonType: 'string' }, // Clerk user id (user_xxx); the identity of record
      email: { bsonType: 'string' },
      createdAt: { bsonType: 'string', pattern: DATE },
      onboardingComplete: { bsonType: 'bool' },
      solvedPuzzles: {
        bsonType: 'object',
        additionalProperties: { bsonType: 'bool' }, // weekStart -> true
      },
      settings: {
        bsonType: 'object',
        properties: {
          notificationTimes: {
            bsonType: 'object',
            properties: {
              morning: { bsonType: 'string' },
              evening: { bsonType: 'string' },
            },
          },
        },
      },
      todoMeta: {
        bsonType: 'object',
        required: ['slotCount', 'penaltyPieces'],
        properties: {
          slotCount: { bsonType: 'number', minimum: 1, maximum: 10 },
          lastRollover: { bsonType: 'string', pattern: DATE },
          penaltyPieces: { bsonType: 'number', minimum: 0 },
          penaltyWeekStart: { bsonType: 'string', pattern: DATE },
        },
      },
      todos: {
        bsonType: 'array',
        maxItems: 10,
        items: {
          bsonType: 'object',
          required: ['id', 'text', 'status', 'createdAt', 'history'],
          properties: {
            id: { bsonType: 'string' },
            text: { bsonType: 'string' },
            status: { enum: ['open', 'started', 'completed'] },
            createdAt: { bsonType: 'string', pattern: DATE },
            completedAt: { bsonType: 'string', pattern: DATE },
            penaltyApplied: { bsonType: 'bool' },
            history: { bsonType: 'array', items: { bsonType: 'object' } },
          },
        },
      },
    },
  },
};

export const habitsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'name', 'createdAt', 'active', 'entries', 'missedDays'],
    properties: {
      userId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 1 },
      createdAt: { bsonType: 'string', pattern: DATE },
      active: { bsonType: 'bool' },
      graduatedAt: { bsonType: 'string', pattern: DATE },
      holiday: {
        bsonType: 'object',
        required: ['startDate', 'days'],
        properties: {
          startDate: { bsonType: 'string', pattern: DATE },
          days: { bsonType: 'number', minimum: 1, maximum: 7 },
        },
      },
      entries: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['date', 'completed'],
          properties: {
            date: { bsonType: 'string', pattern: DATE },
            completed: { bsonType: 'bool' },
            reflection: { bsonType: 'string', maxLength: 200 },
          },
        },
      },
      missedDays: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['date', 'kind'],
          properties: {
            date: { bsonType: 'string', pattern: DATE },
            kind: { enum: ['badge', 'achievement'] },
            badge: { enum: MISSED_BADGES },
            achievement: { bsonType: 'string' },
          },
        },
      },
    },
  },
};

export const eveningCheckInsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'date', 'likelihoodScore', 'nextHabitIdea'],
    properties: {
      userId: { bsonType: 'objectId' },
      date: { bsonType: 'string', pattern: DATE },
      likelihoodScore: { bsonType: 'number', minimum: 1, maximum: 10 },
      nextHabitIdea: { bsonType: 'string' },
    },
  },
};

export const deletedTodosValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'text', 'reason', 'deletedAt', 'createdAt'],
    properties: {
      userId: { bsonType: 'objectId' },
      text: { bsonType: 'string' },
      reason: { bsonType: 'string', minLength: 20 }, // future-you should know why
      deletedAt: { bsonType: 'string', pattern: DATE },
      createdAt: { bsonType: 'string', pattern: DATE },
    },
  },
};

export const validators = {
  users: usersValidator,
  habits: habitsValidator,
  eveningCheckIns: eveningCheckInsValidator,
  deletedTodos: deletedTodosValidator,
} as const;
