import SuperAdminSidebar from "@/components/SuperAdminSidebar";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <SuperAdminSidebar />
      <main className="flex-1 px-10 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
