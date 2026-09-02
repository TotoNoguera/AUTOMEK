"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { downloadCsv } from "@/lib/csv";

interface PaymentMethod {
  id: string;
  tipo: string;
  nombre: string;
}

interface WorkOrderOption {
  id: string;
  total: number;
  motivoIngreso: string;
  client: { nombre: string };
  vehicle: { patente: string };
  payments: Array<{ monto: number; status: string }>;
}

interface CashMovement {
  id: string;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  monto: number;
  descripcion?: string;
  fecha: string;
  workOrder?: { id: string; client: { nombre: string }; vehicle: { patente: string } } | null;
}

const CATEGORIA_LABELS: Record<string, string> = {
  PAGO_ORDEN: "Pago de Orden",
  ANTICIPO: "Anticipo",
  COMPRA_REPUESTOS: "Compra de Repuestos",
  COMPRA_MATERIALES: "Compra de Materiales",
  GASTO_SERVICIOS: "Gasto de Servicios",
  GASTO_MANTENIMIENTO: "Gasto de Mantenimiento",
  GASTO_SUELDOS: "Sueldos",
  GASTO_ALQUILER: "Alquiler",
  GASTO_SERVICIOS_UTILES: "Servicios (luz, agua, etc.)",
  GASTO_IMPUESTOS: "Impuestos",
  GASTO_OTROS: "Otros Gastos",
};

const EGRESO_CATEGORIAS = [
  "COMPRA_REPUESTOS",
  "COMPRA_MATERIALES",
  "GASTO_SERVICIOS",
  "GASTO_MANTENIMIENTO",
  "GASTO_SUELDOS",
  "GASTO_ALQUILER",
  "GASTO_SERVICIOS_UTILES",
  "GASTO_IMPUESTOS",
  "GASTO_OTROS",
];

export default function CashMovementsPage() {
  const { showToast } = useToast();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [tipoFilter, setTipoFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);

  const [ingresoWorkOrderId, setIngresoWorkOrderId] = useState("");
  const [ingresoMethodId, setIngresoMethodId] = useState("");
  const [ingresoMonto, setIngresoMonto] = useState("");
  const [ingresoDescripcion, setIngresoDescripcion] = useState("");

  const [egresoCategoria, setEgresoCategoria] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [egresoDescripcion, setEgresoDescripcion] = useState("");

  const loadMovements = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/cash-movements", window.location.origin);
      if (tipoFilter) url.searchParams.set("tipo", tipoFilter);
      const response = await fetch(url);
      if (response.ok) {
        setMovements(await response.json());
      }
    } catch (error) {
      console.error("Error loading movements:", error);
    } finally {
      setLoading(false);
    }
  }, [tipoFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [methodsRes, workOrdersRes] = await Promise.all([
          fetch("/api/payment-methods"),
          fetch("/api/work-orders"),
        ]);
        if (methodsRes.ok) setMethods(await methodsRes.json());
        if (workOrdersRes.ok) setWorkOrders(await workOrdersRes.json());
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    }
    loadInitial();
  }, []);

  function pendienteDe(wo: WorkOrderOption) {
    const pagado = wo.payments
      .filter((p) => p.status === "PAGADO")
      .reduce((sum, p) => sum + p.monto, 0);
    return wo.total - pagado;
  }

  async function handleIngresoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-movements/ingreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: ingresoWorkOrderId || undefined,
          methodId: ingresoMethodId,
          monto: Number(ingresoMonto),
          descripcion: ingresoDescripcion || undefined,
        }),
      });
      if (response.ok) {
        setIngresoWorkOrderId("");
        setIngresoMethodId("");
        setIngresoMonto("");
        setIngresoDescripcion("");
        setShowIngreso(false);
        showToast("Ingreso registrado correctamente", "success");
        loadMovements();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error registrando ingreso", "error");
    }
  }

  async function handleEgresoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-movements/egreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: egresoCategoria,
          monto: Number(egresoMonto),
          descripcion: egresoDescripcion || undefined,
        }),
      });
      if (response.ok) {
        setEgresoCategoria("");
        setEgresoMonto("");
        setEgresoDescripcion("");
        setShowEgreso(false);
        showToast("Egreso registrado correctamente", "success");
        loadMovements();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error registrando egreso", "error");
    }
  }

  function exportCsv() {
    downloadCsv(
      `movimientos-caja-${new Date().toISOString().split("T")[0]}.csv`,
      ["Fecha", "Tipo", "Categoría", "Cliente", "Vehículo", "Descripción", "Monto"],
      movements.map((m) => [
        new Date(m.fecha).toLocaleDateString("es-AR"),
        m.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        CATEGORIA_LABELS[m.categoria] || m.categoria,
        m.workOrder?.client.nombre || "",
        m.workOrder?.vehicle.patente || "",
        m.descripcion || "",
        m.monto.toFixed(2),
      ])
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Caja y Movimientos</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowIngreso(!showIngreso); setShowEgreso(false); }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              {showIngreso ? "Cancelar" : "+ Nuevo Ingreso"}
            </button>
            <button
              onClick={() => { setShowEgreso(!showEgreso); setShowIngreso(false); }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              {showEgreso ? "Cancelar" : "+ Nuevo Egreso"}
            </button>
          </div>
        </div>

        {showIngreso && (
          <form onSubmit={handleIngresoSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="font-medium text-gray-900 mb-4">Registrar Ingreso</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={ingresoWorkOrderId}
                onChange={(e) => setIngresoWorkOrderId(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="">Sin orden asociada (Anticipo)</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.client.nombre} - {wo.vehicle.patente} - Pendiente: ${pendienteDe(wo).toFixed(2)}
                  </option>
                ))}
              </select>
              <select
                value={ingresoMethodId}
                onChange={(e) => setIngresoMethodId(e.target.value)}
                className="border rounded px-3 py-2"
                required
              >
                <option value="">Método de Pago *</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="number"
                placeholder="Monto *"
                min="0.01"
                step="0.01"
                value={ingresoMonto}
                onChange={(e) => setIngresoMonto(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="text"
                placeholder="Descripción"
                value={ingresoDescripcion}
                onChange={(e) => setIngresoDescripcion(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Registrar Ingreso
            </button>
          </form>
        )}

        {showEgreso && (
          <form onSubmit={handleEgresoSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <h3 className="font-medium text-gray-900 mb-4">Registrar Egreso</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={egresoCategoria}
                onChange={(e) => setEgresoCategoria(e.target.value)}
                className="border rounded px-3 py-2"
                required
              >
                <option value="">Categoría *</option>
                {EGRESO_CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Monto *"
                min="0.01"
                step="0.01"
                value={egresoMonto}
                onChange={(e) => setEgresoMonto(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </div>
            <input
              type="text"
              placeholder="Descripción"
              value={egresoDescripcion}
              onChange={(e) => setEgresoDescripcion(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
              Registrar Egreso
            </button>
          </form>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="border rounded-md px-4 py-2"
          >
            <option value="">Todos los movimientos</option>
            <option value="INGRESO">Solo Ingresos</option>
            <option value="EGRESO">Solo Egresos</option>
          </select>
          <button
            onClick={exportCsv}
            disabled={movements.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            Exportar CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No hay movimientos registrados
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tipo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Categoría</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Orden</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Descripción</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(m.fecha).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${m.tipo === "INGRESO" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {CATEGORIA_LABELS[m.categoria] || m.categoria}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {m.workOrder ? `${m.workOrder.client.nombre} - ${m.workOrder.vehicle.patente}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{m.descripcion || "-"}</td>
                    <td
                      className={`px-6 py-4 text-sm font-medium ${m.tipo === "INGRESO" ? "text-green-700" : "text-red-700"}`}
                    >
                      {m.tipo === "INGRESO" ? "+" : "-"}${m.monto.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
