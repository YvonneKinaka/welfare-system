"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import StatCard from "@/components/ui/StatCard";

type Contribution = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  case: { beneficiary: { fullName: string } };
};
type MemberData = {
  member: { fullName: string; membershipNumber: string; contributions: Contribution[] };
};

export default function AdminMemberStatementPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    fetch(`/api/admin/members/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  const contributions = data?.member.contributions ?? [];
  const paid = contributions.filter((c) => c.status === "PAID");
  const totalContributed = paid.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">
        {data ? `${data.member.fullName}'s Statement` : "Member Statement"}
      </h1>
      <p className="text-body mb-8">
        The same statement this member sees on their own portal.
        {data && <span className="font-mono"> · {data.member.membershipNumber}</span>}
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Contributed" value={`KSh ${totalContributed.toLocaleString()}`} tone="plain" />
        <StatCard label="Contributions" value={paid.length} tone="plain" />
        <StatCard label="Statement Period" value="All time" tone="plain" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <FileText size={18} className="text-brand-600" />
        <h2 className="font-display text-xl font-semibold text-ink">Contribution Statement</h2>
      </div>
      <Card className="p-0 overflow-hidden mb-6">
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
            {!data && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
            {contributions.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-5 py-4 text-body">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4 font-semibold text-ink">{c.case.beneficiary.fullName}</td>
                <td className="px-5 py-4 font-mono text-body">KSh {c.amount}</td>
                <td className="px-5 py-4">
                  <Badge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <a href={`/api/admin/statement/${id}`}>
        <Button>
          <Download size={16} /> Download PDF Statement
        </Button>
      </a>
    </div>
  );
}
