"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Car, Pencil, Trash2, CreditCard } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

interface Vehicle {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje?: number;
}

interface Client {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  vehicles: Vehicle[];
}

export default function ClientDetailPage() {
  const params = useParams();
  const { showToast } = useToast();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patente: "",
    marca: "",
    modelo: "",
    anio: String(new Date().getFullYear()),
    kilometraje: "",
  });

  useEffect(() => {
    loadClient();
  }, [clientId]);

  async function loadClient() {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setClient(data);
      }
    } catch (error) {
      console.error("Error loading client:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? `/api/vehicles/${editingId}` : "/api/vehicles";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          patente: formData.patente.toUpperCase(),
          marca: formData.marca,
          modelo: formData.modelo,
          anio: Number(formData.anio) || new Date().getFullYear(),
          kilometraje: formData.kilometraje
            ? parseInt(formData.kilometraje)
            : undefined,
        }),
      });

      if (response.ok) {
        setFormData({
          patente: "",
          marca: "",
          modelo: "",
          anio: String(new Date().getFullYear()),
          kilometraje: "",
        });
        setShowForm(false);
        setEditingId(null);
        showToast(editingId ? "Vehículo actualizado" : "Vehículo creado", "success");
        loadClient();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error guardando vehículo", "error");
    }
  }

  function editVehicle(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setFormData({
      patente: vehicle.patente,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      anio: String(vehicle.anio),
      kilometraje: vehicle.kilometraje?.toString() || "",
    });
    setShowForm(true);
  }

  async function deleteVehicle(id: string) {
    if (!confirm("¿Eliminar este vehículo?")) return;
    try {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("Vehículo eliminado", "success");
        loadClient();
      } else {
        showToast("Error eliminando vehículo", "error");
      }
    } catch (error) {
      showToast("Error eliminando vehículo", "error");
    }
  }

  return (
    <AppShell>
      <Link href="/clients" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Volver a Clientes
      </Link>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !client ? (
        <p className="text-sm text-carbon-400">Cliente no encontrado</p>
      ) : (
        <>
          <Card className="mb-8">
            <CardContent>
              <h1 className="mb-4 text-2xl font-bold text-white">{client.nombre}</h1>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-carbon-400">Email</span>
                  <p className="text-carbon-100">{client.email || "-"}</p>
                </div>
                <div>
                  <span className="text-carbon-400">Teléfono</span>
                  <p className="text-carbon-100">{client.telefono || "-"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-carbon-400">Dirección</span>
                  <p className="text-carbon-100">{client.direccion || "-"}</p>
                </div>
              </div>
              <Link
                href={`/clients/${client.id}/credit`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                <CreditCard className="h-4 w-4" /> Ver Cuenta Corriente
              </Link>
            </CardContent>
          </Card>

          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Vehículos</h2>
            <Button onClick={() => { setEditingId(null); setShowForm(true); }}>
              <Plus className="h-4 w-4" /> Nuevo Vehículo
            </Button>
          </div>

          <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Editar Vehículo" : "Nuevo Vehículo"}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="text"
                  placeholder="Patente *"
                  value={formData.patente}
                  onChange={(e) => setFormData({ ...formData, patente: e.target.value })}
                  className="uppercase"
                  required
                />
                <Input
                  type="text"
                  placeholder="Marca *"
                  value={formData.marca}
                  onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  required
                />
                <Input
                  type="text"
                  placeholder="Modelo *"
                  value={formData.modelo}
                  onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  placeholder="Año *"
                  value={formData.anio}
                  onChange={(e) => setFormData({ ...formData, anio: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  placeholder="Kilometraje"
                  value={formData.kilometraje}
                  onChange={(e) => setFormData({ ...formData, kilometraje: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit">{editingId ? "Actualizar Vehículo" : "Crear Vehículo"}</Button>
              </div>
            </form>
          </Modal>

          {client.vehicles.length === 0 ? (
            <Card>
              <EmptyState icon={Car} title="Sin vehículos registrados" />
            </Card>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Patente</Th>
                  <Th>Marca</Th>
                  <Th>Modelo</Th>
                  <Th>Año</Th>
                  <Th>Km</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </Thead>
              <Tbody>
                {client.vehicles.map((vehicle) => (
                  <Tr key={vehicle.id}>
                    <Td className="font-medium">{vehicle.patente}</Td>
                    <Td className="text-carbon-400">{vehicle.marca}</Td>
                    <Td className="text-carbon-400">{vehicle.modelo}</Td>
                    <Td className="text-carbon-400">{vehicle.anio}</Td>
                    <Td className="text-carbon-400">{vehicle.kilometraje || "-"}</Td>
                    <Td>
                      <div className="flex justify-end gap-3">
                        <button onClick={() => editVehicle(vehicle)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300">
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button onClick={() => deleteVehicle(vehicle.id)} className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" /> Eliminar
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </>
      )}
    </AppShell>
  );
}
