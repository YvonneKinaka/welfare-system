"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { contributionCardTone } from "@/lib/cardTone";

type MemberLite = { id: string; fullName: string; membershipNumber: string };
type Progress = {
  case: {
    id: string;
    status: string;
    deadline: string;
    notes: string | null;
    beneficiary: { fullName: string; relationship: string };
    affectedMember: MemberLite;
  };
  expected: number;
  collected: number;
  remaining: number;
  paidMembers: MemberLite[];
  pendingMembers: MemberLite[];
  lapsedMembers: MemberLite[];
  isPastDeadline: boolean;
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Progress | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/cases/${id}`);
    const d = await res.json();
    setData(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function recordPayment(memberId: string) {
    setRecording(memberId);
    await fetch(`/api/admin/cases/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setRecording(null);
    load();
  }

  async function closeCase() {
    if (!confirm("Close this case? The beneficiary will be archived and cannot be reused.")) return;
    await fetch(`/api/admin/cases/${id}/close`, { method: "POST" });
    router.push("/admin/cases");
  }

  if (!data) return <p className="text-body">Loading…</p>;
  const { case: c } = data;
  const paidCount = data.paidMembers.length;
  const totalCount = paidCount + data.pendingMembers.length + data.lapsedMembers.length;
  const collectionPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  const cards = [
    ...data.paidMembers.map((m) => ({ ...m, status: "PAID" as const })),
    ...data.lapsedMembers.map((m) => ({ ...m, status: "LAPSED" as const })),
    ...data.pendingMembers.map((m) => ({ ...m, status: "PENDING" as const })),
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
          <h1 className="font-display text-3xl font-semibold text-ink">{c.beneficiary.fullName}</h1>
          <p className="text-body">
            {c.beneficiary.relationship} of {c.affectedMember.fullName} ({c.affectedMember.membershipNumber})
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={c.status} />
          <a href={`/api/admin/cases/${id}/report/pdf`}>
            <Button variant="secondary">
              <Download size={16} /> Download Report
            </Button>
          </a>
          {c.status === "OPEN" && (
            <Button variant="danger" onClick={closeCase}>
              Close case
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="flex justify-between text-sm text-body mb-4 flex-wrap gap-2">
          <span>Deadline: {new Date(c.deadline).toLocaleDateString()}</span>
          {data.isPastDeadline && c.status === "OPEN" && (
            <span className="text-danger-text font-semibold">Deadline has passed</span>
          )}
        </div>
        <ProgressBar paid={paidCount} total={totalCount} amountLabel={`KSh ${data.collected}`} />
        <div className="grid sm:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-body">Expected</p>
            <p className="font-mono text-xl font-semibold text-ink">KSh {data.expected}</p>
          </div>
          <div>
            <p className="text-sm text-body">Collected</p>
            <p className="font-mono text-xl font-semibold text-success-text">KSh {data.collected}</p>
          </div>
          <div>
            <p className="text-sm text-body">Remaining</p>
            <p className="font-mono text-xl font-semibold text-danger-text">KSh {data.remaining}</p>
          </div>
          <div>
            <p className="text-sm text-body">Collection %</p>
            <p className="font-mono text-xl font-semibold text-brand-600">{collectionPct}%</p>
          </div>
        </div>
        {c.notes && <p className="mt-4 text-sm text-body">Notes: {c.notes}</p>}
      </Card>

      <div>
        <h2 className="font-display text-xl font-semibold text-ink mb-4">
          Contribution Tracking · {c.beneficiary.fullName}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-4 flex items-center justify-between ${contributionCardTone(m.status)}`}
            >
              <div>
                <p className="font-semibold text-ink">{m.fullName}</p>
                <p className="text-xs text-body font-mono">{m.membershipNumber}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge status={m.status} label={m.status === "PAID" ? "Paid" : "Pending"} />
                {m.status !== "PAID" && (
                  <Button
                    variant="secondary"
                    disabled={recording === m.id || c.status === "CLOSED"}
                    onClick={() => recordPayment(m.id)}
                  >
                    {recording === m.id ? "Recording…" : "Record"}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="text-body text-sm">No eligible members for this case.</p>
          )}
        </div>
      </div>
    </div>
  );
}
