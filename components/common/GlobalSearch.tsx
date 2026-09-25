"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Car, Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeText, phoneDigits } from "@/lib/text";

interface ClientResult {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
}

interface VehicleResult {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  client: { id: string; nombre: string };
}

interface WorkOrderResult {
  id: string;
  motivoIngreso: string;
  status: string;
  client: { nombre: string };
  vehicle: { patente: string };
}

type ResultItem =
  | { type: "client"; data: ClientResult }
  | { type: "vehicle"; data: VehicleResult }
  | { type: "workorder"; data: WorkOrderResult };

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResult[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Se recarga cada vez que se abre: así aparecen los clientes/órdenes recién creados
      loadAll();
    }
  }, [open]);

  async function loadAll() {
    try {
      setLoading(true);
      const [clientsRes, vehiclesRes, workOrdersRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/vehicles"),
        fetch("/api/work-orders"),
      ]);
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (vehiclesRes.ok) setVehicles(await vehiclesRes.json());
      if (workOrdersRes.ok) setWorkOrders(await workOrdersRes.json());
    } catch (error) {
      console.error("Error loading global search data:", error);
    } finally {
      setLoading(false);
    }
  }

  const q = normalizeText(query);
  const qCompact = q.replace(/[s-]+/g, "");
  const qDigits = phoneDigits(query);
  const has = (value: string | null | undefined) => normalizeText(value).includes(q);

  const results: ResultItem[] = q
    ? [
        ...clients
          .filter(
            (c) =>
              has(c.nombre) ||
              has(c.telefono) ||
              has(c.email) ||
              (qDigits.length >= 3 && phoneDigits(c.telefono).includes(qDigits))
          )
          .slice(0, 6)
          .map((data): ResultItem => ({ type: "client", data })),
        ...vehicles
          .filter(
            (v) =>
              normalizeText(v.patente).includes(qCompact) ||
              has(v.marca) ||
              has(v.modelo) ||
              has(v.client.nombre)
          )
          .slice(0, 6)
          .map((data): ResultItem => ({ type: "vehicle", data })),
        ...workOrders
          .filter(
            (wo) =>
              wo.id.slice(-6).toLowerCase().includes(q) ||
              has(wo.client.nombre) ||
              normalizeText(wo.vehicle.patente).includes(qCompact) ||
              has(wo.motivoIngreso)
          )
          .slice(0, 6)
          .map((data): ResultItem => ({ type: "workorder", data })),
      ]
    : [];

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-carbon-600 bg-carbon-900 px-3 py-1.5 text-xs text-carbon-400 transition-colors hover:border-carbon-500 hover:text-carbon-200"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar cliente, patente, orden...</span>
        <kbd className="ml-2 hidden rounded border border-carbon-600 px-1.5 py-0.5 text-[10px] text-carbon-500 sm:inline">Ctrl K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-xl animate-scale-in rounded-xl border border-carbon-700 bg-carbon-850 shadow-elevated">
        <div className="flex items-center gap-2.5 border-b border-carbon-700 px-4 py-3">
          <Search className="h-4 w-4 text-carbon-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cliente, teléfono, patente, vehículo u orden..."
            className="flex-1 bg-transparent text-sm text-carbon-100 placeholder:text-carbon-500 focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-carbon-400" />}
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {!q ? (
            <p className="px-3 py-6 text-center text-xs text-carbon-500">Escribí para buscar en clientes, vehículos y órdenes.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-carbon-500">Sin resultados para &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((r, i) => (
                <li key={`${r.type}-${i}`}>
                  {r.type === "client" && (
                    <button
                      onClick={() => go(`/clients/${r.data.id}`)}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-carbon-800")}
                    >
                      <User className="h-4 w-4 shrink-0 text-brand-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-carbon-100">{r.data.nombre}</p>
                        <p className="truncate text-xs text-carbon-500">{r.data.telefono || r.data.email || "Cliente"}</p>
                      </div>
                    </button>
                  )}
                  {r.type === "vehicle" && (
                    <button
                      onClick={() => go(`/vehicles/${r.data.id}/history`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-carbon-800"
                    >
                      <Car className="h-4 w-4 shrink-0 text-brand-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-carbon-100">{r.data.patente} — {r.data.marca} {r.data.modelo}</p>
                        <p className="truncate text-xs text-carbon-500">{r.data.client.nombre}</p>
                      </div>
                    </button>
                  )}
                  {r.type === "workorder" && (
                    <button
                      onClick={() => go(`/work-orders/${r.data.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-carbon-800"
                    >
                      <Wrench className="h-4 w-4 shrink-0 text-brand-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-carbon-100">Orden #{r.data.id.slice(-6)} — {r.data.client.nombre}</p>
                        <p className="truncate text-xs text-carbon-500">{r.data.vehicle.patente} · {r.data.motivoIngreso}</p>
                      </div>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
