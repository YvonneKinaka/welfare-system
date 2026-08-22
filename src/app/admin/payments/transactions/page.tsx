"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";

type TamashaTransaction = Record<string, any>;

export default function TamashaTransactionsPage() {
  const [transactions, setTransactions] = useState<TamashaTransaction[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/payments/transactions")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Could not load transactions.");
        setTransactions(data.transactions);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Tamasha Transactions</h1>
      <p className="text-body mb-8">
        Real transaction records from Tamasha for this estate, for manual review only. Use "Check
        Status" on a member's contribution or obligation to actually reconcile a specific payment.
      </p>

      {error && (
        <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text mb-4">
          {error}
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Reference</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {!transactions && !error && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={5}>Loading…</td>
              </tr>
            )}
            {transactions?.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={5}>No transactions found.</td>
              </tr>
            )}
            {transactions?.map((t, i) => (
              <tr key={t.id ?? t.reference ?? i} className="border-t border-line">
                <td className="px-5 py-4 font-mono text-sm text-ink">
                  {t.reference ?? t.welfare_reference ?? t.external_reference ?? "—"}
                </td>
                <td className="px-5 py-4 font-mono text-body">{t.amount ?? "—"}</td>
                <td className="px-5 py-4 text-body">{t.phone_number ?? t.mobile_number ?? "—"}</td>
                <td className="px-5 py-4 text-body">{t.status ?? "—"}</td>
                <td className="px-5 py-4 text-body">
                  {t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
