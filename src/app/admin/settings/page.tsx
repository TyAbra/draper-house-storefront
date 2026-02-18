import { logoutAction } from "@/app/login/actions";

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <section className="space-y-4 pb-24">
        <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Settings</h2>
        <p className="text-base text-[rgba(110,123,85,0.9)]">Manage your private inventory app session.</p>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--dh-walnut)] px-4 py-4 text-base font-medium text-white transition hover:bg-[var(--dh-wood)]"
          >
            Logout
          </button>
        </form>
      </section>
    </main>
  );
}
