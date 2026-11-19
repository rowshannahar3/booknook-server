// Seeds sample public-domain books. Run: npm run seed  (safe to re-run; it skips existing titles)
import dns from "node:dns";

// Same workaround as src/index.js: some networks refuse the SRV lookup.
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

import { MongoClient } from "mongodb";

const cover = (id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;

const SAMPLE = [
  ["Pride and Prejudice", "Jane Austen", "Fiction", 1342, "Elizabeth Bennet and Mr Darcy navigate manners, money, and first impressions in Regency England.", 3],
  ["Frankenstein", "Mary Shelley", "Fiction", 84, "A young scientist creates life and must face the consequences of his ambition in this Gothic classic.", 2],
  ["Dracula", "Bram Stoker", "Fiction", 345, "A band of friends races to stop a centuries-old count from spreading his curse across Victorian England.", 2],
  ["Alice's Adventures in Wonderland", "Lewis Carroll", "Kids", 11, "Alice tumbles down a rabbit hole into a world of riddles, tea parties, and a very strange queen.", 4],
  ["The Wonderful Wizard of Oz", "L. Frank Baum", "Kids", 55, "A Kansas girl and her dog are swept away to a land of witches, scarecrows, and a mysterious wizard.", 3],
  ["Peter Pan", "J. M. Barrie", "Kids", 16, "Three children fly to Neverland with a boy who refuses to grow up, and meet pirates and fairies.", 2],
  ["Moby-Dick", "Herman Melville", "Fiction", 2701, "Captain Ahab's obsessive hunt for the white whale becomes a sweeping story of the sea and of fate.", 1],
  ["The Time Machine", "H. G. Wells", "Science", 35, "A Victorian inventor travels to the far future and discovers what has become of humankind.", 3],
  ["On the Origin of Species", "Charles Darwin", "Science", 1228, "Darwin lays out his theory of evolution by natural selection, with evidence gathered across years of study.", 2],
  ["Relativity: The Special and General Theory", "Albert Einstein", "Science", 5001, "Einstein explains his theories of relativity for general readers, with little mathematics required.", 2],
  ["The Art of War", "Sun Tzu", "History", 132, "An ancient Chinese treatise on strategy, discipline, and winning without unnecessary conflict.", 3],
  ["A Tale of Two Cities", "Charles Dickens", "History", 98, "Love and sacrifice unfold in London and Paris during the turmoil of the French Revolution.", 2],
  ["Meditations", "Marcus Aurelius", "Others", 2680, "Private notes from a Roman emperor on duty, resilience, and living well, still read widely today.", 4],
  ["Treasure Island", "Robert Louis Stevenson", "Fiction", 120, "Young Jim Hawkins joins a voyage to find buried pirate gold and learns who can be trusted.", 3],
];

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const books = client.db(process.env.MONGODB_DB || "booknook").collection("books");

let added = 0;
const now = Date.now();
for (const [i, [title, author, category, gid, description, total]] of SAMPLE.entries()) {
  if (await books.findOne({ title })) continue;
  await books.insertOne({
    title, author, category, description,
    image: cover(gid),
    totalCopies: total,
    availableCopies: total,
    ownerId: "seed",
    ownerName: "BookNook Library",
    ownerEmail: "library@booknook.example",
    addedAt: new Date(now - i * 3_600_000), // spread out so "newest first" looks natural
  });
  added++;
}
console.log(`Seeded ${added} book(s).`);
await client.close();
