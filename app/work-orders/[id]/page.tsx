"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

interface WorkOrderItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
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
  client: { id: string; nombre: string };
  vehicle: { id: string; patente: string; marca: string; modelo: string };
  items: WorkOrderItem[];
  margen?: number;
}

const STATUS_LABELS: Record<string, string> = {
  PRESUPUESTA: "Presupuestada",
  APROBADA: "Aprobada",
  EN_PROCESO: "En Proceso",
  TERMINADA: "Terminada",
  ENTREGADA: "Entregada",
};

const STATUS_COLORS: Record<string, string> = {
  PRESUPUESTA: "bg-gray-100 text-gray-800",
  APROBADA: "bg-blue-100 text-blue-800",
  EN_PROCESO: "bg-yellow-100 text-yellow-800",
  TERMINADA: "bg-green-100 text-green-800",
  ENTREGADA: "bg-purple-100 text-purple-800",
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
  const [newItemCant, setNewItemCant] = useState(1);
  const [newItemPrecio, setNewItemPrecio] = useState(0);

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
          cantidad: Number(newItemCant),
          precioUnitario: Number(newItemPrecio),
        }),
      });
      if (response.ok) {
        setNewItemDesc("");
        setNewItemCant(1);
        setNewItemPrecio(0);
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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (notFound || !workOrder)
    return <div className="text-center py-12">Orden de trabajo no encontrada</div>;

  const currentIndex = STATUS_ORDER.indexOf(workOrder.status);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="no-print flex justify-between items-center mb-6">
          <Link href="/work-orders" className="text-blue-600 hover:text-blue-800 inline-block">
            ← Volver a Órdenes de Trabajo
          </Link>
          <button
            onClick={() => window.print()}
            className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            Imprimir / PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Orden #{workOrder.id.slice(-6)}
              </h1>
              <p className="text-gray-600 text-sm">
                {new Date(workOrder.fecha).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[workOrder.status]}`}
            >
              {STATUS_LABELS[workOrder.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-600 text-sm">Cliente:</span>
              <p className="text-gray-900 font-medium">{workOrder.client.nombre}</p>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Vehículo:</span>
              <p className="text-gray-900 font-medium">
                {workOrder.vehicle.patente} - {workOrder.vehicle.marca} {workOrder.vehicle.modelo}
              </p>
            </div>
          </div>

          <div className="no-print flex gap-2 mb-4 flex-wrap">
            {STATUS_ORDER.map((status, index) => (
              <button
                key={status}
                onClick={() => changeStatus(status)}
                disabled={index <= currentIndex}
                className={`px-3 py-1 text-sm rounded disabled:opacity-40 ${STATUS_COLORS[status]} hover:opacity-80`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          {editing ? (
            <form onSubmit={handleSaveEdit} className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Motivo de ingreso *"
                  value={motivoIngreso}
                  onChange={(e) => setMotivoIngreso(e.target.value)}
                  className="border rounded px-3 py-2"
                  required
                />
                <input
                  type="number"
                  placeholder="Km ingreso"
                  value={kmIngreso}
                  onChange={(e) => setKmIngreso(e.target.value)}
                  className="border rounded px-3 py-2"
                />
                <input
                  type="number"
                  placeholder="Km egreso"
                  value={kmEgreso}
                  onChange={(e) => setKmEgreso(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>
              <textarea
                placeholder="Diagnóstico"
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-4"
                rows={2}
              />
              <textarea
                placeholder="Observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-4"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <span className="text-gray-600 text-sm">Motivo de ingreso:</span>
                  <p className="text-gray-900">{workOrder.motivoIngreso}</p>
                </div>
                <div>
                  <span className="text-gray-600 text-sm">Km ingreso / egreso:</span>
                  <p className="text-gray-900">
                    {workOrder.kmIngreso ?? "-"} / {workOrder.kmEgreso ?? "-"}
                  </p>
                </div>
              </div>
              {workOrder.diagnostico && (
                <div className="mb-2">
                  <span className="text-gray-600 text-sm">Diagnóstico:</span>
                  <p className="text-gray-900">{workOrder.diagnostico}</p>
                </div>
              )}
              {workOrder.observaciones && (
                <div className="mb-2">
                  <span className="text-gray-600 text-sm">Observaciones:</span>
                  <p className="text-gray-900">{workOrder.observaciones}</p>
                </div>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Editar Orden
              </button>
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Trabajos Realizados</h2>

        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                  Descripción
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {workOrder.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {item.descripcion}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.cantidad}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    ${item.precioUnitario.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    ${item.subtotal.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={workOrder.items.length === 1}
                      className="text-red-600 hover:text-red-800 disabled:opacity-30"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={3} className="px-6 py-4 text-right font-bold text-gray-900">
                  Total:
                </td>
                <td colSpan={2} className="px-6 py-4 font-bold text-gray-900">
                  ${workOrder.total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {workOrder.margen !== undefined && (
          <div className="no-print bg-white p-4 rounded-lg shadow mb-8 flex justify-between items-center">
            <span className="text-sm text-gray-600">Margen (ingresos - costos asociados):</span>
            <span className={`font-bold ${workOrder.margen >= 0 ? "text-green-700" : "text-red-700"}`}>
              ${workOrder.margen.toFixed(2)}
            </span>
          </div>
        )}

        <form onSubmit={addItem} className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-medium text-gray-900 mb-2">Agregar Trabajo</h3>
          <div className="grid grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Descripción *"
              value={newItemDesc}
              onChange={(e) => setNewItemDesc(e.target.value)}
              className="col-span-6 border rounded px-3 py-2"
              required
            />
            <input
              type="number"
              placeholder="Cant."
              min="1"
              value={newItemCant}
              onChange={(e) => setNewItemCant(parseInt(e.target.value) || 1)}
              className="col-span-2 border rounded px-3 py-2"
              required
            />
            <input
              type="number"
              placeholder="Precio Unit."
              min="0"
              step="0.01"
              value={newItemPrecio}
              onChange={(e) => setNewItemPrecio(parseFloat(e.target.value) || 0)}
              className="col-span-3 border rounded px-3 py-2"
              required
            />
            <button
              type="submit"
              className="col-span-1 bg-green-600 text-white rounded hover:bg-green-700"
            >
              +
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
