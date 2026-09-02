"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";

export const dynamic = "force-dynamic";

interface UserSession {
  user?: {
    id: string;
    email: string;
    name: string;
    tallerId?: string;
  };
}

interface StatsData {
  ordenesActivas: number;
  cobrosHoy: number;
  cobrosMes: number;
  egresosHoy: number;
  egresosMes: number;
  deudasPendientes: number;
  vehiculosFrecuentes: Array<{ patente: string; marca: string; modelo: string; count: number }>;
  objetivosMes: Array<{ tipo: string; objetivo: number; alcanzado: number; estado: string }>;
  monthlyData: Array<{ mes: number; anio: number; ingresos: number; egresos: number; ordenes: number }>;
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TIPO_LABELS: Record<string, string> = {
  INGRESO_MENSUAL: "Ingreso Mensual",
  ORDENES_MENSUALES: "Órdenes Mensuales",
  CLIENTES_NUEVOS: "Clientes Nuevos",
};

function DashboardContent() {
  const { data: session } = useSession() as { data: UserSession | null };
  const [isLoading, setIsLoading] = useState(false);
  const [tallerName, setTallerName] = useState<string>("");
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    // En Fase 1, no hacemos fetch del taller
    // Solo mostramos el nombre del usuario
    setTallerName("Tu Taller");
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          setStats(await response.json());
        }
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
      }
    }
    loadStats();
  }, []);

  const handleLogout = async () => {
    setIsLoading(true);
    await signOut({ redirect: true, callbackUrl: "/auth/login" });
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{tallerName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Bienvenido, {session.user?.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "Cerrando sesión..." : "Logout"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Dashboard
            </h2>
            <p className="text-gray-600">
              Bienvenido al sistema de gestión del taller mecánico
            </p>
          </div>

          {/* KPIs */}
          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow">
                  <p className="text-xs text-gray-500">Órdenes Activas</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.ordenesActivas}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <p className="text-xs text-gray-500">Cobros Hoy</p>
                  <p className="text-2xl font-bold text-green-700">${stats.cobrosHoy.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <p className="text-xs text-gray-500">Cobros del Mes</p>
                  <p className="text-2xl font-bold text-green-700">${stats.cobrosMes.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <p className="text-xs text-gray-500">Egresos del Mes</p>
                  <p className="text-2xl font-bold text-red-700">${stats.egresosMes.toFixed(2)}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                  <p className="text-xs text-gray-500">Deudas Pendientes</p>
                  <p className="text-2xl font-bold text-orange-700">${stats.deudasPendientes.toFixed(2)}</p>
                </div>
              </div>

              {/* Gráficos simples (sin librerías externas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="font-bold text-gray-900 mb-4">Ingresos / Egresos (6 meses)</h3>
                  <div className="flex items-end gap-3 h-40">
                    {stats.monthlyData.map((m, i) => {
                      const max = Math.max(
                        1,
                        ...stats.monthlyData.map((x) => Math.max(x.ingresos, x.egresos))
                      );
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div className="flex items-end gap-1 h-full">
                            <div
                              className="w-3 bg-green-500 rounded-t"
                              style={{ height: `${(m.ingresos / max) * 100}%` }}
                              title={`Ingresos: $${m.ingresos.toFixed(2)}`}
                            />
                            <div
                              className="w-3 bg-red-500 rounded-t"
                              style={{ height: `${(m.egresos / max) * 100}%` }}
                              title={`Egresos: $${m.egresos.toFixed(2)}`}
                            />
                          </div>
                          <span className="text-xs text-gray-500 mt-1">{MESES_CORTOS[m.mes - 1]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Ingresos
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Egresos
                    </span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="font-bold text-gray-900 mb-4">Órdenes por Mes</h3>
                  <div className="flex items-end gap-3 h-40">
                    {stats.monthlyData.map((m, i) => {
                      const max = Math.max(1, ...stats.monthlyData.map((x) => x.ordenes));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className="w-6 bg-blue-500 rounded-t"
                            style={{ height: `${(m.ordenes / max) * 100}%` }}
                            title={`${m.ordenes} órdenes`}
                          />
                          <span className="text-xs text-gray-500 mt-1">{MESES_CORTOS[m.mes - 1]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {stats.objetivosMes.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h3 className="font-bold text-gray-900 mb-4">Objetivos del Mes vs Real</h3>
                  <div className="space-y-3">
                    {stats.objetivosMes.map((g, i) => {
                      const pct = Math.min(100, (g.alcanzado / g.objetivo) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm text-gray-700 mb-1">
                            <span>{TIPO_LABELS[g.tipo] || g.tipo}</span>
                            <span>{pct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${g.estado === "ALCANZADO" ? "bg-green-600" : "bg-blue-600"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stats.vehiculosFrecuentes.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow mb-8">
                  <h3 className="font-bold text-gray-900 mb-4">Vehículos más Frecuentes</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {stats.vehiculosFrecuentes.map((v, i) => (
                      <li key={i} className="flex justify-between">
                        <span>{v.patente} — {v.marca} {v.modelo}</span>
                        <span className="font-medium">{v.count} órdenes</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Link
              href="/clients"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Clientes</h3>
              <p className="text-gray-600 text-sm mb-4">
                Gestiona todos tus clientes
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Clientes →
              </div>
            </Link>

            <Link
              href="/vehicles"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Vehículos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Visualiza todos los vehículos registrados
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Vehículos →
              </div>
            </Link>

            <Link
              href="/quotes"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Presupuestos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Gestiona presupuestos de trabajos
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Presupuestos →
              </div>
            </Link>

            <Link
              href="/work-orders"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Órdenes de Trabajo
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Gestiona órdenes de trabajo activas
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Órdenes →
              </div>
            </Link>

            <Link
              href="/schedules"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Agenda
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Gestiona turnos y calendario
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Agenda →
              </div>
            </Link>

            <Link
              href="/cash-movements"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Caja y Movimientos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Registra ingresos y egresos
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Caja →
              </div>
            </Link>

            <Link
              href="/daily-closes"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Cierre de Caja
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Cierra la caja diaria
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Cierres →
              </div>
            </Link>

            <Link
              href="/debts"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Deudas
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Órdenes y saldos pendientes
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Deudas →
              </div>
            </Link>

            <Link
              href="/technicians"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Técnicos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Gestiona el equipo técnico
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Técnicos →
              </div>
            </Link>

            <Link
              href="/goals"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Objetivos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Metas mensuales y seguimiento
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Objetivos →
              </div>
            </Link>

            <Link
              href="/audit-logs"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Auditoría
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Historial de cambios sensibles
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Auditoría →
              </div>
            </Link>

            <Link
              href="/reports/monthly"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Reporte Mensual
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Resumen financiero imprimible
              </p>
              <div className="text-blue-600 font-semibold">
                Ver Reporte →
              </div>
            </Link>

            <Link
              href="/costs"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Costos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Costos fijos y variables por mes
              </p>
              <div className="text-blue-600 font-semibold">
                Ir a Costos →
              </div>
            </Link>

            <Link
              href="/reports/pnl"
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Costos vs Ingresos
              </h3>
              <p className="text-gray-600 text-sm mb-4">
                Reporte P&amp;L, márgenes por mes
              </p>
              <div className="text-blue-600 font-semibold">
                Ver Reporte →
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
