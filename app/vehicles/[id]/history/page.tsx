"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Wrench, FileText, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

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

  return (
    <AppShell>
      <Link href="/vehicles" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" /> Volver a Vehículos
      </Link>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : notFound || !data ? (
        <p className="text-sm text-carbon-400">Vehículo no encontrado</p>
      ) : (
        <>
          {(() => {
            const { vehicle, workOrders, quotes, schedules } = data;
            return (
              <>
                <Card className="mb-8">
                  <CardContent>
                    <h1 className="mb-2 text-xl font-bold text-white">Historial — {vehicle.patente}</h1>
                    <p className="text-sm text-carbon-300">
                      {vehicle.marca} {vehicle.modelo} ({vehicle.anio}) — Cliente:{" "}
                      <Link href={`/clients/${vehicle.client.id}`} className="text-brand-400 hover:text-brand-300">
                        {vehicle.client.nombre}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm text-carbon-400">Kilometraje actual: {vehicle.kilometraje ?? "-"}</p>
                  </CardContent>
                </Card>

                <h2 className="mb-4 text-lg font-semibold text-white">Órdenes de Trabajo ({workOrders.length})</h2>
                {workOrders.length === 0 ? (
                  <Card className="mb-8">
                    <EmptyState icon={Wrench} title="Sin órdenes de trabajo" />
                  </Card>
                ) : (
                  <div className="mb-8 space-y-3">
                    {workOrders.map((wo) => (
                      <Card key={wo.id}>
                        <CardContent className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-carbon-100">{wo.motivoIngreso}</p>
                            <p className="mt-0.5 flex items-center gap-2 text-sm text-carbon-400">
                              {new Date(wo.fecha).toLocaleDateString("es-AR")} <Badge variant="neutral">{wo.status}</Badge>
                            </p>
                            <p className="mt-1 text-sm text-carbon-400">
                              Km ingreso/egreso: {wo.kmIngreso ?? "-"} / {wo.kmEgreso ?? "-"}
                            </p>
                            {wo.diagnostico && <p className="text-sm text-carbon-400">Diagnóstico: {wo.diagnostico}</p>}
                            <ul className="mt-1 list-inside list-disc text-sm text-carbon-500">
                              {wo.items.map((item) => (
                                <li key={item.id}>
                                  {item.descripcion} ({item.cantidad} x ${item.precioUnitario.toFixed(2)})
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold text-white">${wo.total.toFixed(2)}</p>
                            <Link href={`/work-orders/${wo.id}`} className="text-sm text-brand-400 hover:text-brand-300">
                              Ver →
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <h2 className="mb-4 text-lg font-semibold text-white">Presupuestos ({quotes.length})</h2>
                {quotes.length === 0 ? (
                  <Card className="mb-8">
                    <EmptyState icon={FileText} title="Sin presupuestos" />
                  </Card>
                ) : (
                  <div className="mb-8 space-y-3">
                    {quotes.map((q) => (
                      <Card key={q.id}>
                        <CardContent className="flex items-center justify-between">
                          <p className="flex items-center gap-2 text-sm text-carbon-400">
                            {new Date(q.fecha).toLocaleDateString("es-AR")} <Badge variant="neutral">{q.status}</Badge>
                          </p>
                          <div className="text-right">
                            <p className="font-bold text-white">${q.total.toFixed(2)}</p>
                            <Link href={`/quotes/${q.id}`} className="text-sm text-brand-400 hover:text-brand-300">
                              Ver →
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <h2 className="mb-4 text-lg font-semibold text-white">Turnos ({schedules.length})</h2>
                {schedules.length === 0 ? (
                  <Card>
                    <EmptyState icon={CalendarDays} title="Sin turnos" />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {schedules.map((s) => (
                      <Card key={s.id}>
                        <CardContent>
                          <p className="font-medium text-carbon-100">{s.motivo}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-sm text-carbon-400">
                            {new Date(s.fecha).toLocaleDateString("es-AR")} {s.hora} <Badge variant="neutral">{s.status}</Badge>
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </AppShell>
  );
}
