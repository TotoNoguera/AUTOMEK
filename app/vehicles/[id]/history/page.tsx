"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Item {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface WorkOrder {
  id: string;
  status: string;
  total: number;
  motivoIngreso: string;
  diagnostico?: string;
  observaciones?: string;
  kmIngreso?: number;
  kmEgreso?: number;
  fecha: string;
  items: Item[];
}

interface Quote {
  id: string;
  status: string;
  total: number;
  fecha: string;
  items: Item[];
}

interface Schedule {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  status: string;
}

interface Vehicle {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje?: number;
  client: { id: string; nombre: string };
}

interface HistoryData {
  vehicle: Vehicle;
  workOrders: WorkOrder[];
  quotes: Quote[];
  schedules: Schedule[];
}

export default function VehicleHistoryPage() {
  const params = useParams();
  const vehicleId = params.id as string;

  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch(`/api/vehicles/${vehicleId}/history`);
        if (response.ok) {
          setData(await response.json());
        } else {
          setNotFound(true);
        }
      } catch (error) {
        console.error("Error loading vehicle history:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vehicleId]);

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (notFound || !data) return <div className="text-center py-12">Vehículo no encontrado</div>;

  const { vehicle, workOrders, quotes, schedules } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/vehicles" className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
          ← Volver a Vehículos
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Historial — {vehicle.patente}
          </h1>
          <p className="text-gray-600">
            {vehicle.marca} {vehicle.modelo} ({vehicle.anio}) — Cliente:{" "}
            <Link href={`/clients/${vehicle.client.id}`} className="text-blue-600 hover:text-blue-800">
              {vehicle.client.nombre}
            </Link>
          </p>
          <p className="text-gray-600 text-sm mt-1">
            Kilometraje actual: {vehicle.kilometraje ?? "-"}
          </p>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Órdenes de Trabajo ({workOrders.length})
        </h2>
        {workOrders.length === 0 ? (
          <div className="text-center py-6 text-gray-500 bg-white rounded-lg shadow mb-8">
            Sin órdenes de trabajo
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {workOrders.map((wo) => (
              <div key={wo.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{wo.motivoIngreso}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(wo.fecha).toLocaleDateString("es-AR")} — Estado: {wo.status}
                    </p>
                    <p className="text-sm text-gray-600">
                      Km ingreso/egreso: {wo.kmIngreso ?? "-"} / {wo.kmEgreso ?? "-"}
                    </p>
                    {wo.diagnostico && (
                      <p className="text-sm text-gray-600">Diagnóstico: {wo.diagnostico}</p>
                    )}
                    <ul className="text-sm text-gray-500 mt-1 list-disc list-inside">
                      {wo.items.map((item) => (
                        <li key={item.id}>
                          {item.descripcion} ({item.cantidad} x ${item.precioUnitario.toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${wo.total.toFixed(2)}</p>
                    <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                      Ver →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Presupuestos ({quotes.length})
        </h2>
        {quotes.length === 0 ? (
          <div className="text-center py-6 text-gray-500 bg-white rounded-lg shadow mb-8">
            Sin presupuestos
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {quotes.map((q) => (
              <div key={q.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">
                    {new Date(q.fecha).toLocaleDateString("es-AR")} — Estado: {q.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">${q.total.toFixed(2)}</p>
                  <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:text-blue-800 text-sm">
                    Ver →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Turnos ({schedules.length})
        </h2>
        {schedules.length === 0 ? (
          <div className="text-center py-6 text-gray-500 bg-white rounded-lg shadow">
            Sin turnos
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="bg-white p-4 rounded-lg shadow">
                <p className="font-medium text-gray-900">{s.motivo}</p>
                <p className="text-sm text-gray-600">
                  {new Date(s.fecha).toLocaleDateString("es-AR")} {s.hora} — Estado: {s.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
