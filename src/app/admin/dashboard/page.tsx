"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  UserX,
  UserPlus,
  HeartHandshake,
  FilePlus2,
  FileBarChart2,
  ArrowRight,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type Reports = {
  totalMembers: number;
  activeMembers: number;
  suspendedMembers: number;
  openCases: number;
  closedCases: number;
  amountExpected: number;
  amountCollected: number;
  outstanding: number;
};

type CaseRow = {
  id: string;
  status: string;
  createdAt: string;
  beneficiary: { fullName: string };
  contributions: { status: string }[];
};

const quickActions = [
  { href: "/admin/members/new", label: "Register Member", icon: UserPlus },
  { href: "/admin/beneficiaries", label: "Register Beneficiary", icon: HeartHandshake },
  { href: "/admin/cases/new", label: "Open Contribution Case", icon: FilePlus2 },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart2 },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<Reports | null>(null);
  const [cases, setCases] = useState<CaseRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then(setData);
    fetch("/api/admin/cases")
      .then((r) => r.json())
      .then((d) => setCases(d.cases.slice(0, 4)));
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Welfare Overview</h1>
      <p className="text-body mb-8">A snapshot of members, cases and contributions.</p>

      {!data ? (
        <p className="text-body">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <StatCard label="Total Members" value={data.totalMembers} tone="plain" icon={<Users size={16} />} />
          <StatCard label="Open Cases" value={data.openCases} tone="warning" icon={<FolderOpen size={16} />} />
          <StatCard label="Closed Cases" value={data.closedCases} tone="success" icon={<CheckCircle2 size={16} />} />
          <StatCard
            label="Pending Contributions"
            value={data.outstanding > 0 ? Math.round(data.outstanding / 300) : 0}
            tone="danger"
            icon={<AlertCircle size={16} />}
          />
          <StatCard label="Suspended Members" value={data.suspendedMembers} tone="plain" icon={<UserX size={16} />} />
        </div>
      )}

      <h2 className="font-display text-2xl font-semibold text-ink mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href}>
              <Card className="hover:border-brand-300 transition-colors cursor-pointer h-full">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-3">
                  <Icon size={18} />
                </span>
                <p className="font-display text-lg font-semibold text-ink mb-1">{a.label}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                  Continue <ArrowRight size={14} />
                </span>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold text-ink">Recent Cases</h2>
        <Link href="/admin/cases" className="text-sm font-semibold text-brand-600">
          View all
        </Link>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Beneficiary</th>
              <th className="px-5 py-3 font-medium">Opened</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!cases && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {cases?.map((c) => {
              const paid = c.contributions.filter((x) => x.status === "PAID").length;
              return (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-5 py-4 font-semibold text-ink">{c.beneficiary.fullName}</td>
                  <td className="px-5 py-4 text-body">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4 font-mono text-sm text-body">
                    {paid}/{c.contributions.length}
                  </td>
                  <td className="px-5 py-4">
                    <Badge status={c.status} />
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
