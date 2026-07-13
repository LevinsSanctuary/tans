// One-shot idempotent setup: create each collection with its $jsonSchema
// validator (or collMod an existing one) and ensure indexes.
//
//   pnpm db:setup
//
// Run this once after creating the Atlas cluster and again whenever the
// validators or indexes change — it's safe to re-run.
import { config } from 'dotenv';
config({ path: '.env.local' });

import { MongoClient } from 'mongodb';
import { validators } from './schema';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'tans';

async function main() {
  if (!uri) {
    console.error('MONGODB_URI not set — copy .env.local.example to .env.local first.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to "${dbName}".`);

  for (const [name, validator] of Object.entries(validators)) {
    const exists = await db.listCollections({ name }).hasNext();
    if (exists) {
      await db.command({ collMod: name, validator, validationLevel: 'moderate' });
      console.log(`  collMod  ${name}`);
    } else {
      await db.createCollection(name, { validator, validationLevel: 'moderate' });
      console.log(`  created  ${name}`);
    }
  }

  await db.collection('users').createIndex({ clerkId: 1 }, { unique: true });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('habits').createIndex({ userId: 1 });
  await db.collection('eveningCheckIns').createIndex({ userId: 1, date: 1 }, { unique: true });
  await db.collection('deletedTodos').createIndex({ userId: 1 });
  console.log('  indexes  ensured');

  await client.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
