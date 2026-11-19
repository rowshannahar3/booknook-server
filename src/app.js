import express from "express";
import cors from "cors";
import { createAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { booksRouter } from "./routes/books.js";
import { borrowsRouter } from "./routes/borrows.js";

export function createApp(config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.clientUrl, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "Authorization"] }));
  app.use(express.json({ limit: "100kb" }));

  const auth = createAuth(config);

  // Health check for the host (not part of the 8 API routes).
  app.get("/", (_req, res) => res.json({ ok: true, name: "BookNook API" }));

  app.use("/books", booksRouter(auth));
  app.use("/borrows", borrowsRouter(auth));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
