import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout";
import { QueryProvider } from "@/lib/query";
import { NotificationToast } from "@/components/ui/notification-toast";
import { AuthInitializer } from "@/components/auth/auth-initializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentForge",
  description: "Visual AI Agent Workflow Builder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <AuthInitializer />
          <AppShell>{children}</AppShell>
          <NotificationToast />
        </QueryProvider>
      </body>
    </html>
  );
}
