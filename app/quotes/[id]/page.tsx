"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

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
}

interface QuoteItemForm {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  APROBADO: "bg-green-100 text-green-800",
  RECHAZADO: "bg-red-100 text-red-800",
};

export default function QuoteDetailPage() {
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
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
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
    setItems([...items, { descripcion: "", cantidad: 1, precioUnitario: 0 }]);
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
    (sum, item) => sum + item.cantidad * item.precioUnitario,
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
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precioUnitario),
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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (notFound || !quote)
    return <div className="text-center py-12">Presupuesto no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="no-print flex justify-between items-center mb-6">
          <Link href="/quotes" className="text-blue-600 hover:text-blue-800 inline-block">
            ← Volver a Presupuestos
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
                Presupuesto #{quote.id.slice(-6)}
              </h1>
              <p className="text-gray-600 text-sm">
                {new Date(quote.fecha).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[quote.status]}`}
            >
              {STATUS_LABELS[quote.status]}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-600 text-sm">Cliente:</span>
              <p className="text-gray-900 font-medium">{quote.client.nombre}</p>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Vehículo:</span>
              <p className="text-gray-900 font-medium">
                {quote.vehicle.patente} - {quote.vehicle.marca} {quote.vehicle.modelo}
              </p>
            </div>
          </div>

          <div className="no-print flex gap-2 mb-4">
            <button
              onClick={() => changeStatus("PENDIENTE")}
              disabled={quote.status === "PENDIENTE"}
              className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-40"
            >
              Marcar Pendiente
            </button>
            <button
              onClick={() => changeStatus("APROBADO")}
              disabled={quote.status === "APROBADO"}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-40"
            >
              Aprobar
            </button>
            <button
              onClick={() => changeStatus("RECHAZADO")}
              disabled={quote.status === "RECHAZADO"}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-40"
            >
              Rechazar
            </button>
            {quote.status === "APROBADO" && (
              <button
                onClick={convertToWorkOrder}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
              >
                Convertir a Orden de Trabajo
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ítems / Trabajos</h2>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {editing ? "Cancelar" : "Editar Presupuesto"}
          </button>
        </div>

        {editing ? (
          <form
            onSubmit={handleSaveEdit}
            className="bg-white p-6 rounded-lg shadow-md mb-8"
          >
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
            <button
              type="button"
              onClick={addItem}
              className="text-blue-600 hover:text-blue-800 text-sm mb-4"
            >
              + Agregar ítem
            </button>

            <textarea
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              rows={2}
            />

            <div className="flex justify-between items-center">
              <p className="text-xl font-bold text-gray-900">
                Total: ${editTotal.toFixed(2)}
              </p>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
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
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item) => (
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
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-6 py-4 text-right font-bold text-gray-900">
                    Total:
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    ${quote.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {quote.observaciones && (
              <div className="p-6 border-t">
                <span className="text-gray-600 text-sm">Observaciones:</span>
                <p className="text-gray-900">{quote.observaciones}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
