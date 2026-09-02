"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

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
  const router = useRouter();
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
    anio: new Date().getFullYear(),
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
          anio: parseInt(formData.anio.toString()),
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
          anio: new Date().getFullYear(),
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
      anio: vehicle.anio,
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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (!client)
    return <div className="text-center py-12">Cliente no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/clients" className="text-blue-600 hover:text-blue-800 mb-6">
          ← Volver a Clientes
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {client.nombre}
          </h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Email:</span>
              <p className="text-gray-900">{client.email || "-"}</p>
            </div>
            <div>
              <span className="text-gray-600">Teléfono:</span>
              <p className="text-gray-900">{client.telefono || "-"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Dirección:</span>
              <p className="text-gray-900">{client.direccion || "-"}</p>
            </div>
          </div>
          <Link
            href={`/clients/${client.id}/credit`}
            className="inline-block mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Ver Cuenta Corriente →
          </Link>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Vehículos</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Vehículo"}
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
                placeholder="Patente *"
                value={formData.patente}
                onChange={(e) =>
                  setFormData({ ...formData, patente: e.target.value })
                }
                className="border rounded px-3 py-2 uppercase"
                required
              />
              <input
                type="text"
                placeholder="Marca *"
                value={formData.marca}
                onChange={(e) =>
                  setFormData({ ...formData, marca: e.target.value })
                }
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="text"
                placeholder="Modelo *"
                value={formData.modelo}
                onChange={(e) =>
                  setFormData({ ...formData, modelo: e.target.value })
                }
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="number"
                placeholder="Año *"
                value={formData.anio}
                onChange={(e) =>
                  setFormData({ ...formData, anio: parseInt(e.target.value) })
                }
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="number"
                placeholder="Kilometraje"
                value={formData.kilometraje}
                onChange={(e) =>
                  setFormData({ ...formData, kilometraje: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              {editingId ? "Actualizar Vehículo" : "Crear Vehículo"}
            </button>
          </form>
        )}

        {client.vehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
            Sin vehículos registrados
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Patente
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Marca
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Modelo
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Año
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Km
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {client.vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {vehicle.patente}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vehicle.marca}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vehicle.modelo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vehicle.anio}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {vehicle.kilometraje || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => editVehicle(vehicle)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteVehicle(vehicle.id)}
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
