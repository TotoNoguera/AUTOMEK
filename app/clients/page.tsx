"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

      if (response.ok) {
        setFormData({ nombre: "", email: "", telefono: "", direccion: "" });
        setShowForm(false);
        showToast("Cliente creado correctamente", "success");
        loadClients();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error creando cliente", "error");
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear Cliente</Button>
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
