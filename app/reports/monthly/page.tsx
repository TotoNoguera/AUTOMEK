"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/common/StatCard";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/EmptyState";

interface StatsData {
  cobrosMes: number;
  egresosMes: number;
  ordenesActivas: number;
  deudasPendientes: number;
  vehiculosFrecuentes: Array<{ patente: string; marca: string; modelo: string; count: number }>;
  objetivosMes: Array<{ tipo: string; objetivo: number; alcanzado: number; estado: string }>;
  monthlyData: Array<{ mes: number; anio: number; ingresos: number; egresos: number; ordenes: number }>;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TIPO_LABELS: Record<string, string> = {
  INGRESO_MENSUAL: "Ingreso Mensual",
  ORDENES_MENSUALES: "Órdenes Mensuales",
  CLIENTES_NUEVOS: "Clientes Nuevos",
};

export default function MonthlyReportPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          setStats(await response.json());
        }
      } catch (error) {
        console.error("Error loading report:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const now = new Date();
  const current = stats?.monthlyData[stats.monthlyData.length - 1];
  const neto = stats ? stats.cobrosMes - stats.egresosMes : 0;

  return (
    <AppShell>
      <PageHeader
        className="no-print"
        title="Resumen Mensual"
        description="Reporte financiero imprimible"
        actions={
          stats && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
            </Button>
          )
        }
      />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : !stats ? (
        <p className="text-sm text-carbon-400">Error cargando el reporte</p>
      ) : (
        <Card>
          <CardContent>
            <h2 className="text-xl font-bold text-white">
              Resumen Mensual — {MESES[now.getMonth()]} {now.getFullYear()}
            </h2>
            <p className="mb-6 text-sm text-carbon-400">Generado el {now.toLocaleDateString("es-AR")}</p>

            <div className="mb-8 grid grid-cols-2 gap-4">
              <StatCard label="Ingresos del mes" value={`$${stats.cobrosMes.toFixed(2)}`} tone="success" />
              <StatCard label="Egresos del mes" value={`$${stats.egresosMes.toFixed(2)}`} tone="danger" />
              <StatCard label="Neto del mes" value={`$${neto.toFixed(2)}`} tone={neto >= 0 ? "success" : "danger"} />
              <StatCard label="Deudas pendientes" value={`$${stats.deudasPendientes.toFixed(2)}`} tone="warning" />
            </div>

            <h3 className="mb-3 font-semibold text-white">Órdenes del mes</h3>
            <p className="mb-6 text-sm text-carbon-300">{current?.ordenes ?? 0} órdenes de trabajo creadas</p>

            {stats.objetivosMes.length > 0 && (
              <>
                <h3 className="mb-3 font-semibold text-white">Objetivos vs Real</h3>
                <Table className="mb-6">
                  <Thead>
                    <tr>
                      <Th>Objetivo</Th>
                      <Th>Meta</Th>
                      <Th>Real</Th>
                      <Th>Estado</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {stats.objetivosMes.map((g, i) => (
                      <Tr key={i}>
                        <Td>{TIPO_LABELS[g.tipo]}</Td>
                        <Td className="text-carbon-400">{g.objetivo}</Td>
                        <Td className="text-carbon-400">{g.alcanzado}</Td>
                        <Td className="text-carbon-400">{g.estado}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </>
            )}

            <h3 className="mb-3 font-semibold text-white">Vehículos más frecuentes</h3>
            {stats.vehiculosFrecuentes.length === 0 ? (
              <p className="mb-6 text-sm text-carbon-400">Sin datos</p>
            ) : (
              <ul className="mb-6 list-inside list-disc text-sm text-carbon-300">
                {stats.vehiculosFrecuentes.map((v, i) => (
                  <li key={i}>
                    {v.patente} — {v.marca} {v.modelo} ({v.count} órdenes)
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mb-3 font-semibold text-white">Últimos 6 meses</h3>
            <Table>
              <Thead>
                <tr>
                  <Th>Mes</Th>
                  <Th>Ingresos</Th>
                  <Th>Egresos</Th>
                  <Th>Órdenes</Th>
                </tr>
              </Thead>
              <Tbody>
                {stats.monthlyData.map((m, i) => (
                  <Tr key={i}>
                    <Td>{MESES[m.mes - 1]} {m.anio}</Td>
                    <Td className="text-emerald-400">${m.ingresos.toFixed(2)}</Td>
                    <Td className="text-red-400">${m.egresos.toFixed(2)}</Td>
                    <Td className="text-carbon-400">{m.ordenes}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
