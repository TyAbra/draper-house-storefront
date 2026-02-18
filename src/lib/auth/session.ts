import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE_NAME = "draperhouse_inventory_session";
const SESSION_COOKIE_VALUE = "authenticated";

function getLoginPassword(): string {
  const password = process.env.APP_LOGIN_PASSWORD ?? process.env.ADMIN_TOKEN;

  if (!password) {
    throw new Error("APP_LOGIN_PASSWORD (or ADMIN_TOKEN fallback) must be configured");
  }

  return password;
}

export function validateLoginPassword(input: string): boolean {
  return input === getLoginPassword();
}

export async function setAuthenticatedSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAuthenticatedSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAppAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value === SESSION_COOKIE_VALUE;
}

export async function requireAppAuthenticated(): Promise<void> {
  const authenticated = await isAppAuthenticated();
  if (!authenticated) {
    redirect("/login");
  }
}
