import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";
import RouteLoader from "@/components/RouteLoader";

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
      <body className="antialiased">
        <AuthProvider>
          <ToastProvider>
            <RouteLoader />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
