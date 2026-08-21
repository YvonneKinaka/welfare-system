"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function NewMemberPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tamashaUserId, setTamashaUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email,
        tamashaUserId: tamashaUserId ? Number(tamashaUserId) : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const params = new URLSearchParams();
    if (data.tamashaWarning) params.set("tamashaWarning", data.tamashaWarning);
    else if (data.tamashaLinked) params.set("tamashaLinked", "1");
    const qs = params.toString();
    router.push(`/admin/members/${data.member.id}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wide mb-1">Administrator</p>
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Register a member</h1>
      <p className="text-body mb-6">
        A membership number will be generated automatically, and this member will be linked to a
        Tamasha welfare account.
      </p>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input
            label="Phone number"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678"
          />
          <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Tamasha User ID (optional)"
            type="number"
            value={tamashaUserId}
            onChange={(e) => setTamashaUserId(e.target.value)}
            placeholder="Leave blank to create a new Tamasha account automatically"
          />
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Register member"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
