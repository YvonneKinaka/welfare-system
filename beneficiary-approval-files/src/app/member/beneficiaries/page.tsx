"use client";

import { useEffect, useState } from "react";
import { Plus, X, Pencil } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Beneficiary = {
  id: string;
  fullName: string;
  relationship: string;
  status: string;
  phone: string | null;
};
type MemberData = { member: { beneficiaries: Beneficiary[] } };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const emptyForm = { fullName: "", relationship: "", phone: "" };

export default function MemberBeneficiariesPage() {
  const [data, setData] = useState<MemberData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/member/me");
    const d = await res.json();
    setData(d);
  }

  useEffect(() => {
    load();
  }, []);

  function openNewModal() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEditModal(b: Beneficiary) {
    setEditingId(b.id);
    setForm({ fullName: b.fullName, relationship: b.relationship, phone: b.phone ?? "" });
    setError("");
    setShowModal(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const url = editingId ? `/api/member/beneficiaries/${editingId}` : "/api/member/beneficiaries";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) return setError(result.error ?? "Something went wrong.");
    setShowModal(false);
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Member Portal</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">My Beneficiaries</h1>
          <p className="text-body">Submit a beneficiary for the church office to review and approve.</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus size={16} /> Add Beneficiary
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!data && <p className="text-body">Loading…</p>}
        {data?.member.beneficiaries.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-semibold text-sm">
                {initials(b.fullName)}
              </span>
              <Badge status={b.status} />
            </div>
            <p className="font-display font-semibold text-ink">{b.fullName}</p>
            <p className="text-sm text-body">{b.relationship}</p>
            <p className="text-sm text-body">{b.phone ?? "—"}</p>

            {(b.status === "REJECTED" || b.status === "PENDING_APPROVAL") && (
              <Button variant="secondary" className="w-full mt-4" onClick={() => openEditModal(b)}>
                <Pencil size={14} />
                {b.status === "REJECTED" ? "Edit & Resubmit" : "Edit Request"}
              </Button>
            )}
          </Card>
        ))}
        {data?.member.beneficiaries.length === 0 && (
          <p className="text-body text-sm">No beneficiaries registered yet.</p>
        )}
      </div>

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
            <h2 className="font-display text-xl font-semibold text-ink mb-1">
              {editingId ? "Edit & Resubmit Beneficiary" : "Add Beneficiary"}
            </h2>
            <p className="text-body text-sm mb-5">
              {editingId
                ? "Your changes will be sent back to the church office for approval."
                : "This request will be reviewed by the church office before it becomes active."}
            </p>

            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Beneficiary Name"
                required
                placeholder="e.g. Mama Grace Wanjiru"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <Input
                label="Relationship"
                required
                placeholder="e.g. Mother"
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              />
              <Input
                label="Phone Number"
                required
                placeholder="0712 345 678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {error && <p className="text-sm text-danger-text">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Resubmit" : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
