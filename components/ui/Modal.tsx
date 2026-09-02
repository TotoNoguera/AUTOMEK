"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg animate-scale-in rounded-xl border border-carbon-700 bg-carbon-850 shadow-elevated",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-carbon-700 px-5 py-4">
            <h2 className="text-sm font-semibold text-carbon-100">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-carbon-400 hover:bg-carbon-800 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
