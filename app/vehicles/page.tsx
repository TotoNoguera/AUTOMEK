"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/common/ToastProvider";

interface Vehicle {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje?: number;
  client: {
    id: string;
    nombre: string;
  };
}

export default function VehiclesPage() {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/vehicles", window.location.origin);
      if (search) url.searchParams.set("search", search);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error("Error loading vehicles:", error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  async function deleteVehicle(id: string) {
    if (!confirm("¿Eliminar este vehículo?")) return;
    try {
      const response = await fetch(`/api/vehicles/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        showToast("Vehículo eliminado", "success");
        loadVehicles();
      } else {
        showToast("Error eliminando vehículo", "error");
      }
    } catch {
      showToast("Error eliminando vehículo", "error");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vehículos</h1>
          <Link
            href="/clients"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Gestionar Clientes
          </Link>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Buscar vehículos por patente, marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-md px-4 py-2"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay vehículos registrados
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
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
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
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <Link
                        href={`/clients/${vehicle.client.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {vehicle.client.nombre}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <Link
                        href={`/vehicles/${vehicle.id}/history`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Historial
                      </Link>
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
