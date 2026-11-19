const required = ["MONGODB_URI", "CLIENT_URL", "JWKS_URL"];

export function loadConfig() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  return {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB || "booknook",
    // The Next.js site: allowed CORS origin, and the issuer/audience BetterAuth puts in the JWT.
    clientUrl: process.env.CLIENT_URL.replace(/\/$/, ""),
    jwksUrl: process.env.JWKS_URL,
  };
}

export const CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];
export const LOAN_DAYS = 7;
