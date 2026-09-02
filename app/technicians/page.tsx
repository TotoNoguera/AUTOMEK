"use client";

import { useEffect, useState } from "react";
import { Plus, UserCog, Pencil, Power } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

interface Technician {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  especialidad?: string;
  activo: boolean;
}

export default function TechniciansPage() {
  const { showToast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    especialidad: "",
  });

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    try {
      setLoading(true);
      const response = await fetch("/api/technicians");
      if (response.ok) {
        setTechnicians(await response.json());
      }
    } catch (error) {
      console.error("Error loading technicians:", error);
    } finally {
      setLoading(false);
    }
  }

  function editTechnician(t: Technician) {
    setEditingId(t.id);
    setFormData({
      nombre: t.nombre,
      email: t.email || "",
      telefono: t.telefono || "",
      especialidad: t.especialidad || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? `/api/technicians/${editingId}` : "/api/technicians";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: formData.nombre,
          email: formData.email || undefined,
          telefono: formData.telefono || undefined,
          especialidad: formData.especialidad || undefined,
        }),
      });

      if (response.ok) {
        setFormData({ nombre: "", email: "", telefono: "", especialidad: "" });
        setEditingId(null);
        setShowForm(false);
        showToast(editingId ? "Técnico actualizado correctamente" : "Técnico creado correctamente", "success");
        loadTechnicians();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error guardando técnico", "error");
    }
  }

  async function toggleActivo(t: Technician) {
    try {
      const response = await fetch(`/api/technicians/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: t.nombre,
          email: t.email || undefined,
          telefono: t.telefono || undefined,
          especialidad: t.especialidad || undefined,
          activo: !t.activo,
        }),
      });
      if (response.ok) {
        showToast(t.activo ? "Técnico desactivado" : "Técnico activado", "success");
        loadTechnicians();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error actualizando técnico", "error");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Técnicos"
        description="Tu equipo técnico y especialidades"
        actions={
          <Button
            onClick={() => {
              setEditingId(null);
              setFormData({ nombre: "", email: "", telefono: "", especialidad: "" });
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo Técnico
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Editar Técnico" : "Nuevo Técnico"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" type="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="especialidad">Especialidad</Label>
            <Input id="especialidad" value={formData.especialidad} onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editingId ? "Actualizar Técnico" : "Crear Técnico"}</Button>
          </div>
        </form>
      </Modal>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : technicians.length === 0 ? (
        <Card>
          <EmptyState icon={UserCog} title="No hay técnicos registrados" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Email</Th>
              <Th>Teléfono</Th>
              <Th>Especialidad</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {technicians.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium">{t.nombre}</Td>
                <Td className="text-carbon-400">{t.email || "-"}</Td>
                <Td className="text-carbon-400">{t.telefono || "-"}</Td>
                <Td className="text-carbon-400">{t.especialidad || "-"}</Td>
                <Td>
                  <Badge variant={t.activo ? "success" : "neutral"}>{t.activo ? "Activo" : "Inactivo"}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => editTechnician(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => toggleActivo(t)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      <Power className="h-3.5 w-3.5" /> {t.activo ? "Desactivar" : "Activar"}
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
