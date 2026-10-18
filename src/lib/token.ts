import { unauthorized } from "./http-error.js";

// PLACEHOLDER until the login/session strategy from Dev 1 (Raphael) lands.
// Replace the body with real token verification and return the user id the
// token was issued for. Nothing else in the codebase needs to change:
// requireAuth in middlewares/auth.ts is the only caller.
export type TokenVerifier = (token: string) => Promise<{ userId: string }>;

let verifier: TokenVerifier = async () => {
  throw unauthorized("Token verification is not configured");
};

// Lets tests (and the real auth module at startup) plug in a verifier.
export function setTokenVerifier(fn: TokenVerifier): void {
  verifier = fn;
}

export function verifyAccessToken(token: string): Promise<{ userId: string }> {
  return verifier(token);
}
