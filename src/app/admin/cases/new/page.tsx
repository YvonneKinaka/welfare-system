"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Member = { id: string; fullName: string; membershipNumber: string; status: string };
type Beneficiary = { id: string; fullName: string; relationship: string; status: string; memberId: string };

export default function NewCasePage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [memberId, setMemberId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members));
  }, []);

  useEffect(() => {
    if (!memberId) {
      setBeneficiaries([]);
      return;
    }
    fetch(`/api/admin/beneficiaries?memberId=${memberId}`)
      .then((r) => r.json())
      .then((d) => setBeneficiaries(d.beneficiaries.filter((b: Beneficiary) => b.status === "ACTIVE")));
  }, [memberId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beneficiaryId, deadline, notes }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.push(`/admin/cases/${data.case.id}`);
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Open a contribution case</h1>
      <p className="text-body mb-6">
        The fixed contribution of <strong>KSh 300</strong> will be requested from every currently active
        member.
      </p>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Affected member</label>
            <select
              required
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setBeneficiaryId("");
              }}
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.membershipNumber})
                </option>
              ))}
            </select>
          </div>

          {memberId && (
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Deceased beneficiary</label>
              <select
                required
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
                className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="">Select a beneficiary…</option>
                {beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fullName} ({b.relationship})
                  </option>
                ))}
              </select>
              {beneficiaries.length === 0 && (
                <p className="mt-1 text-sm text-body">This member has no active (non-archived) beneficiaries.</p>
              )}
            </div>
          )}

          <Input label="Contribution deadline" type="date" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Funeral service details" />

          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" disabled={loading || !beneficiaryId}>
            {loading ? "Opening case…" : "Open case"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
