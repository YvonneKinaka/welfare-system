"use client";

import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import RelationshipField from "@/components/RelationshipField";
import { beneficiaryCardTone } from "@/lib/cardTone";

type Member = { id: string; fullName: string };
type Beneficiary = {
  id: string;
  fullName: string;
  relationship: string;
  status: string;
  member: { id: string; fullName: string; phone: string };
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminBeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ memberId: "", fullName: "", relationship: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [bRes, mRes] = await Promise.all([
      fetch("/api/admin/beneficiaries").then((r) => r.json()),
      fetch("/api/admin/members").then((r) => r.json()),
    ]);
    setBeneficiaries(bRes.beneficiaries);
    setMembers(mRes.members);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/beneficiaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error);
    setForm({ memberId: "", fullName: "", relationship: "" });
    setShowModal(false);
    load();
  }

  const active = beneficiaries?.filter((b) => b.status === "ACTIVE") ?? [];
  const archived = beneficiaries?.filter((b) => b.status === "ARCHIVED") ?? [];

  return (
    <div>
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">Beneficiaries</h1>
          <p className="text-body">Register and manage beneficiaries for every member.</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Register Beneficiary
        </Button>
      </div>

      <h2 className="font-display text-2xl font-semibold text-ink mb-4">
        Registered Beneficiaries <span className="text-body text-lg font-normal">({active.length})</span>
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {beneficiaries === null && <p className="text-body">Loading…</p>}
        {beneficiaries !== null && active.length === 0 && (
          <p className="text-body text-sm">No beneficiaries registered yet.</p>
        )}
        {active.map((b) => (
          <Card key={b.id} className={beneficiaryCardTone(b.status)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 font-semibold text-sm">
                  {initials(b.fullName)}
                </span>
                <div>
                  <p className="font-display font-semibold text-ink">{b.fullName}</p>
                  <p className="text-sm text-body">{b.relationship}</p>
                </div>
              </div>
              <Badge status={b.status} label="Approved" />
            </div>
            <p className="text-sm text-body">
              Member: <span className="font-semibold text-ink">{b.member.fullName}</span>
            </p>
            <p className="text-sm text-body">{b.member.phone}</p>
          </Card>
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Archived (claimed)</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((b) => (
              <Card key={b.id} className={beneficiaryCardTone(b.status)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 font-semibold text-sm">
                      {initials(b.fullName)}
                    </span>
                    <div>
                      <p className="font-display font-semibold text-ink">{b.fullName}</p>
                      <p className="text-sm text-body">{b.relationship}</p>
                    </div>
                  </div>
                  <Badge status={b.status} />
                </div>
                <p className="text-sm text-body">
                  Member: <span className="font-semibold text-ink">{b.member.fullName}</span>
                </p>
              </Card>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4">
          <Card className="w-full max-w-md relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-body hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 className="font-display text-xl font-semibold text-ink mb-1">Register Beneficiary</h2>
            <p className="text-body text-sm mb-5">Link a family member to a registered church member.</p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Select Member</label>
                <select
                  required
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Select a member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Beneficiary Name"
                required
                placeholder="e.g. Mama Grace Wanjiru"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <RelationshipField
                value={form.relationship}
                onChange={(relationship) => setForm({ ...form, relationship })}
              />
              {error && <p className="text-sm text-danger-text">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Beneficiary"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
