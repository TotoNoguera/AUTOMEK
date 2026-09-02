"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/EmptyState";

interface MonthlyPnl {
  mes: number;
  anio: number;
  ingresos: number;
  costos: number;
  costosFijos: number;
  costosVariables: number;
  margen: number;
}

interface PnlData {
  monthlyData: MonthlyPnl[];
  costosPorCategoriaMesActual: Array<{ categoria: string; monto: number }>;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function PnlReportPage() {
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/reports/pnl");
        if (response.ok) {
          setData(await response.json());
        }
      } catch (error) {
        console.error("Error loading P&L report:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function exportCsv() {
    if (!data) return;
    downloadCsv(
      `reporte-costos-ingresos-${new Date().toISOString().split("T")[0]}.csv`,
      ["Mes", "Año", "Ingresos", "Costos Fijos", "Costos Variables", "Costos Totales", "Margen"],
      data.monthlyData.map((m) => [
        MESES[m.mes - 1],
        m.anio,
        m.ingresos.toFixed(2),
        m.costosFijos.toFixed(2),
        m.costosVariables.toFixed(2),
        m.costos.toFixed(2),
        m.margen.toFixed(2),
      ])
    );
  }

  return (
    <AppShell>
      <PageHeader
        className="no-print"
        title="Costos vs Ingresos (P&L)"
        description="Márgenes reales por mes"
        actions={
          data && (
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
            </>
          )
        }
      />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : !data ? (
        <p className="text-sm text-carbon-400">Error cargando el reporte</p>
      ) : (
        <Card>
          <CardContent>
            <h2 className="mb-4 text-lg font-semibold text-white">Últimos 6 meses</h2>
            <Table className="mb-8">
              <Thead>
                <tr>
                  <Th>Mes</Th>
                  <Th>Ingresos</Th>
                  <Th>Costos Fijos</Th>
                  <Th>Costos Variables</Th>
                  <Th>Costos Totales</Th>
                  <Th>Margen</Th>
                </tr>
              </Thead>
              <Tbody>
                {data.monthlyData.map((m, i) => (
                  <Tr key={i}>
                    <Td>{MESES[m.mes - 1]} {m.anio}</Td>
                    <Td className="text-emerald-400">${m.ingresos.toFixed(2)}</Td>
                    <Td className="text-carbon-400">${m.costosFijos.toFixed(2)}</Td>
                    <Td className="text-carbon-400">${m.costosVariables.toFixed(2)}</Td>
                    <Td className="text-red-400">${m.costos.toFixed(2)}</Td>
                    <Td className={`font-bold ${m.margen >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${m.margen.toFixed(2)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <h2 className="mb-4 text-lg font-semibold text-white">Costos por Categoría — Mes Actual</h2>
            {data.costosPorCategoriaMesActual.length === 0 ? (
              <p className="text-sm text-carbon-400">Sin costos registrados este mes</p>
            ) : (
              <ul className="divide-y divide-carbon-700 text-sm text-carbon-200">
                {data.costosPorCategoriaMesActual.map((c, i) => (
                  <li key={i} className="flex justify-between py-2">
                    <span>{c.categoria}</span>
                    <span className="font-medium">${c.monto.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
