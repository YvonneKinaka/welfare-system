"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";

type CaseRow = {
  id: string;
  status: string;
  deadline: string;
  beneficiary: { fullName: string };
  affectedMember: { fullName: string };
  contributions: { status: string }[];
  expected: number;
  collected: number;
};

export default function AdminCasesPage() {
  const [cases, setCases] = useState<CaseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/cases")
      .then((r) => r.json())
      .then((d) => setCases(d.cases));
  }, []);

  const open = cases?.filter((c) => c.status === "OPEN") ?? [];
  const closed = cases?.filter((c) => c.status === "CLOSED") ?? [];

  return (
    <div>
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">Contribution Cases</h1>
          <p className="text-body">Track open bereavement cases and member contributions.</p>
        </div>
        <Link href="/admin/cases/new">
          <Button>
            <Plus size={16} /> Open Case
          </Button>
        </Link>
      </div>

      <h2 className="font-display text-2xl font-semibold text-ink mb-4">
        Open Cases <span className="text-body text-lg font-normal">({open.length})</span>
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {!cases && <p className="text-body">Loading…</p>}
        {cases && open.length === 0 && <p className="text-body text-sm">No open cases right now.</p>}
        {open.map((c) => {
          const paid = c.contributions.filter((x) => x.status === "PAID").length;
          return (
            <Link key={c.id} href={`/admin/cases/${c.id}`}>
              <Card className="hover:border-brand-300 transition-colors cursor-pointer h-full">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-display text-lg font-semibold text-ink">{c.beneficiary.fullName}</p>
                  <Badge status={c.status} />
                </div>
                <p className="text-sm text-body mb-4">{c.affectedMember.fullName}'s beneficiary</p>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-body">
                    {paid}/{c.contributions.length} contributors
                  </span>
                  <span className="font-mono font-semibold text-ink">KSh {c.collected}</span>
                </div>
                <div className="h-2 rounded-full bg-brand-50 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${c.contributions.length ? (paid / c.contributions.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-body">Deadline: {new Date(c.deadline).toLocaleDateString()}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Closed Cases</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {closed.map((c) => {
              const paid = c.contributions.filter((x) => x.status === "PAID").length;
              return (
                <Link key={c.id} href={`/admin/cases/${c.id}`}>
                  <Card className="hover:border-brand-300 transition-colors cursor-pointer h-full opacity-80">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-display text-lg font-semibold text-ink">{c.beneficiary.fullName}</p>
                      <Badge status={c.status} />
                    </div>
                    <p className="text-sm text-body mb-3">{c.affectedMember.fullName}'s beneficiary</p>
                    <ProgressBar paid={paid} total={c.contributions.length} amountLabel={`KSh ${c.collected}`} />
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
