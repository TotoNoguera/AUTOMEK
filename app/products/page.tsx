"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownToLine, History, Package, Pencil, Plus, Power, Search, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { AdjustModal, ProductFormModal, PurchaseModal, type ProductRow } from "@/components/stock/ProductModals";
import { formatCurrency } from "@/lib/utils";
import { formatQuantity } from "@/lib/units";

interface ListResponse {
  products: ProductRow[];
  total: number;
  stockBajoCount: number;
}

function StockBadge({ p }: { p: ProductRow }) {
  if (p.stockActual <= 0) return <Badge variant="danger" dot>Sin stock</Badge>;
  if (p.stockBajo) return <Badge variant="warning" dot>Stock bajo</Badge>;
  return null;
}

function ProductsContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [estado, setEstado] = useState("activos");
  const [bajoStock, setBajoStock] = useState(searchParams.get("bajoStock") === "1");
  const [permitirNegativo, setPermitirNegativo] = useState<boolean | null>(null);
  const [confirmPolicy, setConfirmPolicy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<ProductRow | null>(null);
  const [adjustFor, setAdjustFor] = useState<ProductRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState<"purchase" | "adjust" | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ estado, limit: "200" });
      if (debouncedQ) params.set("q", debouncedQ);
      if (bajoStock) params.set("bajoStock", "1");
      const response = await fetch(`/api/products?${params}`);
      if (response.ok) setData(await response.json());
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  }, [estado, debouncedQ, bajoStock]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/stock/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setPermitirNegativo(s.permitirStockNegativo))
      .catch(() => undefined);
  }, []);

  async function savePolicy(value: boolean) {
    try {
      const response = await fetch("/api/stock/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permitirStockNegativo: value }) });
      if (response.ok) {
        setPermitirNegativo(value);
        showToast(value ? "Stock negativo habilitado" : "Stock negativo deshabilitado", "success");
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch {
      showToast("Error guardando la configuración", "error");
    } finally {
      setConfirmPolicy(false);
    }
  }

  async function toggleActivo(p: ProductRow) {
    try {
      const response = await fetch(`/api/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: p.nombre, sku: p.sku || undefined, categoria: p.categoria || undefined, unidad: p.unidad, costo: p.costo, precioVenta: p.precioVenta, stockMinimo: p.stockMinimo, activo: !p.activo }),
      });
      if (response.ok) {
        showToast(p.activo ? "Producto desactivado" : "Producto activado", "success");
        load();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch {
      showToast("Error actualizando el producto", "error");
    }
  }

  const products = data?.products ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Productos"
        description="Repuestos e insumos del taller: stock, costos y márgenes"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPickerOpen("purchase")} disabled={products.length === 0}>
              <ArrowDownToLine className="h-4 w-4" /> Cargar compra
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={estado === "activos" && !debouncedQ && !bajoStock ? "Productos activos" : "Resultados del filtro"} value={data ? String(data.total) : "—"} icon={Package} tone="brand" />
        <button type="button" onClick={() => setBajoStock((v) => !v)} className="text-left" aria-pressed={bajoStock}>
          <StatCard label={bajoStock ? "Mostrando solo stock bajo (tocá para ver todos)" : "Con stock bajo (tocá para filtrar)"} value={data ? String(data.stockBajoCount) : "—"} icon={AlertTriangle} tone={data && data.stockBajoCount > 0 ? "warning" : "success"} className={bajoStock ? "ring-1 ring-amber-500/50" : ""} />
        </button>
        <Card className="p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-carbon-600 bg-carbon-900 accent-brand-500"
              checked={permitirNegativo === true}
              disabled={permitirNegativo === null}
              onChange={(e) => (e.target.checked ? setConfirmPolicy(true) : savePolicy(false))}
            />
            <span>
              <span className="block text-sm font-medium text-carbon-100">Permitir stock negativo</span>
              <span className="block text-xs text-carbon-400">
                {permitirNegativo ? "Las órdenes pueden descontar más de lo disponible." : "Por defecto: una orden no pasa a En proceso si falta stock."}
              </span>
            </span>
          </label>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o categoría…" className="pl-9" aria-label="Buscar productos" />
        </div>
        <Select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-40" aria-label="Estado">
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-carbon-200">
          <input type="checkbox" className="h-4 w-4 rounded border-carbon-600 bg-carbon-900 accent-brand-500" checked={bajoStock} onChange={(e) => setBajoStock(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={debouncedQ || bajoStock || estado !== "activos" ? "No hay productos que coincidan" : "Todavía no cargaste productos"}
            description={debouncedQ || bajoStock || estado !== "activos" ? "Probá con otra búsqueda o cambiá los filtros." : "Cargá tus repuestos e insumos para controlar el stock, calcular márgenes y descontarlos de las órdenes."}
            action={!debouncedQ && !bajoStock && estado === "activos" ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Nuevo producto</Button> : undefined}
          />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Producto</Th>
              <Th className="text-right">Stock</Th>
              <Th className="hidden text-right lg:table-cell">Costo</Th>
              <Th className="hidden text-right lg:table-cell">Precio</Th>
              <Th className="text-right">Margen</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {products.map((p) => (
              <Tr key={p.id} className={p.activo ? "" : "opacity-60"}>
                <Td>
                  <Link href={`/products/${p.id}`} className="font-medium text-white hover:text-brand-300">{p.nombre}</Link>
                  <div className="text-xs text-carbon-400">{[p.sku, p.categoria].filter(Boolean).join(" · ") || "—"}</div>
                </Td>
                <Td className="text-right">
                  <div className="font-medium">{formatQuantity(p.stockActual, p.unidad)}</div>
                  <div className="text-xs text-carbon-400">mín. {formatQuantity(p.stockMinimo)}</div>
                  <StockBadge p={p} />
                </Td>
                <Td className="hidden text-right text-carbon-300 lg:table-cell">{formatCurrency(p.costo)}</Td>
                <Td className="hidden text-right lg:table-cell">{formatCurrency(p.precioVenta)}</Td>
                <Td className={`text-right ${p.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(p.margen)}
                  {p.margenPorcentaje !== null && <div className="text-xs opacity-80">{p.margenPorcentaje.toLocaleString("es-AR")}%</div>}
                </Td>
                <Td><Badge variant={p.activo ? "success" : "neutral"}>{p.activo ? "Activo" : "Inactivo"}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    <button onClick={() => setPurchaseFor(p)} disabled={!p.activo} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40"><ArrowDownToLine className="h-3.5 w-3.5" /> Compra</button>
                    <button onClick={() => setAdjustFor(p)} className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"><SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar</button>
                    <Link href={`/products/${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-carbon-300 hover:text-white"><History className="h-3.5 w-3.5" /> Historial</Link>
                    <button onClick={() => { setEditing(p); setFormOpen(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button onClick={() => toggleActivo(p)} className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"><Power className="h-3.5 w-3.5" /> {p.activo ? "Desactivar" : "Activar"}</button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={editing} onSaved={load} />
      <PurchaseModal open={!!purchaseFor} onClose={() => setPurchaseFor(null)} product={purchaseFor} onDone={load} />
      <AdjustModal open={!!adjustFor} onClose={() => setAdjustFor(null)} product={adjustFor} onDone={load} />

      <Modal open={pickerOpen !== null} onClose={() => setPickerOpen(null)} title="¿De qué producto?">
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {products.filter((p) => p.activo).map((p) => (
            <button
              key={p.id}
              onClick={() => { setPurchaseFor(p); setPickerOpen(null); }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-carbon-800"
            >
              <span className="text-carbon-100">{p.nombre}</span>
              <span className="text-xs text-carbon-400">{formatQuantity(p.stockActual, p.unidad)}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={confirmPolicy} onClose={() => setConfirmPolicy(false)} title="Habilitar stock negativo">
        <p className="text-sm text-carbon-200">
          Con esta opción una orden podrá pasar a <strong>En proceso</strong> aunque no haya stock suficiente, y el producto quedará con saldo negativo hasta que cargues la compra.
        </p>
        <p className="mt-2 text-xs text-carbon-400">Por defecto se recomienda dejarla desactivada: protege el inventario de descuentos por error. El cambio queda registrado en la auditoría.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmPolicy(false)}>Cancelar</Button>
          <Button onClick={() => savePolicy(true)}>Habilitar</Button>
        </div>
      </Modal>
    </AppShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}
