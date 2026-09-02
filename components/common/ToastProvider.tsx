"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  const colors: Record<ToastType, string> = {
    success: "border-emerald-500/40 bg-carbon-800 text-emerald-300",
    error: "border-red-500/40 bg-carbon-800 text-red-300",
    info: "border-carbon-600 bg-carbon-800 text-carbon-200",
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${colors[t.type]} animate-fade-in flex min-w-[240px] max-w-sm items-start justify-between gap-3 rounded-lg border px-4 py-3 shadow-elevated`}
          >
            <span className="text-sm">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-sm leading-none text-carbon-400 hover:text-white"
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}
