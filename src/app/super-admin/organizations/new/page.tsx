"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [memberIdPrefix, setMemberIdPrefix] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/super-admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, memberIdPrefix: memberIdPrefix || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push("/super-admin/dashboard");
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Super Admin</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Create an organization</h1>
      <p className="text-body mb-6">Each organization can later have its own members, cases, and admins.</p>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Organization name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grace Chapel Nairobi"
          />
          <Input
            label="Member ID prefix (optional)"
            value={memberIdPrefix}
            onChange={(e) => setMemberIdPrefix(e.target.value.toUpperCase())}
            placeholder="e.g. RGC - members become RGC-000001"
            maxLength={6}
          />
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create organization"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
