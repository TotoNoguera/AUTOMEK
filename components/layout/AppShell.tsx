"use client";

import { useSession } from "next-auth/react";
import { ApiErrorWatcher } from "@/components/common/ApiErrorWatcher";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  tallerName,
}: {
  children: React.ReactNode;
  tallerName?: string;
}) {
  const { data: session } = useSession();

  return (
    <div className="flex min-h-screen bg-carbon-950">
      <ApiErrorWatcher />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={session?.user?.name} tallerName={tallerName} />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
