import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio CMS Admin",
  description: "Multi-tenant admin panel for the studio CMS.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-surface text-primary antialiased">{children}</body>
    </html>
  );
}
