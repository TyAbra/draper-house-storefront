import { timingSafeEqual } from "crypto";

export class AdminAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AdminAuthError";
  }
}

/**
 * Constant-time token comparison to prevent timing-based token discovery.
 */
function safeTokenEquals(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
      timingSafeEqual(a, a); // keep timing consistent
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request): void {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!authHeader || !expectedToken) {
    throw new AdminAuthError();
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    throw new AdminAuthError();
  }

  if (!safeTokenEquals(parts[1], expectedToken)) {
    throw new AdminAuthError();
  }
}
