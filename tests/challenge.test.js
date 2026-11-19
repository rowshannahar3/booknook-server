// Challenge-feature tests. Needs a MongoDB test database (use a separate DB name!).
// Run:  npm test      (reads .env.test)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const CLIENT_URL = "http://localhost:3000";
const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA", use: "sig" };

// A tiny JWKS server stands in for the Next.js app.
const jwksServer = http.createServer((_req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ keys: [jwk] }));
});
await new Promise((r) => jwksServer.listen(0, r));
process.env.JWKS_URL = `http://localhost:${jwksServer.address().port}/jwks`;
process.env.CLIENT_URL = CLIENT_URL;
process.env.MONGODB_DB ||= "booknook_test";

const { loadConfig } = await import("../src/config.js");
const { connectDb, closeDb, books, borrows } = await import("../src/db.js");
const { createApp } = await import("../src/app.js");

const config = loadConfig();
let server, base;

const token = (id, extra = {}, exp = "10m") =>
  new SignJWT({ name: `User ${id}`, email: `${id}@test.dev`, ...extra })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setSubject(id).setIssuer(CLIENT_URL).setAudience(CLIENT_URL).setIssuedAt().setExpirationTime(exp)
    .sign(privateKey);

async function call(method, path, { as, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (as) headers.authorization = `Bearer ${await token(as)}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const newBook = (over = {}) => ({
  title: "Test Book", author: "Tester", category: "Fiction", totalCopies: 1,
  image: "https://example.com/c.jpg", description: "A book used only for automated tests.", ...over,
});

before(async () => {
  await connectDb(config);
  await books().deleteMany({}); await borrows().deleteMany({});
  server = createApp(config).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(async () => { server.close(); jwksServer.close(); await closeDb(); });

test("protected routes reject missing, invalid and expired tokens (401)", async () => {
  assert.equal((await call("GET", "/borrows")).status, 401);
  const bad = await fetch(`${base}/borrows`, { headers: { authorization: "Bearer not-a-jwt" } });
  assert.equal(bad.status, 401);
  const expired = await fetch(`${base}/borrows`, { headers: { authorization: `Bearer ${await token("a", {}, "-1m")}` } });
  assert.equal(expired.status, 401);
});

test("only the owner can edit or delete a book (403)", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook() });
  assert.equal((await call("PATCH", `/books/${book._id}`, { as: "intruder", body: newBook({ title: "Hacked" }) })).status, 403);
  assert.equal((await call("DELETE", `/books/${book._id}`, { as: "intruder" })).status, 403);
});

test("borrowing the last copy sets available to 0 and blocks the next borrower (409)", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook({ title: "Last Copy" }) });
  assert.equal((await call("POST", "/borrows", { as: "u1", body: { bookId: book._id } })).status, 201);
  assert.equal((await call("GET", `/books/${book._id}`, { as: "u1" })).json.availableCopies, 0);
  assert.equal((await call("POST", "/borrows", { as: "u2", body: { bookId: book._id } })).status, 409);
});

test("the same user cannot borrow the same book twice (409)", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook({ title: "Twice", totalCopies: 3 }) });
  assert.equal((await call("POST", "/borrows", { as: "u1", body: { bookId: book._id } })).status, 201);
  assert.equal((await call("POST", "/borrows", { as: "u1", body: { bookId: book._id } })).status, 409);
  assert.equal((await call("GET", `/books/${book._id}`, { as: "u1" })).json.availableCopies, 2);
});

test("two simultaneous borrows of the last copy: exactly one succeeds", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook({ title: "Race" }) });
  const results = await Promise.all(["r1", "r2", "r3", "r4"].map((u) => call("POST", "/borrows", { as: u, body: { bookId: book._id } })));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal((await call("GET", `/books/${book._id}`, { as: "r1" })).json.availableCopies, 0);
});

test("returning twice restores stock only once", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook({ title: "Return", totalCopies: 2 }) });
  const { json: loan } = await call("POST", "/borrows", { as: "u1", body: { bookId: book._id } });
  assert.equal((await call("DELETE", `/borrows/${loan._id}`, { as: "u1" })).status, 200);
  assert.equal((await call("DELETE", `/borrows/${loan._id}`, { as: "u1" })).status, 404);
  assert.equal((await call("GET", `/books/${book._id}`, { as: "u1" })).json.availableCopies, 2);
});

test("total copies cannot drop below copies on loan; deleting a loaned book is blocked", async () => {
  const { json: book } = await call("POST", "/books", { as: "owner", body: newBook({ title: "Loaned", totalCopies: 3 }) });
  await call("POST", "/borrows", { as: "u1", body: { bookId: book._id } });
  await call("POST", "/borrows", { as: "u2", body: { bookId: book._id } });
  assert.equal((await call("PATCH", `/books/${book._id}`, { as: "owner", body: newBook({ title: "Loaned", totalCopies: 1 }) })).status, 409);
  const ok = await call("PATCH", `/books/${book._id}`, { as: "owner", body: newBook({ title: "Loaned", totalCopies: 5 }) });
  assert.equal(ok.json.availableCopies, 3); // 5 total - 2 on loan
  assert.equal((await call("DELETE", `/books/${book._id}`, { as: "owner" })).status, 409);
});
