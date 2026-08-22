import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Church Welfare",
  description: "Contribution and welfare records for our church community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-paper text-ink min-h-screen">{children}</body>
    </html>
  );
}
