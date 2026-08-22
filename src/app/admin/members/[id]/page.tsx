"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, FileText, Check, X, Send, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import RelationshipField from "@/components/RelationshipField";
import { beneficiaryCardTone, contributionCardTone } from "@/lib/cardTone";

type Beneficiary = { id: string; fullName: string; relationship: string; status: string; phone: string | null };
type MemberDetail = {
  id: string;
  fullName: string;
  membershipNumber: string;
  phone: string;
  email: string | null;
  status: string;
  missedCount: number;
  tamashaUserId: number | null;
  beneficiaries: Beneficiary[];
  contributions: {
    id: string;
    amount: number;
    status: string;
    case: { beneficiary: { fullName: string } };
  }[];
  obligations: {
    id: string;
    type: string;
    periodLabel: string | null;
    amount: number;
    status: string;
  }[];
};

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const tamashaWarning = searchParams.get("tamashaWarning");
  const tamashaJustLinked = searchParams.get("tamashaLinked") === "1";
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "" });
  const [savedMsg, setSavedMsg] = useState("");
  const [newBeneficiary, setNewBeneficiary] = useState({ fullName: "", relationship: "" });
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [obligationMsg, setObligationMsg] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/members/${id}`);
    const data = await res.json();
    setMember(data.member);
    setForm({
      fullName: data.member.fullName,
      phone: data.member.phone,
      email: data.member.email ?? "",
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setSavedMsg("Saved.");
    setTimeout(() => setSavedMsg(""), 2000);
    load();
  }

  async function toggleStatus() {
    if (!member) return;
    const nextStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await fetch(`/api/admin/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    load();
  }

  async function addBeneficiary(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/admin/beneficiaries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id, ...newBeneficiary }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNewBeneficiary({ fullName: "", relationship: "" });
    load();
  }

  async function setBeneficiaryStatus(beneficiaryId: string, status: "ACTIVE" | "REJECTED" | "ARCHIVED") {
    setActingId(beneficiaryId);
    await fetch(`/api/admin/beneficiaries/${beneficiaryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActingId(null);
    load();
  }

  async function sendObligationLink(obligationId: string) {
    setSendingLink(obligationId);
    setObligationMsg(null);
    const res = await fetch("/api/admin/payments/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "OBLIGATION", targetId: obligationId }),
    });
    const result = await res.json();
    setSendingLink(null);
    setObligationMsg({ id: obligationId, text: res.ok ? "Payment link sent." : (result.error ?? "Could not send payment link.") });
  }

  async function checkObligationStatus(obligationId: string) {
    setChecking(obligationId);
    setObligationMsg(null);
    const res = await fetch("/api/admin/payments/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "OBLIGATION", targetId: obligationId }),
    });
    const result = await res.json();
    setChecking(null);
    if (res.ok) {
      setObligationMsg({ id: obligationId, text: `Status: ${result.transaction?.status ?? "unknown"}` });
      load();
    } else {
      setObligationMsg({ id: obligationId, text: result.error ?? "Could not check status." });
    }
  }

  if (!member) return <p className="text-body">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
          <h1 className="font-display text-3xl font-semibold text-ink">{member.fullName}</h1>
          <p className="text-body font-mono text-sm">{member.membershipNumber}</p>
          <p className="text-body text-xs mt-0.5">
            {member.tamashaUserId
              ? `Tamasha User ID: ${member.tamashaUserId}`
              : "Not linked to Tamasha"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge status={member.status} />
          <Button variant={member.status === "ACTIVE" ? "danger" : "primary"} onClick={toggleStatus}>
            {member.status === "ACTIVE" ? "Suspend member" : "Activate member"}
          </Button>
          <Link href={`/admin/members/${member.id}/statement`}>
            <Button variant="secondary">
              <FileText size={16} /> View Statement
            </Button>
          </Link>
          <a href={`/api/admin/statement/${member.id}`}>
            <Button variant="secondary">
              <Download size={16} /> Download
            </Button>
          </a>
        </div>
      </div>

      {tamashaWarning && (
        <div className="rounded-2xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
          {tamashaWarning}
        </div>
      )}
      {tamashaJustLinked && !tamashaWarning && (
        <div className="rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-text">
          Member successfully linked to Tamasha.
        </div>
      )}

      {member.missedCount > 0 && (
        <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
          {member.missedCount} missed contribution deadline(s) recorded. Suspension is automatic at 3.
        </div>
      )}

      <Card>
        <h2 className="font-display text-xl font-semibold text-ink mb-4">Member information</h2>
        <form onSubmit={saveInfo} className="grid sm:grid-cols-2 gap-4">
          <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="flex items-end gap-3">
            <Button type="submit">Save changes</Button>
            {savedMsg && <span className="text-brand-600 text-sm font-semibold">{savedMsg}</span>}
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold text-ink mb-4">Registered beneficiaries</h2>
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {member.beneficiaries.length === 0 && <p className="text-body text-sm">No beneficiaries registered yet.</p>}
          {member.beneficiaries.map((b) => (
            <div key={b.id} className={`rounded-2xl border p-4 ${beneficiaryCardTone(b.status)}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-ink">{b.fullName}</p>
                  <p className="text-sm text-body">{b.relationship}</p>
                  {b.phone && <p className="text-sm text-body">{b.phone}</p>}
                </div>
                <Badge status={b.status} label={b.status === "ACTIVE" ? "Approved" : undefined} />
              </div>
              <div className="flex gap-2 flex-wrap">
                {b.status === "PENDING_APPROVAL" && (
                  <>
                    <Button
                      variant="success"
                      disabled={actingId === b.id}
                      onClick={() => setBeneficiaryStatus(b.id, "ACTIVE")}
                    >
                      <Check size={14} /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      disabled={actingId === b.id}
                      onClick={() => setBeneficiaryStatus(b.id, "REJECTED")}
                    >
                      <X size={14} /> Reject
                    </Button>
                  </>
                )}
                {b.status === "ACTIVE" && (
                  <Button variant="ghost" disabled={actingId === b.id} onClick={() => setBeneficiaryStatus(b.id, "ARCHIVED")}>
                    Archive
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={addBeneficiary} className="grid sm:grid-cols-2 gap-3 items-start">
          <Input
            placeholder="Full name"
            required
            value={newBeneficiary.fullName}
            onChange={(e) => setNewBeneficiary({ ...newBeneficiary, fullName: e.target.value })}
          />
          <RelationshipField
            value={newBeneficiary.relationship}
            onChange={(relationship) => setNewBeneficiary({ ...newBeneficiary, relationship })}
          />
          <Button type="submit" variant="secondary" className="sm:col-span-2">
            Add beneficiary
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold text-ink mb-4">Contribution history</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {member.contributions.length === 0 && <p className="text-body text-sm">No contribution records yet.</p>}
          {member.contributions.map((c) => (
            <div key={c.id} className={`rounded-2xl border p-4 flex items-center justify-between ${contributionCardTone(c.status)}`}>
              <p className="text-ink font-medium">For {c.case.beneficiary.fullName}</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-body">KSh {c.amount}</span>
                <Badge status={c.status} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl font-semibold text-ink mb-4">Registration & Contribution Obligations</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {member.obligations.length === 0 && <p className="text-body text-sm">No obligations recorded yet.</p>}
          {member.obligations.map((o) => (
            <div key={o.id} className={`rounded-2xl border p-4 ${contributionCardTone(o.status)}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-ink font-medium">
                  {o.type.replace(/_/g, " ")}
                  {o.periodLabel ? ` · ${o.periodLabel}` : ""}
                </p>
                <Badge status={o.status} />
              </div>
              <p className="font-mono text-sm text-body mb-2">KSh {o.amount}</p>
              {o.status !== "PAID" && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    disabled={sendingLink === o.id}
                    onClick={() => sendObligationLink(o.id)}
                  >
                    <Send size={14} /> {sendingLink === o.id ? "Sending…" : "Send Payment Link"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={checking === o.id}
                    onClick={() => checkObligationStatus(o.id)}
                  >
                    <RefreshCw size={14} /> {checking === o.id ? "Checking…" : "Check Status"}
                  </Button>
                </div>
              )}
              {obligationMsg?.id === o.id && <p className="text-xs text-body mt-2">{obligationMsg.text}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
