# BookNook API

Express 5 + MongoDB API for the BookNook online library. Authentication is handled by the Next.js client (BetterAuth); this server only **verifies** the short-lived JWT it issues.

**Live API:** https://YOUR-API.onrender.com  ·  **Client repo:** https://github.com/YOU/booknook-client

## Endpoints (8)

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/books` | public | List books. `?q=` `?category=` `?sort=newest\|oldest\|title` `?limit=` `?mine=1` (token) |
| GET | `/books/:id` | JWT | One book |
| POST | `/books` | JWT | Add a book (owner comes from the token) |
| PATCH | `/books/:id` | JWT, owner | Update a book |
| DELETE | `/books/:id` | JWT, owner | Delete a book (blocked while copies are on loan) |
| GET | `/borrows` | JWT | The signed-in user's loans |
| POST | `/borrows` | JWT | Borrow a book `{ bookId }` |
| DELETE | `/borrows/:id` | JWT | Return a book |

## Challenge features and how they are enforced

- **Available copies:** `availableCopies` is decremented with a conditional atomic update (`availableCopies > 0`) and restored once on return, never above the total.
- **No double borrow:** unique index on `{ userId, bookId }`; duplicates return 409.
- **Race safety:** the loan is claimed first, then the copy is taken; if no copy is left the loan is rolled back.
- **JWT:** every private route verifies signature (JWKS), issuer, audience and expiry; 401 for missing/invalid/expired.
- **Ownership:** edit and delete are filtered by `ownerId` inside the database query; 403 otherwise.
- **Loan period:** 7 days, calculated on the server.

## Run locally

```bash
cp .env.example .env     # fill in the values
npm install
npm run seed             # optional sample books (public-domain titles)
npm run dev
npm test                 # needs .env.test pointing at a separate test database
```
