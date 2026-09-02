"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

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
  cantidad: number;
  precioUnitario: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_ESPERA: "En Espera",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_ESPERA: "bg-orange-100 text-orange-800",
  CANCELADO: "bg-red-100 text-red-800",
  COMPLETADO: "bg-green-100 text-green-800",
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
    { descripcion: "", cantidad: 1, precioUnitario: 0 },
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
    setItems([...items, { descripcion: "", cantidad: 1, precioUnitario: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof WorkOrderItemForm, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  const total = items.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);

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
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precioUnitario),
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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (notFound || !schedule)
    return <div className="text-center py-12">Turno no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/schedules" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
          ← Volver a Agenda
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Turno #{schedule.id.slice(-6)}
              </h1>
              <p className="text-gray-600 text-sm">
                {new Date(`${schedule.fecha.split("T")[0]}T00:00:00`).toLocaleDateString("es-AR")} - {schedule.hora}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[schedule.status]}`}>
              {STATUS_LABELS[schedule.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-600 text-sm">Cliente:</span>
              <p className="text-gray-900 font-medium">{schedule.client.nombre}</p>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Vehículo:</span>
              <p className="text-gray-900 font-medium">
                {schedule.vehicle.patente} - {schedule.vehicle.marca} {schedule.vehicle.modelo}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <span className="text-gray-600 text-sm">Motivo:</span>
            <p className="text-gray-900">{schedule.motivo}</p>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={schedule.status === s}
                className={`px-3 py-1 text-sm rounded disabled:opacity-40 ${STATUS_COLORS[s]} hover:opacity-80`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditing(!editing)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editing ? "Cancelar" : "Editar Turno"}
            </button>
            {!schedule.workOrderId && (
              <button
                onClick={() => setShowConvert(!showConvert)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                {showConvert ? "Cancelar Conversión" : "Convertir a Orden de Trabajo"}
              </button>
            )}
            {schedule.workOrderId && (
              <Link
                href={`/work-orders/${schedule.workOrderId}`}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Ver Orden de Trabajo
              </Link>
            )}
            {!schedule.workOrderId && (
              <button
                onClick={deleteSchedule}
                className="px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
              >
                Eliminar Turno
              </button>
            )}
          </div>
        </div>

        {editing && (
          <form onSubmit={handleSaveEdit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="font-medium text-gray-900 mb-4">Editar Turno</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </div>
            <input
              type="text"
              placeholder="Motivo *"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              required
            />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Guardar Cambios
            </button>
          </form>
        )}

        {showConvert && (
          <form onSubmit={convertToWorkOrder} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="font-medium text-gray-900 mb-4">Convertir a Orden de Trabajo</h3>
            <input
              type="text"
              placeholder="Motivo de ingreso *"
              value={motivoIngreso}
              onChange={(e) => setMotivoIngreso(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              required
            />
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Descripción *"
                  value={item.descripcion}
                  onChange={(e) => updateItem(index, "descripcion", e.target.value)}
                  className="col-span-6 border rounded px-3 py-2"
                  required
                />
                <input
                  type="number"
                  placeholder="Cant."
                  min="1"
                  value={item.cantidad}
                  onChange={(e) => updateItem(index, "cantidad", parseInt(e.target.value) || 1)}
                  className="col-span-2 border rounded px-3 py-2"
                  required
                />
                <input
                  type="number"
                  placeholder="Precio Unit."
                  min="0"
                  step="0.01"
                  value={item.precioUnitario}
                  onChange={(e) => updateItem(index, "precioUnitario", parseFloat(e.target.value) || 0)}
                  className="col-span-3 border rounded px-3 py-2"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="col-span-1 text-red-600 hover:text-red-800 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 text-sm mb-4">
              + Agregar ítem
            </button>
            <div className="flex justify-between items-center">
              <p className="text-xl font-bold text-gray-900">Total: ${total.toFixed(2)}</p>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                Crear Orden de Trabajo
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
