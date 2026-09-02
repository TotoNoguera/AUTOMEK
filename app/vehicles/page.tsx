"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Car, History, Trash2, Users } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

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
    <AppShell>
      <PageHeader
        title="Vehículos"
        description="Todos los vehículos registrados por tus clientes"
        actions={
          <Link href="/clients">
            <Button variant="secondary">
              <Users className="h-4 w-4" /> Gestionar Clientes
            </Button>
          </Link>
        }
      />

      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
        <Input
          type="text"
          placeholder="Buscar por patente, marca o modelo..."
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
      ) : vehicles.length === 0 ? (
        <Card>
          <EmptyState icon={Car} title="No hay vehículos registrados" description="Los vehículos se agregan desde la ficha de cada cliente." />
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
              <Th>Cliente</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {vehicles.map((vehicle) => (
              <Tr key={vehicle.id}>
                <Td className="font-medium">{vehicle.patente}</Td>
                <Td className="text-carbon-400">{vehicle.marca}</Td>
                <Td className="text-carbon-400">{vehicle.modelo}</Td>
                <Td className="text-carbon-400">{vehicle.anio}</Td>
                <Td className="text-carbon-400">{vehicle.kilometraje || "-"}</Td>
                <Td>
                  <Link href={`/clients/${vehicle.client.id}`} className="text-brand-400 hover:text-brand-300">
                    {vehicle.client.nombre}
                  </Link>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/vehicles/${vehicle.id}/history`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                    >
                      <History className="h-3.5 w-3.5" /> Historial
                    </Link>
                    <button
                      onClick={() => deleteVehicle(vehicle.id)}
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
