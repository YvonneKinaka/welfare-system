"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet2,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Download,
  Plus,
  Trash2,
  Mail,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";

type WalletSummary = {
  wallet: { balance: number; totalReceived: number; totalDisbursed: number };
  pendingCount: number;
  pendingTotal: number;
};
type ApprovalSettings = { approverEmails: string[]; minApprovals: number };
type Disbursement = {
  id: string;
  recipientName: string;
  amount: number;
  paymentMethod: string;
  accountNumber: string;
  comment: string | null;
  status: string;
  minApprovals: number;
  createdAt: string;
  requestedBy: { fullName: string };
  approvals: { approverEmail: string; status: string; comment: string | null }[];
};

const emptyDisbursementForm = {
  recipientName: "",
  amount: "",
  paymentMethod: "BANK",
  accountNumber: "",
  comment: "",
};

export default function DisbursementsSettingsPage() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [approvalSettings, setApprovalSettings] = useState<ApprovalSettings | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[] | null>(null);

  const [newApproverEmail, setNewApproverEmail] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState("");

  const [form, setForm] = useState(emptyDisbursementForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, a, d] = await Promise.all([
      fetch("/api/admin/disbursements/wallet").then((r) => r.json()),
      fetch("/api/admin/disbursements/settings").then((r) => r.json()),
      fetch("/api/admin/disbursements").then((r) => r.json()),
    ]);
    setSummary(s);
    setApprovalSettings(a.settings);
    setDisbursements(d.disbursements);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addApprover() {
    if (!newApproverEmail || !approvalSettings) return;
    if (approvalSettings.approverEmails.includes(newApproverEmail)) return;
    setApprovalSettings({
      ...approvalSettings,
      approverEmails: [...approvalSettings.approverEmails, newApproverEmail],
    });
    setNewApproverEmail("");
  }

  function removeApprover(email: string) {
    if (!approvalSettings) return;
    setApprovalSettings({
      ...approvalSettings,
      approverEmails: approvalSettings.approverEmails.filter((e) => e !== email),
    });
  }

  async function saveApprovalSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!approvalSettings) return;
    setSettingsError("");
    setSavingSettings(true);
    const res = await fetch("/api/admin/disbursements/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(approvalSettings),
    });
    const data = await res.json();
    setSavingSettings(false);
    if (!res.ok) return setSettingsError(data.error ?? "Could not save settings.");
    setSettingsMsg("Approval settings saved.");
    setTimeout(() => setSettingsMsg(""), 2500);
  }

  async function onDeposit(e: React.FormEvent) {
    e.preventDefault();
    setDepositError("");
    setDepositing(true);
    const res = await fetch("/api/admin/disbursements/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(depositAmount), note: depositNote || undefined }),
    });
    const data = await res.json();
    setDepositing(false);
    if (!res.ok) return setDepositError(data.error ?? "Could not record deposit.");
    setDepositAmount("");
    setDepositNote("");
    load();
  }

  const insufficientBalance =
    summary && form.amount ? Number(form.amount) > summary.wallet.balance : false;

  async function onSubmitDisbursement(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (insufficientBalance) {
      setFormError("Wallet balance is insufficient for this amount.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/disbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) return setFormError(data.error ?? "Could not submit disbursement.");
    setForm(emptyDisbursementForm);
    load();
  }

  async function markCompleted(id: string) {
    setCompletingId(id);
    await fetch(`/api/admin/disbursements/${id}/complete`, { method: "POST" });
    setCompletingId(null);
    load();
  }

  return (
    <div className="max-w-3xl">
      <Link href="/admin/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-body mb-4">
        <ArrowLeft size={14} /> Back to Settings
      </Link>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Disbursements</h1>
      <p className="text-body mb-8">
        Release funds to recipients only after the required approvers sign off - directly from their
        email, no account needed.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Current Balance"
          value={summary ? `KSh ${summary.wallet.balance.toLocaleString()}` : "—"}
          tone="brand"
          icon={<Wallet2 size={16} />}
        />
        <StatCard
          label="Total Received"
          value={summary ? `KSh ${summary.wallet.totalReceived.toLocaleString()}` : "—"}
          tone="success"
          icon={<ArrowDownCircle size={16} />}
        />
        <StatCard
          label="Total Disbursed"
          value={summary ? `KSh ${summary.wallet.totalDisbursed.toLocaleString()}` : "—"}
          tone="plain"
          icon={<ArrowUpCircle size={16} />}
        />
        <StatCard
          label="Pending Disbursements"
          value={summary ? `KSh ${summary.pendingTotal.toLocaleString()}` : "—"}
          tone="warning"
          icon={<Clock size={16} />}
          hint={summary ? `${summary.pendingCount} awaiting approval` : undefined}
        />
      </div>

      <Card className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Record a Deposit</h2>
        <p className="text-sm text-body mb-4">Add funds received into the wallet.</p>
        <form onSubmit={onDeposit} className="grid sm:grid-cols-3 gap-3 items-start">
          <Input
            label="Amount"
            type="number"
            min={1}
            required
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Input
            label="Note (optional)"
            value={depositNote}
            onChange={(e) => setDepositNote(e.target.value)}
            placeholder="e.g. Bank transfer ref"
          />
          <div className="pt-7">
            <Button type="submit" disabled={depositing}>
              {depositing ? "Recording…" : "Record Deposit"}
            </Button>
          </div>
        </form>
        {depositError && <p className="mt-2 text-sm text-danger-text">{depositError}</p>}
      </Card>

      <Card className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">Approval Settings</h2>
        <p className="text-sm text-body mb-4">
          Approvers act only through their emailed link - they never log in.
        </p>

        {!approvalSettings ? (
          <p className="text-body">Loading…</p>
        ) : (
          <form onSubmit={saveApprovalSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Approver emails</label>
              <div className="flex gap-2 mb-3">
                <input
                  type="email"
                  value={newApproverEmail}
                  onChange={(e) => setNewApproverEmail(e.target.value)}
                  placeholder="approver@example.com"
                  className="flex-1 rounded-full border border-line bg-white px-5 py-3 text-base text-ink placeholder:text-body/60 focus:border-brand-500 focus:outline-none"
                />
                <Button type="button" variant="secondary" onClick={addApprover}>
                  <Plus size={16} /> Add
                </Button>
              </div>
              <ul className="space-y-2">
                {approvalSettings.approverEmails.map((email) => (
                  <li key={email} className="flex items-center justify-between rounded-full bg-brand-50 px-4 py-2">
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <Mail size={14} /> {email}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeApprover(email)}
                      className="text-danger-text hover:opacity-70"
                      aria-label={`Remove ${email}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
                {approvalSettings.approverEmails.length === 0 && (
                  <p className="text-sm text-body">No approvers configured yet.</p>
                )}
              </ul>
            </div>

            <Input
              label="Minimum approvals required"
              type="number"
              min={1}
              max={Math.max(approvalSettings.approverEmails.length, 1)}
              required
              value={approvalSettings.minApprovals}
              onChange={(e) => setApprovalSettings({ ...approvalSettings, minApprovals: Number(e.target.value) })}
            />

            {settingsError && <p className="text-sm text-danger-text">{settingsError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving…" : "Save approval settings"}
              </Button>
              {settingsMsg && <span className="text-brand-600 text-sm font-semibold">{settingsMsg}</span>}
            </div>
          </form>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="font-display text-xl font-semibold text-ink mb-1">New Disbursement</h2>
        <p className="text-sm text-body mb-4">
          No funds are released on submission - approval emails go out first.
        </p>
        <form onSubmit={onSubmitDisbursement} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Recipient name"
              required
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
            />
            <Input
              label="Amount"
              type="number"
              min={1}
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              error={insufficientBalance ? "Exceeds current wallet balance" : undefined}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Payment method</label>
              <select
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="BANK">Bank</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            <Input
              label={form.paymentMethod === "BANK" ? "Account number" : "Phone number"}
              required
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            />
          </div>
          <Input
            label="Comment (optional)"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="What is this disbursement for?"
          />
          {formError && <p className="text-sm text-danger-text">{formError}</p>}
          <Button type="submit" disabled={submitting || insufficientBalance}>
            {submitting ? "Submitting…" : "Submit for Approval"}
          </Button>
        </form>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold text-ink">Disbursement History</h2>
        <a href="/api/admin/disbursements/report/pdf">
          <Button variant="secondary">
            <Download size={14} /> Download Report
          </Button>
        </a>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Recipient</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Method</th>
              <th className="px-5 py-3 font-medium">Approvals</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {!disbursements && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={6}>Loading…</td>
              </tr>
            )}
            {disbursements?.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={6}>No disbursements yet.</td>
              </tr>
            )}
            {disbursements?.map((d) => {
              const approvedCount = d.approvals.filter((a) => a.status === "APPROVED").length;
              return (
                <tr key={d.id} className="border-t border-line align-top">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{d.recipientName}</p>
                    <p className="text-xs text-body">{d.accountNumber}</p>
                  </td>
                  <td className="px-5 py-4 font-mono text-body">KSh {d.amount.toLocaleString()}</td>
                  <td className="px-5 py-4 text-body">{d.paymentMethod === "BANK" ? "Bank" : "Mobile Money"}</td>
                  <td className="px-5 py-4 text-body">
                    {approvedCount}/{d.minApprovals}
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={d.status} />
                  </td>
                  <td className="px-5 py-4">
                    {d.status === "APPROVED" && (
                      <Button
                        variant="secondary"
                        disabled={completingId === d.id}
                        onClick={() => markCompleted(d.id)}
                      >
                        {completingId === d.id ? "Saving…" : "Mark Completed"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
