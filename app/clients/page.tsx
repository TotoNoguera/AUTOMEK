"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/common/ToastProvider";

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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Cliente"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-lg shadow-md mb-8"
          >
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nombre *"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
              <input
                type="tel"
                placeholder="Teléfono"
                value={formData.telefono}
                onChange={(e) =>
                  setFormData({ ...formData, telefono: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Dirección"
                value={formData.direccion}
                onChange={(e) =>
                  setFormData({ ...formData, direccion: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Crear Cliente
            </button>
          </form>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-md px-4 py-2"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay clientes registrados
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Teléfono
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Vehículos
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {client.nombre}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.email || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.telefono || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.vehicles.length}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver
                      </Link>
                      <button
                        onClick={() => deleteClient(client.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Eliminar
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
