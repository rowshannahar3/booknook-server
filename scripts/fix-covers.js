import dns from "node:dns";
import { MongoClient } from "mongodb";

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()));
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const books = client.db(process.env.MONGODB_DB || "booknook").collection("books");

for (const b of await books.find({ ownerId: "seed" }).toArray()) {
  try {
    const q = new URLSearchParams({ title: b.title, author: b.author, limit: "1", fields: "cover_i" });
    const res = await fetch(`https://openlibrary.org/search.json?${q}`);
    const cover = (await res.json()).docs?.[0]?.cover_i;
    if (cover) {
      await books.updateOne({ _id: b._id }, { $set: { image: `https://covers.openlibrary.org/b/id/${cover}-M.jpg` } });
      console.log("updated:", b.title);
    } else {
      console.log("no cover found:", b.title);
    }
  } catch (err) {
    console.log("failed:", b.title, "-", err.message);
  }
}
await client.close();