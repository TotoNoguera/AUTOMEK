"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDownToLine, ArrowLeft, Pencil, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { AdjustModal, ProductFormModal, PurchaseModal, type ProductRow } from "@/components/stock/ProductModals";
import { formatCurrency } from "@/lib/utils";
import { formatDateTimeAR } from "@/lib/dates";
import { formatQuantity } from "@/lib/units";

interface Movement {
  id: string;
  tipo: "ENTRADA_COMPRA" | "SALIDA_ORDEN" | "AJUSTE" | "DEVOLUCION" | "ANULACION";
  cantidad: number;
  stockResultante: number;
  costoUnitario: number | null;
  motivo: string | null;
  workOrderId: string | null;
  createdAt: string;
  user?: { name: string; email: string };
}

const TIPO: Record<Movement["tipo"], { label: string; variant: "success" | "warning" | "info" | "brand" | "neutral" }> = {
  ENTRADA_COMPRA: { label: "Compra", variant: "success" },
  SALIDA_ORDEN: { label: "Consumo en orden", variant: "warning" },
  AJUSTE: { label: "Ajuste", variant: "info" },
  DEVOLUCION: { label: "Devolución", variant: "brand" },
  ANULACION: { label: "Anulación", variant: "neutral" },
};

const PAGE_SIZE = 50;

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [productRes, movementsRes] = await Promise.all([fetch(`/api/products/${productId}`), fetch(`/api/products/${productId}/movements?limit=${PAGE_SIZE}&page=1`)]);
      if (!productRes.ok) {
        setNotFound(true);
        return;
      }
      setProduct(await productRes.json());
      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setMovements(data.movements);
        setTotal(data.total);
        setPage(1);
      }
    } catch (error) {
      console.error("Error loading product:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    const next = page + 1;
    const response = await fetch(`/api/products/${productId}/movements?limit=${PAGE_SIZE}&page=${next}`);
    if (response.ok) {
      const data = await response.json();
      setMovements((m) => [...m, ...data.movements]);
      setPage(next);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" /> Volver a Productos
        </Link>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : notFound || !product ? (
        <p className="text-sm text-carbon-400">Producto no encontrado</p>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white">{product.nombre}</h1>
                  <p className="text-sm text-carbon-400">{[product.sku, product.categoria].filter(Boolean).join(" · ") || "Sin código ni categoría"}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant={product.activo ? "success" : "neutral"}>{product.activo ? "Activo" : "Inactivo"}</Badge>
                    {product.stockActual <= 0 ? <Badge variant="danger" dot>Sin stock</Badge> : product.stockBajo ? <Badge variant="warning" dot>Stock bajo</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setPurchaseOpen(true)} disabled={!product.activo}><ArrowDownToLine className="h-4 w-4" /> Cargar compra</Button>
                  <Button variant="secondary" onClick={() => setAdjustOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Ajustar stock</Button>
                  <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Editar</Button>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div><dt className="text-xs text-carbon-400">Stock actual</dt><dd className="text-lg font-semibold text-white">{formatQuantity(product.stockActual, product.unidad)}</dd></div>
                <div><dt className="text-xs text-carbon-400">Stock mínimo</dt><dd className="text-lg font-semibold text-carbon-200">{formatQuantity(product.stockMinimo, product.unidad)}</dd></div>
                <div><dt className="text-xs text-carbon-400">Costo</dt><dd className="text-lg font-semibold text-carbon-200">{formatCurrency(product.costo)}</dd></div>
                <div><dt className="text-xs text-carbon-400">Precio de venta</dt><dd className="text-lg font-semibold text-carbon-200">{formatCurrency(product.precioVenta)}</dd></div>
                <div>
                  <dt className="text-xs text-carbon-400">Margen</dt>
                  <dd className={`text-lg font-semibold ${product.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(product.margen)}
                    {product.margenPorcentaje !== null && <span className="ml-1 text-xs font-normal">({product.margenPorcentaje.toLocaleString("es-AR")}%)</span>}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <h2 className="mb-3 text-sm font-semibold text-carbon-100">Historial de movimientos ({total})</h2>
          {movements.length === 0 ? (
            <Card><EmptyState title="Este producto todavía no tiene movimientos" description="Cargá una compra o un ajuste para registrar el primer movimiento." /></Card>
          ) : (
            <>
              <Table>
                <Thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Cantidad</Th>
                    <Th className="text-right">Stock resultante</Th>
                    <Th>Orden</Th>
                    <Th>Motivo</Th>
                    <Th>Usuario</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {movements.map((m) => (
                    <Tr key={m.id}>
                      <Td className="whitespace-nowrap text-carbon-300">{formatDateTimeAR(m.createdAt)}</Td>
                      <Td><Badge variant={TIPO[m.tipo].variant}>{TIPO[m.tipo].label}</Badge></Td>
                      <Td className={`text-right font-medium ${m.cantidad >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                        {m.cantidad >= 0 ? "+" : "−"}{formatQuantity(Math.abs(m.cantidad), product.unidad)}
                      </Td>
                      <Td className="text-right">{formatQuantity(m.stockResultante, product.unidad)}</Td>
                      <Td>{m.workOrderId ? <Link href={`/work-orders/${m.workOrderId}`} className="text-brand-400 hover:text-brand-300">#{m.workOrderId.slice(-6)}</Link> : <span className="text-carbon-500">—</span>}</Td>
                      <Td className="max-w-xs text-carbon-300">{m.motivo ?? "—"}</Td>
                      <Td className="text-carbon-400">{m.user?.name ?? "—"}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {movements.length < total && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={loadMore}>Cargar más movimientos</Button>
                </div>
              )}
            </>
          )}

          <ProductFormModal open={editOpen} onClose={() => setEditOpen(false)} product={product} onSaved={load} />
          <PurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} product={product} onDone={load} />
          <AdjustModal open={adjustOpen} onClose={() => setAdjustOpen(false)} product={product} onDone={load} />
        </>
      )}
    </AppShell>
  );
}
