import { Router } from "express";
import { books, borrows } from "../db.js";
import { HttpError } from "../middleware/error.js";
import { LOAN_DAYS } from "../config.js";
import { toObjectId } from "../validate.js";

export function borrowsRouter({ requireAuth }) {
  const router = Router();

  // GET /borrows  (private) — the signed-in user's loans
  router.get("/", requireAuth, async (req, res) => {
    res.json(await borrows().find({ userId: req.user.id }).sort({ borrowDate: -1 }).toArray());
  });

  // POST /borrows  (private) — body: { bookId }
  router.post("/", requireAuth, async (req, res) => {
    const bookId = toObjectId(req.body?.bookId, "book id");
    const book = await books().findOne({ _id: bookId });
    if (!book) throw new HttpError(404, "We couldn't find that book.");

    const borrowDate = new Date();
    const loan = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      borrowDate,
      returnDate: new Date(borrowDate.getTime() + LOAN_DAYS * 86_400_000), // always set by the server
    };

    // 1) Claim the loan. The unique { userId, bookId } index rejects a second active loan,
    //    even when two requests arrive at the same instant.
    let insertedId;
    try {
      ({ insertedId } = await borrows().insertOne(loan));
    } catch (err) {
      if (err?.code === 11000) throw new HttpError(409, "You already have this book on loan. Return it before borrowing again.");
      throw err;
    }

    // 2) Take one copy, but only if one is left. The condition makes the decrement atomic.
    const taken = await books().findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
    );
    if (!taken) {
      await borrows().deleteOne({ _id: insertedId }); // roll the claim back
      throw new HttpError(409, "Sorry, no copies of this book are available right now.");
    }
    res.status(201).json({ ...loan, _id: insertedId });
  });

  // DELETE /borrows/:id  (private) — return a book
  router.delete("/:id", requireAuth, async (req, res) => {
    // Atomic find-and-delete scoped to the caller: a repeated return finds nothing and changes nothing.
    const loan = await borrows().findOneAndDelete({ _id: toObjectId(req.params.id, "loan id"), userId: req.user.id });
    if (!loan) throw new HttpError(404, "We couldn't find that loan. It may already have been returned.");

    // Give the copy back, never beyond the total.
    await books().updateOne(
      { _id: loan.bookId, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
      { $inc: { availableCopies: 1 } },
    );
    res.json({ message: "Book returned." });
  });

  return router;
}
