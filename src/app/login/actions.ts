"use server";

import { redirect } from "next/navigation";

import {
  clearAuthenticatedSession,
  setAuthenticatedSession,
  validateLoginPassword,
} from "@/lib/auth/session";

export type LoginState = {
  error: string | null;
};

const INITIAL_LOGIN_STATE: LoginState = {
  error: null,
};

export async function loginAction(
  prevState: LoginState = INITIAL_LOGIN_STATE,
  formData: FormData,
): Promise<LoginState> {
  void prevState;

  const password = String(formData.get("password") ?? "").trim();

  if (!password) {
    return { error: "Password is required" };
  }

  if (!validateLoginPassword(password)) {
    return { error: "Invalid password" };
  }

  await setAuthenticatedSession();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearAuthenticatedSession();
  redirect("/login");
}
