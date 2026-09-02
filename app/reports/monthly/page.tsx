"use client";

import { useEffect, useState } from "react";

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

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (!stats) return <div className="text-center py-12">Error cargando el reporte</div>;

  const now = new Date();
  const current = stats.monthlyData[stats.monthlyData.length - 1];
  const neto = stats.cobrosMes - stats.egresosMes;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="no-print flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Resumen Mensual</h1>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Imprimir / Guardar PDF
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Resumen Mensual — {MESES[now.getMonth()]} {now.getFullYear()}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Generado el {now.toLocaleDateString("es-AR")}
          </p>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Ingresos del mes</p>
              <p className="text-2xl font-bold text-green-700">${stats.cobrosMes.toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Egresos del mes</p>
              <p className="text-2xl font-bold text-red-700">${stats.egresosMes.toFixed(2)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Neto del mes</p>
              <p className={`text-2xl font-bold ${neto >= 0 ? "text-green-700" : "text-red-700"}`}>
                ${neto.toFixed(2)}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Deudas pendientes</p>
              <p className="text-2xl font-bold text-orange-700">${stats.deudasPendientes.toFixed(2)}</p>
            </div>
          </div>

          <h3 className="font-bold text-gray-900 mb-3">Órdenes del mes</h3>
          <p className="text-gray-700 mb-6">{current?.ordenes ?? 0} órdenes de trabajo creadas</p>

          {stats.objetivosMes.length > 0 && (
            <>
              <h3 className="font-bold text-gray-900 mb-3">Objetivos vs Real</h3>
              <table className="w-full mb-6 border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-gray-600">Objetivo</th>
                    <th className="text-left py-2 text-sm text-gray-600">Meta</th>
                    <th className="text-left py-2 text-sm text-gray-600">Real</th>
                    <th className="text-left py-2 text-sm text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.objetivosMes.map((g, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 text-sm">{TIPO_LABELS[g.tipo]}</td>
                      <td className="py-2 text-sm">{g.objetivo}</td>
                      <td className="py-2 text-sm">{g.alcanzado}</td>
                      <td className="py-2 text-sm">{g.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h3 className="font-bold text-gray-900 mb-3">Vehículos más frecuentes</h3>
          {stats.vehiculosFrecuentes.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin datos</p>
          ) : (
            <ul className="list-disc list-inside text-gray-700 mb-6">
              {stats.vehiculosFrecuentes.map((v, i) => (
                <li key={i}>
                  {v.patente} — {v.marca} {v.modelo} ({v.count} órdenes)
                </li>
              ))}
            </ul>
          )}

          <h3 className="font-bold text-gray-900 mb-3">Últimos 6 meses</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm text-gray-600">Mes</th>
                <th className="text-left py-2 text-sm text-gray-600">Ingresos</th>
                <th className="text-left py-2 text-sm text-gray-600">Egresos</th>
                <th className="text-left py-2 text-sm text-gray-600">Órdenes</th>
              </tr>
            </thead>
            <tbody>
              {stats.monthlyData.map((m, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 text-sm">{MESES[m.mes - 1]} {m.anio}</td>
                  <td className="py-2 text-sm text-green-700">${m.ingresos.toFixed(2)}</td>
                  <td className="py-2 text-sm text-red-700">${m.egresos.toFixed(2)}</td>
                  <td className="py-2 text-sm">{m.ordenes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
