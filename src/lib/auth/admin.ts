export class AdminAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AdminAuthError";
  }
}

export function requireAdmin(request: Request): void {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!authHeader || !expectedToken) {
    throw new AdminAuthError();
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token || token !== expectedToken) {
    throw new AdminAuthError();
  }
}
