"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet, Users2, FileText, Download } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";

type Reports = {
  totalMembers: number;
  activeMembers: number;
  suspendedMembers: number;
  openCases: number;
  closedCases: number;
  amountExpected: number;
  amountCollected: number;
  outstanding: number;
};

const reportLinks = [
  { title: "Monthly Contributions Summary" },
  { title: "Members Contribution Statement" },
  { title: "Open Cases Report" },
  { title: "Suspended Members Report" },
];

export default function AdminReportsPage() {
  const [data, setData] = useState<Reports | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then(setData);
  }, []);

  function printReport() {
    window.print();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Reports</h1>
      <p className="text-body mb-8">Summaries and downloadable statements for church leadership.</p>

      {!data ? (
        <p className="text-body">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          <StatCard label="Total Collected" value={`KSh ${data.amountCollected.toLocaleString()}`} tone="brand" icon={<Wallet size={16} />} />
          <StatCard label="Cases Closed" value={data.closedCases} tone="success" icon={<TrendingUp size={16} />} />
          <StatCard label="Total Members" value={data.totalMembers} tone="plain" icon={<Users2 size={16} />} />
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold text-ink mb-4">Available Reports</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {reportLinks.map((r) => (
          <Card key={r.title} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <FileText size={18} />
              </span>
              <div>
                <p className="font-semibold text-ink">{r.title}</p>
                <p className="text-xs text-body">Updated today</p>
              </div>
            </div>
            <button
              onClick={printReport}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-brand-50"
            >
              <Download size={14} /> PDF
            </button>
          </Card>
        ))}
      </div>

      <h2 className="font-display text-2xl font-semibold text-ink mb-4">Fund Position</h2>
      <Card className="p-0 overflow-hidden max-w-2xl">
        {!data ? (
          <p className="p-6 text-body">Loading…</p>
        ) : (
          <table className="w-full text-left">
            <tbody>
              {[
                ["Active Members", data.activeMembers],
                ["Suspended Members", data.suspendedMembers],
                ["Open Cases", data.openCases],
                ["Closed Cases", data.closedCases],
                ["Amount Expected", `KSh ${data.amountExpected.toLocaleString()}`],
                ["Amount Collected", `KSh ${data.amountCollected.toLocaleString()}`],
                ["Outstanding Contributions", `KSh ${data.outstanding.toLocaleString()}`],
              ].map(([label, value]) => (
                <tr key={label as string} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-4 text-body">{label}</td>
                  <td className="px-5 py-4 font-mono font-semibold text-ink text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
