import { Router } from "express";
import { books } from "../db.js";
import { HttpError } from "../middleware/error.js";
import { CATEGORIES } from "../config.js";
import { escapeRegExp, parseBookInput, toObjectId } from "../validate.js";

const SORTS = { newest: { addedAt: -1 }, oldest: { addedAt: 1 }, title: { title: 1 } };

export function booksRouter({ requireAuth, readUser }) {
  const router = Router();

  // GET /books  (public) — ?q=&category=&sort=&limit=  and  ?mine=1 (needs a token)
  router.get("/", async (req, res) => {
    const { q, category, sort = "newest", mine } = req.query;
    const filter = {};

    if (typeof q === "string" && q.trim()) {
      const rx = new RegExp(escapeRegExp(q.trim().slice(0, 60)), "i");
      filter.$or = [{ title: rx }, { author: rx }];
    }
    if (typeof category === "string" && category) {
      if (!CATEGORIES.includes(category)) throw new HttpError(400, "Unknown category.");
      filter.category = category;
    }
    if (mine === "1") {
      const user = await readUser(req).catch(() => null);
      if (!user) throw new HttpError(401, "Please sign in to see your books.");
      filter.ownerId = user.id;
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 100);

    const list = await books().find(filter).sort(SORTS[sort] ?? SORTS.newest).limit(limit).toArray();
    res.json(list);
  });

  // GET /books/:id  (private)
  router.get("/:id", requireAuth, async (req, res) => {
    const _id = toObjectId(req.params.id, "book id");
    const book = await books().findOne({ _id });
    if (!book) throw new HttpError(404, "We couldn't find that book.");
    res.json(book);
  });

  // POST /books  (private) — owner details come from the verified token, never from the body
  router.post("/", requireAuth, async (req, res) => {
    const input = parseBookInput(req.body);
    const doc = {
      ...input,
      availableCopies: input.totalCopies,
      ownerId: req.user.id,
      ownerName: req.user.name,
      ownerEmail: req.user.email,
      addedAt: new Date(),
    };
    const { insertedId } = await books().insertOne(doc);
    res.status(201).json({ ...doc, _id: insertedId });
  });

  // PATCH /books/:id  (private, owner only)
  router.patch("/:id", requireAuth, async (req, res) => {
    const _id = toObjectId(req.params.id, "book id");
    const input = parseBookInput(req.body);
    const { totalCopies, ...fields } = input;

    // One atomic update: only the owner, and only if the new total still covers the copies on loan.
    // availableCopies shifts by the same difference so inventory stays consistent.
    const updated = await books().findOneAndUpdate(
      {
        _id,
        ownerId: req.user.id,
        $expr: { $gte: [totalCopies, { $subtract: ["$totalCopies", "$availableCopies"] }] },
      },
      [
        {
          $set: {
            ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { $literal: v }])),
            availableCopies: { $subtract: [totalCopies, { $subtract: ["$totalCopies", "$availableCopies"] }] },
            totalCopies,
          },
        },
      ],
      { returnDocument: "after" },
    );
    if (updated) return res.json(updated);

    // Work out why it failed so the message is useful.
    const existing = await books().findOne({ _id });
    if (!existing) throw new HttpError(404, "We couldn't find that book.");
    if (existing.ownerId !== req.user.id) throw new HttpError(403, "You can only edit books that you added.");
    throw new HttpError(409, "Total copies can't be lower than the number currently on loan.");
  });

  // DELETE /books/:id  (private, owner only, blocked while copies are on loan)
  router.delete("/:id", requireAuth, async (req, res) => {
    const _id = toObjectId(req.params.id, "book id");
    const result = await books().deleteOne({
      _id,
      ownerId: req.user.id,
      $expr: { $eq: ["$totalCopies", "$availableCopies"] }, // nothing on loan
    });
    if (result.deletedCount) return res.json({ message: "Book removed." });

    const existing = await books().findOne({ _id });
    if (!existing) throw new HttpError(404, "We couldn't find that book.");
    if (existing.ownerId !== req.user.id) throw new HttpError(403, "You can only delete books that you added.");
    throw new HttpError(409, "This book is on loan right now, so it can't be removed yet.");
  });

  return router;
}
