"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, ArrowRightCircle, Wrench, Trash2, X } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

interface Schedule {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  status: "PENDIENTE" | "CONFIRMADO" | "EN_ESPERA" | "CANCELADO" | "COMPLETADO";
  workOrderId: string | null;
  client: { id: string; nombre: string };
  vehicle: { id: string; patente: string; marca: string; modelo: string };
}

interface WorkOrderItemForm {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_ESPERA: "En Espera",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_VARIANT: Record<string, "warning" | "info" | "neutral" | "danger" | "success"> = {
  PENDIENTE: "warning",
  CONFIRMADO: "info",
  EN_ESPERA: "neutral",
  CANCELADO: "danger",
  COMPLETADO: "success",
};

const STATUS_OPTIONS = ["PENDIENTE", "CONFIRMADO", "EN_ESPERA", "CANCELADO", "COMPLETADO"];

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const scheduleId = params.id as string;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");

  const [motivoIngreso, setMotivoIngreso] = useState("");
  const [items, setItems] = useState<WorkOrderItemForm[]>([
    { descripcion: "", cantidad: "1", precioUnitario: "0" },
  ]);

  useEffect(() => {
    loadSchedule();
  }, [scheduleId]);

  async function loadSchedule() {
    try {
      setLoading(true);
      const response = await fetch(`/api/schedules/${scheduleId}`);
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
        setFecha(data.fecha.split("T")[0]);
        setHora(data.hora);
        setMotivo(data.motivo);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!schedule) return;
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: schedule.client.id,
          vehicleId: schedule.vehicle.id,
          fecha,
          hora,
          motivo,
        }),
      });

      if (response.ok) {
        setEditing(false);
        showToast("Turno actualizado correctamente", "success");
        loadSchedule();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error actualizando turno", "error");
    }
  }

  async function changeStatus(status: string) {
    if (!schedule) return;
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: schedule.client.id,
          vehicleId: schedule.vehicle.id,
          fecha: schedule.fecha.split("T")[0],
          hora: schedule.hora,
          motivo: schedule.motivo,
          status,
        }),
      });
      if (response.ok) {
        showToast("Estado del turno actualizado", "success");
        loadSchedule();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error cambiando estado", "error");
    }
  }

  async function deleteSchedule() {
    if (!confirm("¿Eliminar este turno?")) return;
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" });
      if (response.ok) {
        showToast("Turno eliminado", "success");
        router.push("/schedules");
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error eliminando turno", "error");
    }
  }

  function addItem() {
    setItems([...items, { descripcion: "", cantidad: "1", precioUnitario: "0" }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof WorkOrderItemForm, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  const total = items.reduce((sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0), 0);

  async function convertToWorkOrder(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/to-work-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivoIngreso,
          items: items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
          })),
        }),
      });
      if (response.ok) {
        const workOrder = await response.json();
        showToast("Turno convertido a orden de trabajo", "success");
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
      ) : notFound || !schedule ? (
        <p className="text-sm text-carbon-400">Turno no encontrado</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <Link href="/schedules" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
            <ArrowLeft className="h-4 w-4" /> Volver a Agenda
          </Link>

          <Card className="mb-8">
            <CardContent>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Turno #{schedule.id.slice(-6)}</h1>
                  <p className="text-sm text-carbon-400">
                    {new Date(`${schedule.fecha.split("T")[0]}T00:00:00`).toLocaleDateString("es-AR")} - {schedule.hora}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[schedule.status]}>{STATUS_LABELS[schedule.status]}</Badge>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-carbon-400">Cliente</span>
                  <p className="font-medium text-carbon-100">{schedule.client.nombre}</p>
                </div>
                <div>
                  <span className="text-xs text-carbon-400">Vehículo</span>
                  <p className="font-medium text-carbon-100">
                    {schedule.vehicle.patente} - {schedule.vehicle.marca} {schedule.vehicle.modelo}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs text-carbon-400">Motivo</span>
                <p className="text-carbon-100">{schedule.motivo}</p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={schedule.status === s}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                      schedule.status === s
                        ? "border-brand-500/40 bg-brand-500/10 text-brand-400"
                        : "border-carbon-600 text-carbon-300 hover:bg-carbon-800 hover:text-white"
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(!editing)}>
                  <Pencil className="h-4 w-4" /> {editing ? "Cancelar" : "Editar Turno"}
                </Button>
                {!schedule.workOrderId && (
                  <Button onClick={() => setShowConvert(!showConvert)}>
                    <ArrowRightCircle className="h-4 w-4" /> {showConvert ? "Cancelar Conversión" : "Convertir a Orden de Trabajo"}
                  </Button>
                )}
                {schedule.workOrderId && (
                  <Link href={`/work-orders/${schedule.workOrderId}`}>
                    <Button variant="success">
                      <Wrench className="h-4 w-4" /> Ver Orden de Trabajo
                    </Button>
                  </Link>
                )}
                {!schedule.workOrderId && (
                  <Button variant="danger" onClick={deleteSchedule}>
                    <Trash2 className="h-4 w-4" /> Eliminar Turno
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {editing && (
            <Card className="mb-8">
              <CardContent>
                <h3 className="mb-4 font-semibold text-white">Editar Turno</h3>
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                    <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
                  </div>
                  <Input type="text" placeholder="Motivo *" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
                  <Button type="submit" variant="success">Guardar Cambios</Button>
                </form>
              </CardContent>
            </Card>
          )}

          {showConvert && (
            <Card>
              <CardContent>
                <h3 className="mb-4 font-semibold text-white">Convertir a Orden de Trabajo</h3>
                <form onSubmit={convertToWorkOrder} className="space-y-4">
                  <Input type="text" placeholder="Motivo de ingreso *" value={motivoIngreso} onChange={(e) => setMotivoIngreso(e.target.value)} required />
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
                  <div className="flex items-center justify-between border-t border-carbon-700 pt-4">
                    <p className="text-lg font-bold text-white">Total: ${total.toFixed(2)}</p>
                    <Button type="submit">Crear Orden de Trabajo</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
