"use client";

import { useActionState } from "react";

import { importCsvAction, type ImportCsvState } from "@/app/admin/actions";

const INITIAL_STATE: ImportCsvState = {
  error: null,
  result: null,
};

export default function ImportClient() {
  const [state, formAction, isPending] = useActionState(importCsvAction, INITIAL_STATE);

  return (
    <section className="space-y-5 pb-24">
      <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Import Inventory (Excel/CSV)</h2>
      <p className="text-base text-[rgba(110,123,85,0.9)]">
        Upload a CSV or XLSX file with SKU/category/title/condition/weight/pricing fields.
      </p>

      <form action={formAction} className="space-y-4">
        <label className="block text-base font-medium text-[var(--dh-wood)]">
          Excel or CSV file
          <input
            name="file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="mt-2 block w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-[var(--dh-walnut)] px-4 py-4 text-base font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
        >
          {isPending ? "Importing..." : "Import File"}
        </button>
      </form>

      {state.error && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{state.error}</p>
      )}

      {state.result && (
        <div className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4 text-base text-[var(--dh-wood)]">
          <p>Total rows: {state.result.totalRows}</p>
          <p>Created: {state.result.createdCount}</p>
          <p>Updated: {state.result.updatedCount}</p>
          <p>Skipped: {state.result.skippedCount}</p>
          <p className="text-sm text-[rgba(110,123,85,0.9)]">Strategy: {state.result.strategy}</p>

          {state.result.errorRows.length > 0 && (
            <div className="rounded-2xl bg-[rgba(176,141,87,0.16)] p-4">
              <p className="font-medium text-[var(--dh-wood)]">Row errors</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--dh-wood)]">
                {state.result.errorRows.map((row) => (
                  <li key={`${row.rowNumber}-${row.reason}`}>
                    Row {row.rowNumber}: {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
