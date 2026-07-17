import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site Template",
  description: "Client site template for the studio CMS.",
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
