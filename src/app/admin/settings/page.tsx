import { logoutAction } from "@/app/login/actions";

const LIFECYCLE_STAGES = [
  {
    label: "Draft",
    color: "bg-[rgba(176,141,87,0.12)] text-[rgba(176,141,87,0.75)]",
    description: "Item added but not yet ready to list. Edit details and add photos.",
  },
  {
    label: "Ready",
    color: "bg-[rgba(176,141,87,0.25)] text-[var(--dh-brass)]",
    description: "Item is prepped and queued. Confirm before publishing live.",
  },
  {
    label: "Listed",
    color: "bg-[rgba(110,123,85,0.2)] text-[var(--dh-olive)]",
    description: "Item is live and available for sale.",
  },
  {
    label: "Sold",
    color: "bg-[rgba(195,107,78,0.2)] text-[var(--dh-terracotta)]",
    description: "Item sold. Record is locked — no further changes.",
  },
] as const;

const CONDITION_GRADES = ["Excellent", "Very Good", "Good", "Fair", "Poor", "As-Is"] as const;

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <section className="space-y-6 pb-24">
        <header className="space-y-1">
          <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Settings</h2>
          <p className="text-base text-[rgba(110,123,85,0.9)]">App reference and session management.</p>
        </header>

        {/* ── Lifecycle Reference ── */}
        <section className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">
            Item Lifecycle
          </h3>
          <div className="space-y-2">
            {LIFECYCLE_STAGES.map(({ label, color, description }) => (
              <div key={label} className="flex items-start gap-3">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-1 text-xs font-medium ${color}`}>
                  {label}
                </span>
                <p className="text-sm text-[rgba(110,123,85,0.9)]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Condition Grades Reference ── */}
        <section className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">
            Condition Grades
          </h3>
          <div className="flex flex-wrap gap-2">
            {CONDITION_GRADES.map((grade) => (
              <span
                key={grade}
                className="rounded-full bg-[rgba(176,141,87,0.15)] px-3 py-1 text-sm text-[var(--dh-wood)]"
              >
                {grade}
              </span>
            ))}
          </div>
          <p className="text-xs text-[rgba(110,123,85,0.7)]">
            Use these standard grades consistently so condition data stays sortable and searchable over time.
          </p>
        </section>

        {/* ── Security ── */}
        <section className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">
            Security
          </h3>
          <p className="text-sm text-[rgba(110,123,85,0.9)]">
            Login password and session secret are set via environment variables in{" "}
            <code className="rounded bg-[rgba(176,141,87,0.15)] px-1 py-0.5 text-xs">.env.local</code>.
            To change your password, update{" "}
            <code className="rounded bg-[rgba(176,141,87,0.15)] px-1 py-0.5 text-xs">APP_LOGIN_PASSWORD</code>{" "}
            and restart the server.
          </p>
        </section>

        {/* ── Session ── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">
            Session
          </h3>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-full border border-[rgba(195,107,78,0.35)] bg-transparent px-4 py-3 text-base font-medium text-[var(--dh-terracotta)] transition hover:bg-[rgba(195,107,78,0.08)]"
            >
              Sign Out
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
