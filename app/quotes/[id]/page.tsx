"use client";

import { formatCurrency } from "@/lib/utils";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Pencil, X, ArrowRightCircle } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/EmptyState";
import { formatDateAR } from "@/lib/dates";

interface QuoteItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface Quote {
  id: string;
  status: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  total: number;
  fecha: string;
  observaciones?: string;
  client: { id: string; nombre: string };
  vehicle: { id: string; patente: string; marca: string; modelo: string };
  items: QuoteItem[];
  workOrder?: { id: string } | null;
}

interface QuoteItemForm {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger"> = {
  PENDIENTE: "warning",
  APROBADO: "success",
  RECHAZADO: "danger",
};

export default function QuoteDetailPage() {
  const { submitting, guard } = useSubmitGuard();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<QuoteItemForm[]>([]);

  useEffect(() => {
    loadQuote();
  }, [quoteId]);

  async function loadQuote() {
    try {
      setLoading(true);
      const response = await fetch(`/api/quotes/${quoteId}`);
      if (response.ok) {
        const data = await response.json();
        setQuote(data);
        setObservaciones(data.observaciones || "");
        setItems(
          data.items.map((item: QuoteItem) => ({
            descripcion: item.descripcion,
            cantidad: String(item.cantidad),
            precioUnitario: String(item.precioUnitario),
          }))
        );
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error loading quote:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems([...items, { descripcion: "", cantidad: "1", precioUnitario: "0" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuoteItemForm, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  const editTotal = items.reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0),
    0
  );

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: quote.client.id,
          vehicleId: quote.vehicle.id,
          observaciones: observaciones || undefined,
          items: items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
          })),
        }),
      });

      if (response.ok) {
        setEditing(false);
        showToast("Presupuesto actualizado correctamente", "success");
        loadQuote();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error actualizando presupuesto", "error");
    }
  }

  async function changeStatus(status: string) {
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        showToast("Estado actualizado correctamente", "success");
        loadQuote();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error cambiando estado", "error");
    }
  }

  async function convertToWorkOrder() {
    if (!quote) return;
    if (!confirm("¿Convertir este presupuesto en una orden de trabajo?")) return;
    try {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: quote.client.id,
          vehicleId: quote.vehicle.id,
          quoteId: quote.id,
          motivoIngreso: quote.observaciones || "Trabajos según presupuesto",
          items: quote.items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
        }),
      });
      if (response.ok) {
        const workOrder = await response.json();
        showToast("Presupuesto convertido a orden de trabajo", "success");
        router.push(`/work-orders/${workOrder.id}`);
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error convirtiendo a orden de trabajo", "error");
    }
  }

  return (
    <AppShell>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : notFound || !quote ? (
        <p className="text-sm text-carbon-400">Presupuesto no encontrado</p>
      ) : (
        <>
          <div className="no-print mb-6 flex items-center justify-between">
            <Link href="/quotes" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
              <ArrowLeft className="h-4 w-4" /> Volver a Presupuestos
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>

          <Card className="mb-8">
            <CardContent>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Presupuesto #{quote.id.slice(-6)}</h1>
                  <p className="text-sm text-carbon-400">{formatDateAR(quote.fecha)}</p>
                </div>
                <Badge variant={STATUS_VARIANT[quote.status]}>{STATUS_LABELS[quote.status]}</Badge>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-carbon-400">Cliente</span>
                  <p className="font-medium text-carbon-100">{quote.client.nombre}</p>
                </div>
                <div>
                  <span className="text-xs text-carbon-400">Vehículo</span>
                  <p className="font-medium text-carbon-100">
                    {quote.vehicle.patente} - {quote.vehicle.marca} {quote.vehicle.modelo}
                  </p>
                </div>
              </div>

              {quote.workOrder ? (
                <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                  <ArrowRightCircle className="h-4 w-4 shrink-0" />
                  Este presupuesto ya fue convertido en la orden #{quote.workOrder.id.slice(-6)}. Ya no se puede modificar.
                  <Link href={`/work-orders/${quote.workOrder.id}`} className="font-medium text-brand-400 hover:text-brand-300">
                    Ver orden →
                  </Link>
                </div>
              ) : (
              <div className="no-print flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => changeStatus("PENDIENTE")} disabled={quote.status === "PENDIENTE"}>
                  Marcar Pendiente
                </Button>
                <Button size="sm" variant="success" onClick={() => changeStatus("APROBADO")} disabled={quote.status === "APROBADO"}>
                  Aprobar
                </Button>
                <Button size="sm" variant="danger" onClick={() => changeStatus("RECHAZADO")} disabled={quote.status === "RECHAZADO"}>
                  Rechazar
                </Button>
                {quote.status === "APROBADO" && (
                  <Button size="sm" onClick={guard(convertToWorkOrder)} loading={submitting}>
                    <ArrowRightCircle className="h-3.5 w-3.5" /> Convertir a Orden de Trabajo
                  </Button>
                )}
              </div>
              )}
            </CardContent>
          </Card>

          <div className="no-print mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Ítems / Trabajos</h2>
            {!quote.workOrder && (
              <Button variant="secondary" onClick={() => setEditing(!editing)}>
                <Pencil className="h-4 w-4" /> {editing ? "Cancelar" : "Editar Presupuesto"}
              </Button>
            )}
          </div>

          {editing ? (
            <Card className="mb-8">
              <CardContent>
                <form onSubmit={guard(handleSaveEdit)} className="space-y-4">
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2">
                        <Input
                          type="text"
                          placeholder="Descripción *"
                          value={item.descripcion}
                          onChange={(e) => updateItem(index, "descripcion", e.target.value)}
                          className="col-span-6"
                          required
                        />
                        <Input
                          type="number"
                          placeholder="Cant."
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => updateItem(index, "cantidad", e.target.value)}
                          className="col-span-2"
                          required
                        />
                        <Input
                          type="number"
                          placeholder="Precio Unit."
                          min="0"
                          step="0.01"
                          value={item.precioUnitario}
                          onChange={(e) => updateItem(index, "precioUnitario", e.target.value)}
                          className="col-span-3"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="col-span-1 flex items-center justify-center text-red-400 hover:text-red-300 disabled:opacity-30"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addItem} className="text-sm font-medium text-brand-400 hover:text-brand-300">
                    + Agregar ítem
                  </button>

                  <Textarea placeholder="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />

                  <div className="flex items-center justify-between border-t border-carbon-700 pt-4">
                    <p className="text-lg font-bold text-white">Total: {formatCurrency(editTotal)}</p>
                    <Button type="submit" loading={submitting}>Guardar Cambios</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-8">
              <Table>
                <Thead>
                  <tr>
                    <Th>Descripción</Th>
                    <Th>Cantidad</Th>
                    <Th>Precio Unit.</Th>
                    <Th>Subtotal</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {quote.items.map((item) => (
                    <Tr key={item.id}>
                      <Td>{item.descripcion}</Td>
                      <Td className="text-carbon-400">{item.cantidad}</Td>
                      <Td className="text-carbon-400">{formatCurrency(item.precioUnitario)}</Td>
                      <Td className="font-medium">{formatCurrency(item.subtotal)}</Td>
                    </Tr>
                  ))}
                </Tbody>
                <tfoot>
                  <tr className="bg-carbon-800/60">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-white">
                      Total:
                    </td>
                    <td className="px-4 py-3 font-bold text-white">{formatCurrency(quote.total)}</td>
                  </tr>
                </tfoot>
              </Table>
              {quote.observaciones && (
                <div className="border-t border-carbon-700 p-5">
                  <span className="text-xs text-carbon-400">Observaciones</span>
                  <p className="text-carbon-100">{quote.observaciones}</p>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
