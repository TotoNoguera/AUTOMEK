"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, Eye, Trash2, Car } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

const currentYear = new Date().getFullYear();
const emptyVehicleForm = { patente: "", marca: "", modelo: "", anio: String(currentYear), kilometraje: "" };

interface Client {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  vehicles: Array<{ id: string; patente: string }>;
}

export default function ClientsPage() {
  const { showToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
  });
  const [addVehicleNow, setAddVehicleNow] = useState(false);
  const [vehicleFormData, setVehicleFormData] = useState(emptyVehicleForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadClients();
  }, [search]);

  async function loadClients() {
    try {
      setLoading(true);
      const url = new URL("/api/clients", window.location.origin);
      if (search) url.searchParams.set("search", search);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({ nombre: "", email: "", telefono: "", direccion: "" });
    setAddVehicleNow(false);
    setVehicleFormData(emptyVehicleForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          email: formData.email || undefined,
          telefono: formData.telefono || undefined,
          direccion: formData.direccion || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
        return;
      }

      const client = await response.json();

      if (addVehicleNow) {
        const vehicleResponse = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            patente: vehicleFormData.patente.toUpperCase(),
            marca: vehicleFormData.marca,
            modelo: vehicleFormData.modelo,
            anio: Number(vehicleFormData.anio) || currentYear,
            kilometraje: vehicleFormData.kilometraje ? Number(vehicleFormData.kilometraje) : undefined,
          }),
        });

        if (!vehicleResponse.ok) {
          const error = await vehicleResponse.json();
          showToast(`Cliente creado, pero el vehículo no pudo cargarse: ${error.error}`, "error");
          resetForm();
          setShowForm(false);
          loadClients();
          return;
        }

        showToast("Cliente y vehículo creados correctamente", "success");
      } else {
        showToast("Cliente creado correctamente", "success");
      }

      resetForm();
      setShowForm(false);
      loadClients();
    } catch (error) {
      showToast("Error creando cliente", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("Cliente eliminado", "success");
        loadClients();
      } else {
        showToast("Error eliminando cliente", "error");
      }
    } catch (error) {
      showToast("Error eliminando cliente", "error");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Clientes"
        description="Gestioná la cartera de clientes de tu taller"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Nuevo Cliente
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Cliente">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              type="text"
              value={formData.direccion}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 border-t border-carbon-700 pt-4 text-sm text-carbon-200">
            <input
              type="checkbox"
              checked={addVehicleNow}
              onChange={(e) => setAddVehicleNow(e.target.checked)}
              className="h-4 w-4 rounded border-carbon-600 bg-carbon-900 accent-brand-500"
            />
            <Car className="h-4 w-4 text-brand-400" />
            Agregar vehículo ahora
          </label>

          {addVehicleNow && (
            <div className="space-y-4 rounded-lg border border-carbon-700 bg-carbon-900/40 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="v-patente">Patente *</Label>
                  <Input
                    id="v-patente"
                    type="text"
                    value={vehicleFormData.patente}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, patente: e.target.value })}
                    className="uppercase"
                    required={addVehicleNow}
                  />
                </div>
                <div>
                  <Label htmlFor="v-anio">Año *</Label>
                  <Input
                    id="v-anio"
                    type="number"
                    value={vehicleFormData.anio}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, anio: e.target.value })}
                    required={addVehicleNow}
                  />
                </div>
                <div>
                  <Label htmlFor="v-marca">Marca *</Label>
                  <Input
                    id="v-marca"
                    type="text"
                    value={vehicleFormData.marca}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, marca: e.target.value })}
                    required={addVehicleNow}
                  />
                </div>
                <div>
                  <Label htmlFor="v-modelo">Modelo *</Label>
                  <Input
                    id="v-modelo"
                    type="text"
                    value={vehicleFormData.modelo}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, modelo: e.target.value })}
                    required={addVehicleNow}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="v-km">Kilometraje</Label>
                <Input
                  id="v-km"
                  type="number"
                  value={vehicleFormData.kilometraje}
                  onChange={(e) => setVehicleFormData({ ...vehicleFormData, kilometraje: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {addVehicleNow ? "Crear Cliente y Vehículo" : "Crear Cliente"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
        <Input
          type="text"
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No hay clientes registrados"
            description="Creá tu primer cliente para empezar a gestionar el taller."
            action={
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Nuevo Cliente
              </Button>
            }
          />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Email</Th>
              <Th>Teléfono</Th>
              <Th>Vehículos</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {clients.map((client) => (
              <Tr key={client.id}>
                <Td className="font-medium">{client.nombre}</Td>
                <Td className="text-carbon-400">{client.email || "-"}</Td>
                <Td className="text-carbon-400">{client.telefono || "-"}</Td>
                <Td className="text-carbon-400">{client.vehicles.length}</Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
                    <button
                      onClick={() => deleteClient(client.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
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
