"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { MobileSidebar } from "./Sidebar";
import { GlobalSearch } from "@/components/common/GlobalSearch";

export function Topbar({ userName, tallerName }: { userName?: string; tallerName?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ redirect: true, callbackUrl: "/auth/login" });
  }

  const initial = (userName || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-carbon-700 bg-carbon-900/80 px-4 backdrop-blur-md lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-carbon-300 hover:bg-carbon-800 hover:text-white lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white">{tallerName || "Tu Taller"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlobalSearch />
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-400 ring-1 ring-inset ring-brand-500/30">
              {initial}
            </div>
            <span className="text-xs text-carbon-300">{userName}</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-600 px-2.5 py-1.5 text-xs font-medium text-carbon-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? "Saliendo..." : "Salir"}
          </button>
        </div>
      </header>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
