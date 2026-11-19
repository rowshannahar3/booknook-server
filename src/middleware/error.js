export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req, res) {
  res.status(404).json({ message: "Route not found." });
}

// Express 5 forwards rejected promises from async handlers here automatically.
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body." });
  console.error(err);
  res.status(500).json({ message: "Something went wrong on our side. Please try again." });
}
