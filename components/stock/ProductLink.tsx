"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Package, Search, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";
import { formatQuantity } from "@/lib/units";

export interface ProductOption {
  id: string;
  nombre: string;
  sku?: string | null;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  precioVenta: number;
  costo: number;
  stockBajo?: boolean;
}

// Los productos ya consultados se reutilizan mientras la pantalla está abierta
const productCache = new Map<string, ProductOption | null>();

/**
 * Vincula un ítem de presupuesto u orden con un producto del inventario (opcional). Sin producto muestra un buscador;
 * con producto muestra el stock disponible y avisa si la cantidad pedida lo supera. Al elegir uno, el formulario
 * autocompleta la descripción y el precio (que siguen siendo editables).
 */
export function ProductLink({
  productId,
  product,
  cantidad,
  contexto,
  onSelect,
  onClear,
}: {
  productId?: string;
  product?: ProductOption;
  cantidad?: number;
  /** "orden": el stock se descuenta al pasar a En proceso. "presupuesto": solo informa. */
  contexto: "presupuesto" | "orden";
  onSelect: (product: ProductOption) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ProductOption[] | null>(null);
  const [loaded, setLoaded] = useState<ProductOption | null | undefined>(product ?? (productId ? productCache.get(productId) : undefined));
  const boxRef = useRef<HTMLDivElement>(null);

  // Si el ítem solo trae el id (viene del servidor), se consulta el producto para mostrar su stock
  useEffect(() => {
    if (!productId || product || loaded !== undefined) return;
    let cancelled = false;
    fetch(`/api/products/${productId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: ProductOption | null) => {
        productCache.set(productId, p);
        if (!cancelled) setLoaded(p);
      })
      .catch(() => !cancelled && setLoaded(null));
    return () => {
      cancelled = true;
    };
  }, [productId, product, loaded]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      fetch(`/api/products?limit=8&q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((d) => setResults(d.products ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const current = product ?? loaded ?? undefined;

  if (productId) {
    const faltante = current && cantidad !== undefined && cantidad > current.stockActual;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-carbon-700 bg-carbon-800/60 px-3 py-2 text-xs">
        <Package className="h-3.5 w-3.5 shrink-0 text-brand-400" />
        {current ? (
          <>
            <span className="font-medium text-carbon-100">{current.nombre}</span>
            <span className="text-carbon-300">Stock disponible: {formatQuantity(current.stockActual, current.unidad)}</span>
            {current.stockBajo && !faltante && <span className="text-amber-400">Stock bajo</span>}
            {faltante && (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {contexto === "orden"
                  ? "Stock insuficiente: la orden no podrá pasar a En proceso hasta reponerlo"
                  : "Stock insuficiente hoy: reponelo antes de pasar la orden a En proceso"}
              </span>
            )}
          </>
        ) : (
          <span className="text-carbon-400">{loaded === null ? "Producto no disponible" : "Cargando producto…"}</span>
        )}
        <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 text-carbon-400 hover:text-red-300" aria-label="Quitar producto del ítem">
          <X className="h-3.5 w-3.5" /> Quitar
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-carbon-400" />
        <Input
          type="text"
          value={query}
          placeholder="Vincular un producto del inventario (opcional)…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          className="h-8 pl-8 text-xs"
          aria-label="Buscar producto del inventario"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-carbon-600 bg-carbon-850 shadow-elevated">
          {results === null ? (
            <p className="px-3 py-2 text-xs text-carbon-400">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-carbon-400">No hay productos activos que coincidan.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  productCache.set(p.id, p);
                  onSelect(p);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-carbon-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-carbon-100">{p.nombre}</span>
                  {p.sku && <span className="text-carbon-400">{p.sku}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className={p.stockActual <= 0 ? "block text-red-400" : p.stockBajo ? "block text-amber-400" : "block text-carbon-300"}>
                    Stock {formatQuantity(p.stockActual, p.unidad)}
                  </span>
                  <span className="text-carbon-400">{formatCurrency(p.precioVenta)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
