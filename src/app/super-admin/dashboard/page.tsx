"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Building2, UserPlus, Users, Wallet2, Ban, CheckCircle2, Trash2 } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type Organization = { id: string; name: string; createdAt: string; memberIdPrefix: string; _count: { admins: number } };
type OrgAdmin = {
  id: string;
  fullName: string;
  email: string;
  status: string;
  organization: { id: string; name: string } | null;
};
type Stats = { totalOrganizations: number; totalAdmins: number; totalMembers: number; totalWelfareCollected: number };

export default function SuperAdminDashboardPage() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [admins, setAdmins] = useState<OrgAdmin[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/super-admin/organizations")
      .then((r) => r.json())
      .then((d) => setOrgs(d.organizations));
    fetch("/api/super-admin/admins")
      .then((r) => r.json())
      .then((d) => setAdmins(d.admins));
    fetch("/api/super-admin/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleSuspend(admin: OrgAdmin) {
    setActingId(admin.id);
    await fetch(`/api/super-admin/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }),
    });
    setActingId(null);
    load();
  }

  async function deleteAdmin(admin: OrgAdmin) {
    if (!confirm(`Permanently delete ${admin.fullName}'s admin account?`)) return;
    setActingId(admin.id);
    await fetch(`/api/super-admin/admins/${admin.id}`, { method: "DELETE" });
    setActingId(null);
    load();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Super Admin</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Organizations Overview</h1>
      <p className="text-body mb-8">
        Manage organizations and their administrators. Foundation for multi-organization support.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Organizations" value={stats?.totalOrganizations ?? "—"} tone="plain" icon={<Building2 size={16} />} />
        <StatCard label="Organization Admins" value={stats?.totalAdmins ?? "—"} tone="plain" icon={<Users size={16} />} />
        <StatCard label="Total Members" value={stats?.totalMembers ?? "—"} tone="plain" icon={<Users size={16} />} />
        <StatCard
          label="Welfare Collected (all orgs)"
          value={stats ? `KSh ${stats.totalWelfareCollected.toLocaleString()}` : "—"}
          tone="brand"
          icon={<Wallet2 size={16} />}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold text-ink">Organizations</h2>
        <Link href="/super-admin/organizations/new">
          <Button>
            <Building2 size={16} /> New Organization
          </Button>
        </Link>
      </div>
      <Card className="p-0 overflow-hidden mb-10">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Member ID Prefix</th>
              <th className="px-5 py-3 font-medium">Admins</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {!orgs && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>Loading…</td>
              </tr>
            )}
            {orgs?.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>No organizations yet.</td>
              </tr>
            )}
            {orgs?.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-5 py-4 font-semibold text-ink">{o.name}</td>
                <td className="px-5 py-4 font-mono text-sm text-body">{o.memberIdPrefix}-000001…</td>
                <td className="px-5 py-4 text-body">{o._count.admins}</td>
                <td className="px-5 py-4 text-body">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-semibold text-ink">Organization Admins</h2>
        <Link href="/super-admin/admins/new">
          <Button variant="secondary">
            <UserPlus size={16} /> New Org Admin
          </Button>
        </Link>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Organization</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!admins && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={5}>Loading…</td>
              </tr>
            )}
            {admins?.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={5}>No organization admins yet.</td>
              </tr>
            )}
            {admins?.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="px-5 py-4 font-semibold text-ink">{a.fullName}</td>
                <td className="px-5 py-4 text-body">{a.email}</td>
                <td className="px-5 py-4 text-body">{a.organization?.name ?? "—"}</td>
                <td className="px-5 py-4">
                  <Badge status={a.status} />
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={actingId === a.id}
                      onClick={() => toggleSuspend(a)}
                    >
                      {a.status === "ACTIVE" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                      {a.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </Button>
                    <Button variant="danger" disabled={actingId === a.id} onClick={() => deleteAdmin(a)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
