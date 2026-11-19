import { ObjectId } from "mongodb";
import { CATEGORIES } from "./config.js";
import { HttpError } from "./middleware/error.js";

export function toObjectId(value, label = "id") {
  if (typeof value !== "string" || !ObjectId.isValid(value) || String(new ObjectId(value)) !== value)
    throw new HttpError(400, `That ${label} isn't valid.`);
  return new ObjectId(value);
}

const isHttpUrl = (v) => {
  try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
};

/** Validates and normalises a book payload. Returns only the fields we accept. */
export function parseBookInput(body = {}) {
  const title = String(body.title ?? "").trim();
  const author = String(body.author ?? "").trim();
  const description = String(body.description ?? "").trim();
  const image = String(body.image ?? "").trim();
  const category = String(body.category ?? "");
  const totalCopies = Number(body.totalCopies);

  if (!title || title.length > 150) throw new HttpError(400, "Please provide a book title (up to 150 characters).");
  if (!author || author.length > 100) throw new HttpError(400, "Please provide the author's name (up to 100 characters).");
  if (!CATEGORIES.includes(category)) throw new HttpError(400, `Category must be one of: ${CATEGORIES.join(", ")}.`);
  if (description.length < 20 || description.length > 1000) throw new HttpError(400, "The description must be 20 to 1000 characters.");
  if (!isHttpUrl(image)) throw new HttpError(400, "Please provide a valid cover image URL.");
  if (!Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 1000)
    throw new HttpError(400, "Total copies must be a whole number between 1 and 1000.");

  return { title, author, category, description, image, totalCopies };
}

export const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
