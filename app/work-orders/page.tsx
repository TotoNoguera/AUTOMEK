"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Wrench, Eye, X } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { QuickAddVehicle, type QuickVehicle } from "@/components/common/QuickAddVehicle";

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
  cantidad: string;
  precioUnitario: string;
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
    { descripcion: "", cantidad: "1", precioUnitario: "0" },
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

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  function handleVehicleCreated(vehicle: QuickVehicle) {
    setClients((prev) =>
      prev.map((c) => (c.id === selectedClientId ? { ...c, vehicles: [...c.vehicles, vehicle] } : c))
    );
    setSelectedVehicleId(vehicle.id);
  }
  const total = items.reduce(
    (sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precioUnitario) || 0),
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
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
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
        setItems([{ descripcion: "", cantidad: "1", precioUnitario: "0" }]);
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
    <AppShell>
      <PageHeader
        title="Órdenes de Trabajo"
        description="Trabajos en curso y su facturación"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Nueva Orden
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva Orden de Trabajo" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedVehicleId("");
              }}
              required
            >
              <option value="">Seleccionar Cliente *</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nombre}
                </option>
              ))}
            </Select>

            <Select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              required
              disabled={!selectedClientId}
            >
              <option value="">Seleccionar Vehículo *</option>
              {selectedClient?.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.patente} - {vehicle.marca} {vehicle.modelo}
                </option>
              ))}
            </Select>
          </div>

          {selectedClientId && <QuickAddVehicle clientId={selectedClientId} onCreated={handleVehicleCreated} />}

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="text"
              placeholder="Motivo de ingreso *"
              value={motivoIngreso}
              onChange={(e) => setMotivoIngreso(e.target.value)}
              required
            />
            <Input
              type="number"
              placeholder="Kilometraje de ingreso"
              value={kmIngreso}
              onChange={(e) => setKmIngreso(e.target.value)}
            />
          </div>

          <Textarea placeholder="Diagnóstico" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} rows={2} />

          <div>
            <h3 className="mb-2 text-sm font-medium text-carbon-200">Ítems / Trabajos</h3>
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
            <button type="button" onClick={addItem} className="mt-2 text-sm font-medium text-brand-400 hover:text-brand-300">
              + Agregar ítem
            </button>
          </div>

          <Textarea placeholder="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />

          <div className="flex items-center justify-between border-t border-carbon-700 pt-4">
            <p className="text-lg font-bold text-white">Total: ${total.toFixed(2)}</p>
            <Button type="submit">Crear Orden de Trabajo</Button>
          </div>
        </form>
      </Modal>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
          <Input
            type="text"
            placeholder="Buscar por cliente o patente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-52">
          <option value="">Todos los estados</option>
          <option value="PRESUPUESTA">Presupuestada</option>
          <option value="APROBADA">Aprobada</option>
          <option value="EN_PROCESO">En Proceso</option>
          <option value="TERMINADA">Terminada</option>
          <option value="ENTREGADA">Entregada</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : workOrders.length === 0 ? (
        <Card>
          <EmptyState icon={Wrench} title="No hay órdenes de trabajo registradas" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Vehículo</Th>
              <Th>Motivo</Th>
              <Th>Fecha</Th>
              <Th>Total</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {workOrders.map((wo) => (
              <Tr key={wo.id}>
                <Td className="font-medium">{wo.client.nombre}</Td>
                <Td className="text-carbon-400">{wo.vehicle.patente}</Td>
                <Td className="text-carbon-400">{wo.motivoIngreso}</Td>
                <Td className="text-carbon-400">{new Date(wo.fecha).toLocaleDateString()}</Td>
                <Td className="font-medium">${wo.total.toFixed(2)}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[wo.status]}>{STATUS_LABELS[wo.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </AppShell>
  );
}
