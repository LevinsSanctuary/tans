import { MongoClient } from 'mongodb';

// A single shared connection promise. In dev, Next's HMR re-evaluates modules on
// every edit, which would otherwise spawn a new pool each time and exhaust
// Atlas's connection limit — so we stash the promise on globalThis.
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set (see .env.local.example)');

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const clientPromise: Promise<MongoClient> =
  process.env.NODE_ENV === 'development'
    ? (globalThis._mongoClientPromise ??= new MongoClient(uri).connect())
    : new MongoClient(uri).connect();

export default clientPromise;
