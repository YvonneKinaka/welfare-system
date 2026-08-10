"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type Member = {
  id: string;
  fullName: string;
  membershipNumber: string;
  phone: string;
  email: string | null;
  status: string;
  missedCount: number;
  beneficiaries: { id: string }[];
};

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members));
  }, []);

  const filtered = members?.filter((m) =>
    `${m.fullName} ${m.membershipNumber} ${m.phone} ${m.email ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">Members</h1>
          <p className="text-body">Registered church members and their status.</p>
        </div>
        <Link href="/admin/members/new">
          <Button>
            <Plus size={16} /> Register Member
          </Button>
        </Link>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-body" />
        <input
          placeholder="Search members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-full border border-line bg-white pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-body/60 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-brand-50/70 text-body text-sm">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtered && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {filtered?.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>
                  No members match your search.
                </td>
              </tr>
            )}
            {filtered?.map((m) => (
              <tr key={m.id} className="border-t border-line hover:bg-brand-50/40">
                <td className="px-5 py-4">
                  <Link href={`/admin/members/${m.id}`} className="font-semibold text-ink hover:text-brand-600">
                    {m.fullName}
                  </Link>
                  {m.missedCount > 0 && (
                    <p className="text-xs text-danger-text">{m.missedCount} missed contribution(s)</p>
                  )}
                </td>
                <td className="px-5 py-4 text-body">{m.phone}</td>
                <td className="px-5 py-4 text-body">{m.email ?? "—"}</td>
                <td className="px-5 py-4">
                  <Badge status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
