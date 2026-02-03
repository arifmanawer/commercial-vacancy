import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Vacancy Reuse Platform",
  description: "Find your perfect commercial space, event venue, or flexible rental",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
