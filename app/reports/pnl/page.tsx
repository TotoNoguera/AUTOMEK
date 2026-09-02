"use client";

import { useEffect, useState } from "react";
import { downloadCsv } from "@/lib/csv";

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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (!data) return <div className="text-center py-12">Error cargando el reporte</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="no-print flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Costos vs Ingresos (P&amp;L)</h1>
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
            >
              Exportar CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
            >
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 overflow-x-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Últimos 6 meses</h2>
          <table className="w-full border-collapse mb-8 min-w-[600px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm text-gray-600">Mes</th>
                <th className="text-left py-2 text-sm text-gray-600">Ingresos</th>
                <th className="text-left py-2 text-sm text-gray-600">Costos Fijos</th>
                <th className="text-left py-2 text-sm text-gray-600">Costos Variables</th>
                <th className="text-left py-2 text-sm text-gray-600">Costos Totales</th>
                <th className="text-left py-2 text-sm text-gray-600">Margen</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyData.map((m, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 text-sm">{MESES[m.mes - 1]} {m.anio}</td>
                  <td className="py-2 text-sm text-green-700">${m.ingresos.toFixed(2)}</td>
                  <td className="py-2 text-sm text-gray-600">${m.costosFijos.toFixed(2)}</td>
                  <td className="py-2 text-sm text-gray-600">${m.costosVariables.toFixed(2)}</td>
                  <td className="py-2 text-sm text-red-700">${m.costos.toFixed(2)}</td>
                  <td className={`py-2 text-sm font-bold ${m.margen >= 0 ? "text-green-700" : "text-red-700"}`}>
                    ${m.margen.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-xl font-bold text-gray-900 mb-4">Costos por Categoría — Mes Actual</h2>
          {data.costosPorCategoriaMesActual.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin costos registrados este mes</p>
          ) : (
            <ul className="text-sm text-gray-700 space-y-1">
              {data.costosPorCategoriaMesActual.map((c, i) => (
                <li key={i} className="flex justify-between border-b py-1">
                  <span>{c.categoria}</span>
                  <span className="font-medium">${c.monto.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
