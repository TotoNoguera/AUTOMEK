"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/common/ToastProvider";

interface WorkOrder {
  id: string;
  status: "PRESUPUESTA" | "APROBADA" | "EN_PROCESO" | "TERMINADA" | "ENTREGADA";
  total: number;
  fecha: string;
  motivoIngreso: string;
  client: { id: string; nombre: string };
  vehicle: { id: string; patente: string };
}

interface Client {
  id: string;
  nombre: string;
  vehicles: Array<{ id: string; patente: string; marca: string; modelo: string }>;
}

interface WorkOrderItemForm {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
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

export default function WorkOrdersPage() {
  const { showToast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [motivoIngreso, setMotivoIngreso] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [kmIngreso, setKmIngreso] = useState("");
  const [items, setItems] = useState<WorkOrderItemForm[]>([
    { descripcion: "", cantidad: 1, precioUnitario: 0 },
  ]);

  useEffect(() => {
    loadWorkOrders();
  }, [search, statusFilter]);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadWorkOrders() {
    try {
      setLoading(true);
      const url = new URL("/api/work-orders", window.location.origin);
      if (search) url.searchParams.set("search", search);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setWorkOrders(data);
      }
    } catch (error) {
      console.error("Error loading work orders:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const response = await fetch("/api/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
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

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const total = items.reduce(
    (sum, item) => sum + item.cantidad * item.precioUnitario,
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          vehicleId: selectedVehicleId,
          motivoIngreso,
          diagnostico: diagnostico || undefined,
          observaciones: observaciones || undefined,
          kmIngreso: kmIngreso ? parseInt(kmIngreso) : undefined,
          items: items.map((item) => ({
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            precioUnitario: Number(item.precioUnitario),
          })),
        }),
      });

      if (response.ok) {
        setSelectedClientId("");
        setSelectedVehicleId("");
        setMotivoIngreso("");
        setDiagnostico("");
        setObservaciones("");
        setKmIngreso("");
        setItems([{ descripcion: "", cantidad: 1, precioUnitario: 0 }]);
        setShowForm(false);
        showToast("Orden de trabajo creada correctamente", "success");
        loadWorkOrders();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error creando orden de trabajo", "error");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Órdenes de Trabajo</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nueva Orden"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-lg shadow-md mb-8"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedVehicleId("");
                }}
                className="border rounded px-3 py-2"
                required
              >
                <option value="">Seleccionar Cliente *</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombre}
                  </option>
                ))}
              </select>

              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="border rounded px-3 py-2"
                required
                disabled={!selectedClientId}
              >
                <option value="">Seleccionar Vehículo *</option>
                {selectedClient?.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.patente} - {vehicle.marca} {vehicle.modelo}
                  </option>
                ))}
              </select>
            </div>

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
                placeholder="Kilometraje de ingreso"
                value={kmIngreso}
                onChange={(e) => setKmIngreso(e.target.value)}
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

            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-2">Ítems / Trabajos</h3>
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
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                + Agregar ítem
              </button>
            </div>

            <textarea
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              rows={2}
            />

            <div className="flex justify-between items-center">
              <p className="text-xl font-bold text-gray-900">
                Total: ${total.toFixed(2)}
              </p>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Crear Orden de Trabajo
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <input
            type="text"
            placeholder="Buscar por cliente o patente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-md px-4 py-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-4 py-2"
          >
            <option value="">Todos los estados</option>
            <option value="PRESUPUESTA">Presupuestada</option>
            <option value="APROBADA">Aprobada</option>
            <option value="EN_PROCESO">En Proceso</option>
            <option value="TERMINADA">Terminada</option>
            <option value="ENTREGADA">Entregada</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : workOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay órdenes de trabajo registradas
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Vehículo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <tr key={wo.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {wo.client.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {wo.vehicle.patente}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {wo.motivoIngreso}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(wo.fecha).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      ${wo.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[wo.status]}`}
                      >
                        {STATUS_LABELS[wo.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver
                      </Link>
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
