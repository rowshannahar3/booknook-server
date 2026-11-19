import { MongoClient } from "mongodb";

let client;
let db;

export async function connectDb({ mongoUri, dbName }) {
  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db(dbName);

  // Indexes are the safety net behind the challenge requirements.
  await db.collection("books").createIndex({ addedAt: -1 });
  await db.collection("books").createIndex({ ownerId: 1 });
  // One active loan per user per book, enforced by the database even for simultaneous requests.
  await db.collection("borrows").createIndex({ userId: 1, bookId: 1 }, { unique: true });
  await db.collection("borrows").createIndex({ bookId: 1 });
  return db;
}

export const books = () => db.collection("books");
export const borrows = () => db.collection("borrows");

export async function closeDb() {
  await client?.close();
}
