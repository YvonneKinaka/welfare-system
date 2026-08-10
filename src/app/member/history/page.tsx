"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

type Contribution = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  case: { beneficiary: { fullName: string } };
};
type MemberData = { member: { contributions: Contribution[] } };

export default function MemberHistoryPage() {
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    fetch("/api/member/me")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Member Portal</p>
          <h1 className="font-display text-4xl font-semibold text-ink mb-1">Contribution History</h1>
          <p className="text-body">All contributions you have made to welfare cases.</p>
        </div>
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
            {data?.member.contributions.length === 0 && (
              <tr>
                <td className="px-5 py-6 text-body" colSpan={4}>
                  No contribution records yet.
                </td>
              </tr>
            )}
            {data?.member.contributions.map((c) => (
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

      <a href="/api/member/statement">
        <Button variant="secondary">
          <Download size={14} /> Download Statement
        </Button>
      </a>
    </div>
  );
}
