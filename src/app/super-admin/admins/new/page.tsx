"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type Organization = { id: string; name: string };

export default function NewOrgAdminPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", organizationId: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/super-admin/organizations")
      .then((r) => r.json())
      .then((d) => setOrganizations(d.organizations));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/super-admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
      <h1 className="font-display text-3xl font-semibold text-ink mb-1">Create an organization admin</h1>
      <p className="text-body mb-6">This admin will manage members, beneficiaries, and cases for one organization.</p>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Full name"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Temporary password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 8 characters"
          />
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Organization</label>
            <select
              required
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              className="w-full rounded-full border border-line bg-white px-5 py-3 text-base text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">Select an organization…</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {organizations.length === 0 && (
              <p className="mt-1 text-sm text-body">
                No organizations yet — create one first.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create admin"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
