import MemberSidebar from "@/components/MemberSidebar";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <MemberSidebar />
      <main className="flex-1 px-10 py-8 max-w-5xl">{children}</main>
    </div>
  );
}
