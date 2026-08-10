"use client";

import { useEffect, useState } from "react";
import { Calendar, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import PayNowButton from "@/components/PayNowButton";

type Contribution = {
  id: string;
  amount: number;
  status: string;
  case: {
    deadline: string;
    beneficiary: { fullName: string };
    contributions: { status: string }[];
  };
};
type MemberData = { active: Contribution[]; outstanding: Contribution[] };

export default function ActiveContributionsPage() {
  const [data, setData] = useState<MemberData | null>(null);

  useEffect(() => {
    fetch("/api/member/me")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Member Portal</p>
      <h1 className="font-display text-4xl font-semibold text-ink mb-1">Active Contributions</h1>
      <p className="text-body mb-8">Contribution cases currently open that involve you.</p>

      {!data ? (
        <p className="text-body">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.active.map((c) => {
            const total = c.case.contributions.length;
            const paid = c.case.contributions.filter((x) => x.status === "PAID").length;
            const isOutstanding = data.outstanding.some((o) => o.id === c.id);
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-body">Beneficiary</p>
                  <Badge status={isOutstanding ? "LAPSED" : "PENDING"} />
                </div>
                <p className="font-display font-semibold text-ink mb-3">{c.case.beneficiary.fullName}</p>
                <ProgressBar paid={paid} total={total} amountLabel={`KSh ${paid * 300} / ${total * 300}`} />
                <div className="flex items-center gap-4 mt-3 text-xs text-body">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Due {new Date(c.case.deadline).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {paid}/{total}
                  </span>
                </div>
                <PayNowButton targetType="WELFARE_CONTRIBUTION" targetId={c.id} className="mt-4" />
              </Card>
            );
          })}
          {data.active.length === 0 && <p className="text-body text-sm">Nothing active right now.</p>}
        </div>
      )}
    </div>
  );
}
