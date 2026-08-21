"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Settings = {
  registrationMode: string;
  registrationAmount: number;
  registrationCurrency: string;
  registrationInstructions: string | null;
  registrationEffectiveDate: string | null;
  renewalMonth: number | null;
  registrationGraceDays: number;
  contributionMode: string;
  monthlyAmount: number | null;
  monthlyDueDay: number | null;
  monthlyGraceDays: number | null;
  reminderDaysBefore: number | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function OrganizationSettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load settings.");
        setForm(d.settings);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setSavedMsg("Settings saved.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
          {loadError}
        </div>
      </div>
    );
  }
  if (!form) return <p className="text-body">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Organization Settings</h1>
      <p className="text-body mb-8">
        These payment rules apply automatically to every member in your organization - members never
        choose their own payment model.
      </p>

      <form onSubmit={onSave} className="space-y-6">
        <Card>
          <h2 className="font-display text-xl font-semibold text-ink mb-1">Membership / Registration Settings</h2>
          <p className="text-sm text-body mb-4">Compulsory for every member - choose how it's collected.</p>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Registration model</label>
            <select
              required
              value={form.registrationMode}
              onChange={(e) => update("registrationMode", e.target.value)}
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="ONE_TIME">One-Time Registration Fee</option>
              <option value="ANNUAL">Annual Membership Renewal</option>
            </select>
            <p className="mt-1 text-sm text-body">
              {form.registrationMode === "ONE_TIME"
                ? "New members pay once; the obligation is complete after that payment."
                : "Members must renew their membership fee every year."}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Amount"
                type="number"
                required
                min={1}
                value={form.registrationAmount}
                onChange={(e) => update("registrationAmount", Number(e.target.value))}
              />
              <Input
                label="Currency"
                required
                value={form.registrationCurrency}
                onChange={(e) => update("registrationCurrency", e.target.value)}
                placeholder="KES"
              />
            </div>
            <Input
              label="Payment instructions"
              value={form.registrationInstructions ?? ""}
              onChange={(e) => update("registrationInstructions", e.target.value)}
              placeholder="e.g. Pay at the church office"
            />
            <Input
              label="Effective date"
              type="date"
              value={form.registrationEffectiveDate ? form.registrationEffectiveDate.slice(0, 10) : ""}
              onChange={(e) => update("registrationEffectiveDate", e.target.value)}
            />

            {form.registrationMode === "ANNUAL" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1.5">Renewal month</label>
                  <select
                    required
                    value={form.renewalMonth ?? ""}
                    onChange={(e) => update("renewalMonth", e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Select a month…</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Grace period (days)"
                  type="number"
                  min={0}
                  value={form.registrationGraceDays}
                  onChange={(e) => update("registrationGraceDays", Number(e.target.value))}
                />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold text-ink mb-1">Contribution Settings</h2>
          <p className="text-sm text-body mb-4">
            Separate from registration - members may owe both at the same time.
          </p>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Contribution model</label>
            <select
              required
              value={form.contributionMode}
              onChange={(e) => update("contributionMode", e.target.value)}
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="PER_WELFARE_CASE">Per Welfare Case</option>
              <option value="MONTHLY">Monthly Contribution</option>
            </select>
            <p className="mt-1 text-sm text-body">
              {form.contributionMode === "PER_WELFARE_CASE"
                ? "No recurring payment - members contribute only when you open a welfare case, exactly as today."
                : "Members owe a fixed amount every month, in addition to any welfare cases you open."}
            </p>
          </div>

          {form.contributionMode === "MONTHLY" && (
            <div className="mt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Amount"
                  type="number"
                  required
                  min={1}
                  value={form.monthlyAmount ?? ""}
                  onChange={(e) => update("monthlyAmount", e.target.value ? Number(e.target.value) : null)}
                />
                <Input
                  label="Due day every month"
                  type="number"
                  required
                  min={1}
                  max={31}
                  value={form.monthlyDueDay ?? ""}
                  onChange={(e) => update("monthlyDueDay", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Grace period (days)"
                  type="number"
                  min={0}
                  value={form.monthlyGraceDays ?? 0}
                  onChange={(e) => update("monthlyGraceDays", Number(e.target.value))}
                />
                <Input
                  label="Reminder (days before due)"
                  type="number"
                  min={0}
                  value={form.reminderDaysBefore ?? 3}
                  onChange={(e) => update("reminderDaysBefore", Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </Card>

        {error && <p className="text-sm text-danger-text">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {savedMsg && <span className="text-brand-600 text-sm font-semibold">{savedMsg}</span>}
        </div>
      </form>

      <Card className="mt-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink mb-1">Disbursements</h2>
          <p className="text-sm text-body">
            Wallet balance, approval settings, and releasing funds with multi-approver sign-off.
          </p>
        </div>
        <Link href="/admin/settings/disbursements">
          <Button variant="secondary">
            <Wallet2 size={16} /> Open
          </Button>
        </Link>
      </Card>
    </div>
  );
}
