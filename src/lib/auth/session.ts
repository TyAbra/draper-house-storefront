import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE_NAME = "draperhouse_inventory_session";

// SESSION_SECRET must be a long random string (32+ chars).
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured and at least 32 characters");
  }
  return secret;
}

export function getLoginPassword(): string {
  const password = process.env.APP_LOGIN_PASSWORD;
  if (!password) {
    throw new Error("APP_LOGIN_PASSWORD must be configured");
  }
  return password;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeEquals(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) {
      // Still run the comparison against itself to keep timing consistent
      timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export function validateLoginPassword(input: string): boolean {
  return safeEquals(input, getLoginPassword());
}

/**
 * Sign a token with HMAC-SHA256 using SESSION_SECRET.
 * Returns "token.signature" format.
 */
function signToken(token: string): string {
  const secret = getSessionSecret();
  const sig = createHmac("sha256", secret).update(token).digest("hex");
  return `${token}.${sig}`;
}

/**
 * Verify a signed session cookie value.
 * Expects "token.signature" — re-computes HMAC and compares with timingSafeEqual.
 */
function verifySignedCookie(value: string): boolean {
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const token = value.slice(0, dotIndex);
  const providedSig = value.slice(dotIndex + 1);

  if (!token || !providedSig) return false;

  const secret = getSessionSecret();
  const expectedSig = createHmac("sha256", secret).update(token).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}

export async function setAuthenticatedSession(): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const signed = signToken(token);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearAuthenticatedSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAppAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return false;

  try {
    return verifySignedCookie(cookie.value);
  } catch {
    return false;
  }
}

export async function requireAppAuthenticated(): Promise<void> {
  const authenticated = await isAppAuthenticated();
  if (!authenticated) {
    redirect("/login");
  }
}
