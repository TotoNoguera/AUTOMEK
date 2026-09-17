"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer, Pencil, Trash2, Plus, MessageCircle } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink, whatsAppVehiculoListo, whatsAppRecordatorioPago } from "@/lib/whatsapp";

interface WorkOrderItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface Payment {
  monto: number;
  status: string;
}

interface WorkOrder {
  id: string;
  status: "PRESUPUESTA" | "APROBADA" | "EN_PROCESO" | "TERMINADA" | "ENTREGADA";
  total: number;
  fecha: string;
  motivoIngreso: string;
  diagnostico?: string;
  observaciones?: string;
  kmIngreso?: number;
  kmEgreso?: number;
  client: { id: string; nombre: string; telefono?: string };
  vehicle: { id: string; patente: string; marca: string; modelo: string };
  items: WorkOrderItem[];
  payments?: Payment[];
  margen?: number;
}

const STATUS_LABELS: Record<string, string> = {
  PRESUPUESTA: "Presupuestada",
  APROBADA: "Aprobada",
  EN_PROCESO: "En Proceso",
  TERMINADA: "Terminada",
  ENTREGADA: "Entregada",
};

const STATUS_VARIANT: Record<string, "neutral" | "info" | "warning" | "success" | "brand"> = {
  PRESUPUESTA: "neutral",
  APROBADA: "info",
  EN_PROCESO: "warning",
  TERMINADA: "success",
  ENTREGADA: "brand",
};

const STATUS_ORDER = ["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"];

export default function WorkOrderDetailPage() {
  const params = useParams();
  const { showToast } = useToast();
  const workOrderId = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  const [motivoIngreso, setMotivoIngreso] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [kmIngreso, setKmIngreso] = useState("");
  const [kmEgreso, setKmEgreso] = useState("");

  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCant, setNewItemCant] = useState("1");
  const [newItemPrecio, setNewItemPrecio] = useState("0");

  useEffect(() => {
    loadWorkOrder();
  }, [workOrderId]);

  async function loadWorkOrder() {
    try {
      setLoading(true);
      const response = await fetch(`/api/work-orders/${workOrderId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkOrder(data);
        setMotivoIngreso(data.motivoIngreso);
        setDiagnostico(data.diagnostico || "");
        setObservaciones(data.observaciones || "");
        setKmIngreso(data.kmIngreso?.toString() || "");
        setKmEgreso(data.kmEgreso?.toString() || "");
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error loading work order:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!workOrder) return;
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: workOrder.client.id,
          vehicleId: workOrder.vehicle.id,
          motivoIngreso,
          diagnostico: diagnostico || undefined,
          observaciones: observaciones || undefined,
          kmIngreso: kmIngreso ? parseInt(kmIngreso) : undefined,
          kmEgreso: kmEgreso ? parseInt(kmEgreso) : undefined,
          items: workOrder.items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
        }),
      });

      if (response.ok) {
        setEditing(false);
        showToast("Orden actualizada correctamente", "success");
        loadWorkOrder();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error actualizando orden de trabajo", "error");
    }
  }

  async function changeStatus(status: string) {
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        showToast("Estado actualizado correctamente", "success");
        loadWorkOrder();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error cambiando estado", "error");
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: newItemDesc,
          cantidad: Number(newItemCant) || 1,
          precioUnitario: Number(newItemPrecio) || 0,
        }),
      });
      if (response.ok) {
        setNewItemDesc("");
        setNewItemCant("1");
        setNewItemPrecio("0");
        showToast("Trabajo agregado correctamente", "success");
        loadWorkOrder();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error agregando trabajo", "error");
    }
  }

  async function removeItem(itemId: string) {
    if (!confirm("¿Quitar este trabajo?")) return;
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/items/${itemId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("Trabajo quitado", "success");
        loadWorkOrder();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error quitando trabajo", "error");
    }
  }

  const currentIndex = workOrder ? STATUS_ORDER.indexOf(workOrder.status) : -1;

  return (
    <AppShell>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : notFound || !workOrder ? (
        <p className="text-sm text-carbon-400">Orden de trabajo no encontrada</p>
      ) : (
        <>
          <div className="no-print mb-6 flex items-center justify-between">
            <Link href="/work-orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
              <ArrowLeft className="h-4 w-4" /> Volver a Órdenes de Trabajo
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>

          <Card className="mb-8">
            <CardContent>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Orden #{workOrder.id.slice(-6)}</h1>
                  <p className="text-sm text-carbon-400">{new Date(workOrder.fecha).toLocaleDateString()}</p>
                </div>
                <Badge variant={STATUS_VARIANT[workOrder.status]}>{STATUS_LABELS[workOrder.status]}</Badge>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-carbon-400">Cliente</span>
                  <p className="font-medium text-carbon-100">{workOrder.client.nombre}</p>
                </div>
                <div>
                  <span className="text-xs text-carbon-400">Vehículo</span>
                  <p className="font-medium text-carbon-100">
                    {workOrder.vehicle.patente} - {workOrder.vehicle.marca} {workOrder.vehicle.modelo}
                  </p>
                </div>
              </div>

              <div className="no-print mb-4 flex flex-wrap gap-2">
                {STATUS_ORDER.map((status, index) => (
                  <button
                    key={status}
                    onClick={() => changeStatus(status)}
                    disabled={index <= currentIndex}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                      index === currentIndex
                        ? "border-brand-500/40 bg-brand-500/10 text-brand-400"
                        : "border-carbon-600 text-carbon-300 hover:bg-carbon-800 hover:text-white"
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              {(() => {
                const pendiente = (workOrder.payments || []).length
                  ? workOrder.total - (workOrder.payments || []).filter((p) => p.status === "PAGADO").reduce((s, p) => s + p.monto, 0)
                  : workOrder.total;
                const listoLink =
                  (workOrder.status === "TERMINADA" || workOrder.status === "ENTREGADA") &&
                  buildWhatsAppLink(workOrder.client.telefono, whatsAppVehiculoListo(workOrder.client.nombre, workOrder.vehicle.patente));
                const cobroLink =
                  pendiente > 0.01 && buildWhatsAppLink(workOrder.client.telefono, whatsAppRecordatorioPago(workOrder.client.nombre, pendiente, `orden #${workOrder.id.slice(-6)}`));
                if (!listoLink && !cobroLink) return null;
                return (
                  <div className="no-print mb-4 flex flex-wrap gap-2">
                    {listoLink && (
                      <a
                        href={listoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Avisar por WhatsApp que está listo
                      </a>
                    )}
                    {cobroLink && (
                      <a
                        href={cobroLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Recordar pago pendiente
                      </a>
                    )}
                  </div>
                );
              })()}

              {editing ? (
                <form onSubmit={handleSaveEdit} className="space-y-4 border-t border-carbon-700 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="text" placeholder="Motivo de ingreso *" value={motivoIngreso} onChange={(e) => setMotivoIngreso(e.target.value)} required className="col-span-2" />
                    <Input type="number" placeholder="Km ingreso" value={kmIngreso} onChange={(e) => setKmIngreso(e.target.value)} />
                    <Input type="number" placeholder="Km egreso" value={kmEgreso} onChange={(e) => setKmEgreso(e.target.value)} />
                  </div>
                  <Textarea placeholder="Diagnóstico" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2} />
                  <Textarea placeholder="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button type="submit" variant="success">Guardar</Button>
                    <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-carbon-700 pt-4">
                  <div className="mb-2 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-carbon-400">Motivo de ingreso</span>
                      <p className="text-carbon-100">{workOrder.motivoIngreso}</p>
                    </div>
                    <div>
                      <span className="text-xs text-carbon-400">Km ingreso / egreso</span>
                      <p className="text-carbon-100">{workOrder.kmIngreso ?? "-"} / {workOrder.kmEgreso ?? "-"}</p>
                    </div>
                  </div>
                  {workOrder.diagnostico && (
                    <div className="mb-2">
                      <span className="text-xs text-carbon-400">Diagnóstico</span>
                      <p className="text-carbon-100">{workOrder.diagnostico}</p>
                    </div>
                  )}
                  {workOrder.observaciones && (
                    <div className="mb-2">
                      <span className="text-xs text-carbon-400">Observaciones</span>
                      <p className="text-carbon-100">{workOrder.observaciones}</p>
                    </div>
                  )}
                  <Button variant="secondary" className="mt-2" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Editar Orden
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <h2 className="mb-4 text-lg font-semibold text-white">Trabajos Realizados</h2>

          <Card className="mb-6">
            <Table>
              <Thead>
                <tr>
                  <Th>Descripción</Th>
                  <Th>Cantidad</Th>
                  <Th>Precio Unit.</Th>
                  <Th>Subtotal</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </Thead>
              <Tbody>
                {workOrder.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.descripcion}</Td>
                    <Td className="text-carbon-400">{item.cantidad}</Td>
                    <Td className="text-carbon-400">${item.precioUnitario.toFixed(2)}</Td>
                    <Td className="font-medium">${item.subtotal.toFixed(2)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={workOrder.items.length === 1}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
              <tfoot>
                <tr className="bg-carbon-800/60">
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-white">
                    Total:
                  </td>
                  <td colSpan={2} className="px-4 py-3 font-bold text-white">
                    ${workOrder.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </Table>
          </Card>

          {workOrder.margen !== undefined && (
            <Card className="no-print mb-8">
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-carbon-400">Margen (ingresos - costos asociados)</span>
                <span className={`font-bold ${workOrder.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ${workOrder.margen.toFixed(2)}
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <h3 className="mb-3 font-semibold text-white">Agregar Trabajo</h3>
              <form onSubmit={addItem} className="grid grid-cols-12 gap-2">
                <Input
                  type="text"
                  placeholder="Descripción *"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="col-span-12 sm:col-span-6"
                  required
                />
                <Input
                  type="number"
                  placeholder="Cant."
                  min="1"
                  value={newItemCant}
                  onChange={(e) => setNewItemCant(e.target.value)}
                  className="col-span-4 sm:col-span-2"
                  required
                />
                <Input
                  type="number"
                  placeholder="Precio Unit."
                  min="0"
                  step="0.01"
                  value={newItemPrecio}
                  onChange={(e) => setNewItemPrecio(e.target.value)}
                  className="col-span-6 sm:col-span-3"
                  required
                />
                <Button type="submit" className="col-span-2 sm:col-span-1 px-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}
