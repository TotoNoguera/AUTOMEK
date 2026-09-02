"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastProvider";

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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Técnicos</h1>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ nombre: "", email: "", telefono: "", especialidad: "" });
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Técnico"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nombre *"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Especialidad"
                value={formData.especialidad}
                onChange={(e) => setFormData({ ...formData, especialidad: e.target.value })}
                className="border rounded px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              {editingId ? "Actualizar Técnico" : "Crear Técnico"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : technicians.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No hay técnicos registrados
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Nombre</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Teléfono</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Especialidad</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{t.nombre}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.email || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.telefono || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{t.especialidad || "-"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${t.activo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => editTechnician(t)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActivo(t)}
                        className="text-orange-600 hover:text-orange-800"
                      >
                        {t.activo ? "Desactivar" : "Activar"}
                      </button>
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
