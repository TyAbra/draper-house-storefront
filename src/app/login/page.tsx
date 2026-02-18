import { redirect } from "next/navigation";

import LoginForm from "@/app/login/login-form";
import { isAppAuthenticated } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await isAppAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <section className="w-full rounded-2xl border border-[rgba(176,141,87,0.2)] bg-[rgba(255,255,255,0.72)] p-6 shadow-sm backdrop-blur-sm">
        <h1 className="dh-serif text-3xl text-[var(--dh-wood)]">Draper House Inventory</h1>
        <p className="mt-2 text-sm text-[rgba(110,123,85,0.9)]">Private access for inventory capture.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
