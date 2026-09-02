"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_HOME } from "./navConfig";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ href, label, Icon, active, onNavigate }: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-500/10 text-brand-400"
          : "text-carbon-300 hover:bg-carbon-800 hover:text-white"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand-400" />
      )}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-400" : "text-carbon-400 group-hover:text-white")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400 ring-1 ring-inset ring-brand-500/30">
          <Wrench className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">AUTOMEK</p>
          <p className="text-[11px] text-carbon-400">Gestión de Taller</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div>
          <NavLink
            href={NAV_HOME.href}
            label={NAV_HOME.label}
            Icon={NAV_HOME.icon}
            active={isActive(pathname, NAV_HOME.href)}
            onNavigate={onNavigate}
          />
        </div>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-carbon-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                  active={isActive(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-carbon-700 bg-carbon-900 lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent />
      </div>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 h-full w-64 animate-scale-in bg-carbon-900 shadow-elevated">
        <button
          onClick={onClose}
          className="absolute right-3 top-4 rounded-md p-1.5 text-carbon-400 hover:bg-carbon-800 hover:text-white"
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}
