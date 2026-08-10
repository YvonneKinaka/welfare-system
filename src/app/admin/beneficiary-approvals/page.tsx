"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type PendingBeneficiary = {
  id: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  status: string;
  createdAt: string;
  member: { id: string; fullName: string };
};

export default function BeneficiaryApprovalsPage() {
  const [pending, setPending] = useState<PendingBeneficiary[] | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/beneficiaries?status=PENDING_APPROVAL");
    const data = await res.json();
    setPending(data.beneficiaries);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, status: "ACTIVE" | "REJECTED") {
    setActingId(id);
    await fetch(`/api/admin/beneficiaries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActingId(null);
    load();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Beneficiary Approvals</h1>
      <p className="text-body mb-8">Review beneficiaries submitted directly by members.</p>

      {!pending && <p className="text-body">Loading…</p>}
      {pending?.length === 0 && (
        <p className="text-body text-sm">No pending beneficiary requests right now.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pending?.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between mb-3">
              <p className="font-display font-semibold text-ink">{b.fullName}</p>
              <Badge status={b.status} />
            </div>
            <dl className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <dt className="text-body">Member</dt>
                <dd className="text-ink font-medium">{b.member.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Relationship</dt>
                <dd className="text-ink font-medium">{b.relationship}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Phone</dt>
                <dd className="text-ink font-medium">{b.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Submitted</dt>
                <dd className="text-ink font-medium">{new Date(b.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            <div className="flex gap-3">
              <Button
                variant="success"
                disabled={actingId === b.id}
                onClick={() => decide(b.id, "ACTIVE")}
                className="flex-1"
              >
                <Check size={16} /> Approve
              </Button>
              <Button
                variant="danger"
                disabled={actingId === b.id}
                onClick={() => decide(b.id, "REJECTED")}
                className="flex-1"
              >
                <X size={16} /> Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
