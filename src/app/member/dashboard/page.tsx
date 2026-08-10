"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  AlertCircle,
  PiggyBank,
  ShieldCheck,
  Calendar,
  Users,
  ArrowRight,
  Download,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";
import ProgressBar from "@/components/ui/ProgressBar";
import PayNowButton from "@/components/PayNowButton";

type Contribution = {
  id: string;
  amount: number;
  status: string;
  case: {
    id: string;
    deadline: string;
    beneficiary: { fullName: string };
    contributions: { status: string }[];
  };
};
type Obligation = {
  id: string;
  type: string;
  periodLabel: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  effectiveStatus: "PENDING" | "PAID" | "OVERDUE";
};
type OrgSettings = {
  registrationMode: string;
  registrationCurrency: string;
  registrationInstructions: string | null;
  contributionMode: string;
};
type MemberData = {
  member: {
    fullName: string;
    status: string;
    beneficiaries: { id: string; fullName: string; relationship: string; status: string }[];
  };
  active: Contribution[];
  outstanding: Contribution[];
  history: Contribution[];
  settings: OrgSettings | null;
  registration: Obligation | null;
  monthly: Obligation | null;
};

export default function MemberDashboardPage() {
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    fetch("/api/member/me")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-body">Loading…</p>;
  const { member, active, outstanding, history, settings, registration, monthly } = data;
  const totalPaid = history.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Member Portal</p>
        <h1 className="font-display text-4xl font-semibold text-ink mb-1">
          Karibu, {member.fullName.split(" ")[0]} 👋
        </h1>
        <p className="text-body">Here's a summary of your membership and contributions.</p>
      </div>

      {(registration || monthly) && (
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Membership & Contribution Status</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {registration && (
              <Card>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-body uppercase tracking-wide">
                    {registration.type === "ANNUAL_RENEWAL" ? "Annual Membership Renewal" : "One-Time Registration Fee"}
                  </p>
                  <Badge status={registration.effectiveStatus} />
                </div>
                <p className="font-display text-2xl font-semibold text-ink mb-2">
                  {settings?.registrationCurrency ?? "KES"} {registration.amount.toLocaleString()}
                </p>
                {registration.dueDate && (
                  <p className="flex items-center gap-1 text-sm text-body mb-4">
                    <Calendar size={14} />
                    {registration.type === "ANNUAL_RENEWAL" ? "Renewal due" : "Due"}{" "}
                    {new Date(registration.dueDate).toLocaleDateString()}
                  </p>
                )}
                {registration.effectiveStatus !== "PAID" && (
                  <PayNowButton targetType="OBLIGATION" targetId={registration.id} />
                )}
              </Card>
            )}

            {monthly && (
              <Card>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-body uppercase tracking-wide">
                    Monthly Contribution · {monthly.periodLabel}
                  </p>
                  <Badge status={monthly.effectiveStatus} />
                </div>
                <p className="font-display text-2xl font-semibold text-ink mb-2">
                  {settings?.registrationCurrency ?? "KES"} {monthly.amount.toLocaleString()}
                </p>
                {monthly.dueDate && (
                  <p className="flex items-center gap-1 text-sm text-body mb-4">
                    <Calendar size={14} /> Due {new Date(monthly.dueDate).toLocaleDateString()}
                  </p>
                )}
                {monthly.effectiveStatus !== "PAID" && (
                  <PayNowButton targetType="OBLIGATION" targetId={monthly.id} />
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Contributions" value={active.length} tone="brand" icon={<Receipt size={16} />} />
        <StatCard label="Outstanding" value={outstanding.length} tone="danger" icon={<AlertCircle size={16} />} hint={outstanding[0] ? `KSh ${outstanding[0].amount} due soon` : undefined} />
        <StatCard label="Total Contributed" value={`KSh ${totalPaid.toLocaleString()}`} tone="plain" icon={<PiggyBank size={16} />} hint="Lifetime giving" />
        <StatCard
          label="Eligibility Status"
          value={member.status === "ACTIVE" ? "Active" : "Suspended"}
          tone={member.status === "ACTIVE" ? "success" : "danger"}
          icon={<ShieldCheck size={16} />}
          hint={member.status === "ACTIVE" ? "In good standing" : "Contact the office"}
        />
      </div>

      {member.status === "SUSPENDED" && (
        <div className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-danger-text">
          Your membership is currently suspended due to missed contributions. Clear your outstanding
          amount below to be automatically reactivated.
        </div>
      )}

      {(!settings || settings.contributionMode === "PER_WELFARE_CASE") && (
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Active Contributions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((c) => {
              const total = c.case.contributions.length;
              const paid = c.case.contributions.filter((x) => x.status === "PAID").length;
              const target = total * 300;
              const raised = paid * 300;
              return (
                <Card key={c.id}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs text-body">Beneficiary</p>
                    <span className="text-xs font-mono font-semibold text-brand-600">KSh {c.amount}</span>
                  </div>
                  <p className="font-display font-semibold text-ink mb-3">{c.case.beneficiary.fullName}</p>
                  <ProgressBar paid={paid} total={total} amountLabel={`KSh ${raised.toLocaleString()} / ${target.toLocaleString()}`} />
                  <div className="flex items-center gap-4 mt-3 text-xs text-body">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> Due {new Date(c.case.deadline).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {paid}/{total}
                    </span>
                  </div>
                  <Link href={`/member/active-contributions`}>
                    <Button variant="secondary" className="w-full mt-4">
                      View Details <ArrowRight size={14} />
                    </Button>
                  </Link>
                </Card>
              );
            })}
            {active.length === 0 && <p className="text-body text-sm">Nothing active right now.</p>}
          </div>
        </div>
      )}

      {outstanding.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink mb-4">Outstanding Contributions</h2>
          <Card className="p-0 divide-y divide-line overflow-hidden">
            {outstanding.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-4 gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-ink">{c.case.beneficiary.fullName}</p>
                  <p className="text-sm text-body">KSh {c.amount}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status="PENDING" />
                  <PayNowButton targetType="WELFARE_CONTRIBUTION" targetId={c.id} />
                </div>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-sm text-body">
            You can also make payment through the church office as usual — your administrator will
            confirm it here.
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold text-ink">Contribution History</h2>
          <a href="/api/member/statement">
            <Button variant="secondary">
              <Download size={14} /> Download Statement
            </Button>
          </a>
        </div>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-brand-50/70 text-body text-sm">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Beneficiary</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-5 py-4 text-body">{new Date(c.case.deadline).toLocaleDateString()}</td>
                  <td className="px-5 py-4 font-semibold text-ink">{c.case.beneficiary.fullName}</td>
                  <td className="px-5 py-4 font-mono text-body">KSh {c.amount}</td>
                  <td className="px-5 py-4">
                    <Badge status={c.status} />
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-body" colSpan={4}>
                    No contribution records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <h2 className="font-display text-2xl font-semibold text-ink mb-4">My Beneficiaries</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {member.beneficiaries.map((b) => (
            <Card key={b.id} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 font-semibold text-sm shrink-0">
                {b.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-ink">{b.fullName}</p>
                <p className="text-sm text-body">{b.relationship}</p>
              </div>
            </Card>
          ))}
          {member.beneficiaries.length === 0 && <p className="text-body text-sm">No beneficiaries registered yet.</p>}
        </div>
      </div>
    </div>
  );
}
