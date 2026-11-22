import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifies the short-lived JWT issued by BetterAuth (Next.js app).
 * Signing keys are fetched from the app's public JWKS endpoint and cached by jose.
 */
export function createAuth({ jwksUrl, clientUrl }) {
  const jwks = createRemoteJWKSet(new URL(jwksUrl), {
    timeoutDuration: 10_000, // Next.js may still be compiling /api/auth/jwks on the first request
    cooldownDuration: 5_000, // retry sooner if the first fetch failed
    cacheMaxAge: 600_000, // keep the keys for 10 minutes
  });

  async function readUser(req) {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) return null;
    const { payload } = await jwtVerify(token, jwks, { issuer: clientUrl, audience: clientUrl });
    return { id: payload.sub, name: payload.name ?? "Reader", email: payload.email ?? "", image: payload.image ?? null };
  }

  /** 401 when the token is missing, invalid, or expired. */
  async function requireAuth(req, res, next) {
    try {
      const user = await readUser(req);
      if (!user?.id) return res.status(401).json({ message: "Please sign in to continue." });
      req.user = user;
      next();
    } catch (err) {
      const expired = err?.code === "ERR_JWT_EXPIRED";
      // Print the real reason in the server terminal (for example ERR_JWKS_TIMEOUT or ERR_JWT_CLAIM_VALIDATION_FAILED).
      if (!expired) console.warn("JWT check failed:", err?.code ?? err?.message);
      res.status(401).json({ message: expired ? "Your session has expired. Please sign in again." : "Invalid sign-in token." });
    }
  }

  return { requireAuth, readUser };
}