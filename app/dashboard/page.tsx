"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import {
  Wrench,
  CircleDollarSign,
  TrendingDown,
  AlertTriangle,
  Users,
  Car,
  FileText,
  CalendarDays,
  Wallet,
  Target,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

interface ScheduleItem {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  status: string;
  client: { nombre: string };
  vehicle: { patente: string };
}

interface WorkOrderItem {
  id: string;
  status: string;
}

interface AuditLogItem {
  id: string;
  accion: string;
  entityType: string;
  descripcion: string | null;
  timestamp: string;
}

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TIPO_LABELS: Record<string, string> = {
  INGRESO_MENSUAL: "Ingreso Mensual",
  ORDENES_MENSUALES: "Órdenes Mensuales",
  CLIENTES_NUEVOS: "Clientes Nuevos",
};
const STATUS_LABELS: Record<string, string> = {
  PRESUPUESTA: "Presupuestada",
  APROBADA: "Aprobada",
  EN_PROCESO: "En Proceso",
  TERMINADA: "Terminada",
  ENTREGADA: "Entregada",
};
const STATUS_COLORS: Record<string, "neutral" | "brand" | "success" | "danger" | "warning" | "info"> = {
  PRESUPUESTA: "neutral",
  APROBADA: "info",
  EN_PROCESO: "warning",
  TERMINADA: "success",
  ENTREGADA: "brand",
};
const SCHEDULE_STATUS_COLORS: Record<string, "neutral" | "brand" | "success" | "danger" | "warning" | "info"> = {
  PENDIENTE: "warning",
  CONFIRMADO: "info",
  EN_ESPERA: "neutral",
  CANCELADO: "danger",
  COMPLETADO: "success",
};
const ACTION_LABELS: Record<string, string> = {
  QUOTE_CREATED: "Presupuesto creado",
  QUOTE_APPROVED: "Presupuesto aprobado",
  QUOTE_REJECTED: "Presupuesto rechazado",
  QUOTE_CONVERTED_TO_WORK_ORDER: "Presupuesto convertido a orden",
  WORK_ORDER_CREATED: "Orden de trabajo creada",
  WORK_ORDER_STATUS_CHANGED: "Estado de orden actualizado",
  WORK_ORDER_COMPLETED: "Orden completada",
  WORK_ORDER_DELIVERED: "Orden entregada",
  PAYMENT_RECORDED: "Pago registrado",
  PAYMENT_ANNULLED: "Pago anulado",
  PAYMENT_UPDATED: "Pago actualizado",
  CASH_MOVEMENT_RECORDED: "Movimiento de caja",
  DAILY_CLOSE_CLOSED: "Cierre de caja realizado",
  DAILY_CLOSE_REOPENED: "Cierre de caja reabierto",
  CLIENT_CREDIT_UPDATED: "Cuenta corriente actualizada",
  SCHEDULE_STATUS_CHANGED: "Turno actualizado",
};

const QUICK_ACTIONS = [
  { label: "Nuevo Cliente", href: "/clients", icon: Users },
  { label: "Nuevo Vehículo", href: "/vehicles", icon: Car },
  { label: "Nuevo Presupuesto", href: "/quotes", icon: FileText },
  { label: "Nueva Orden", href: "/work-orders", icon: Wrench },
  { label: "Agendar Turno", href: "/schedules", icon: CalendarDays },
  { label: "Registrar Movimiento", href: "/cash-movements", icon: Wallet },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function DashboardContent() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[] | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[] | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[] | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [statsRes, schedulesRes, ordersRes, activityRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/schedules"),
          fetch("/api/work-orders"),
          fetch("/api/audit-logs"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (schedulesRes.ok) setSchedules(await schedulesRes.json());
        if (ordersRes.ok) setWorkOrders(await ordersRes.json());
        if (activityRes.ok) setActivity(await activityRes.json());
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      }
    }
    loadAll();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingSchedules = (schedules || [])
    .filter((s) => s.fecha.slice(0, 10) >= today && s.status !== "CANCELADO" && s.status !== "COMPLETADO")
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 5);

  const statusCounts = (workOrders || []).reduce<Record<string, number>>((acc, wo) => {
    if (wo.status === "ENTREGADA") return acc;
    acc[wo.status] = (acc[wo.status] || 0) + 1;
    return acc;
  }, {});
  const activeStatusOrder = ["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA"];

  const recentActivity = (activity || []).slice(0, 6);

  const alerts: Array<{ tone: "danger" | "warning" | "info"; text: string }> = [];
  if (stats && stats.deudasPendientes > 0) {
    alerts.push({
      tone: "warning",
      text: `Hay ${formatCurrency(stats.deudasPendientes)} en deudas pendientes de cobro.`,
    });
  }
  const turnosHoy = (schedules || []).filter(
    (s) => s.fecha.slice(0, 10) === today && (s.status === "PENDIENTE" || s.status === "CONFIRMADO")
  );
  if (turnosHoy.length > 0) {
    alerts.push({
      tone: "info",
      text: `Tenés ${turnosHoy.length} turno${turnosHoy.length > 1 ? "s" : ""} agendado${turnosHoy.length > 1 ? "s" : ""} para hoy.`,
    });
  }
  if (stats && stats.egresosMes > stats.cobrosMes && stats.cobrosMes > 0) {
    alerts.push({
      tone: "danger",
      text: "Los egresos del mes superan a los cobros del mes.",
    });
  }

  const isLoading = stats === null;

  return (
    <AppShell>
      {/* Encabezado / saludo */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Centro de Control</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          Hola, {session?.user?.name?.split(" ")[0] || "bienvenido"} 👋
        </h1>
        <p className="mt-1 text-sm text-carbon-400">
          Este es el estado de tu taller hoy, {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}.
        </p>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={
                "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm " +
                (a.tone === "danger"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : a.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-300")
              }
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Órdenes Activas" value={String(stats!.ordenesActivas)} icon={Wrench} tone="brand" />
          <StatCard label="Cobros del Mes" value={formatCurrency(stats!.cobrosMes)} icon={CircleDollarSign} tone="success" />
          <StatCard label="Egresos del Mes" value={formatCurrency(stats!.egresosMes)} icon={TrendingDown} tone="danger" />
          <StatCard label="Deudas Pendientes" value={formatCurrency(stats!.deudasPendientes)} icon={AlertTriangle} tone="warning" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-5 lg:col-span-2">
          {/* Gráfico ingresos/egresos */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos vs Egresos — últimos 6 meses</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <>
                  <div className="flex h-44 items-end gap-3">
                    {stats!.monthlyData.map((m, i) => {
                      const max = Math.max(1, ...stats!.monthlyData.map((x) => Math.max(x.ingresos, x.egresos)));
                      return (
                        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
                          <div className="flex h-full w-full items-end justify-center gap-1">
                            <div
                              className="w-3 rounded-t bg-emerald-500 transition-all"
                              style={{ height: `${(m.ingresos / max) * 100}%` }}
                              title={`Ingresos: ${formatCurrency(m.ingresos)}`}
                            />
                            <div
                              className="w-3 rounded-t bg-red-500/80 transition-all"
                              style={{ height: `${(m.egresos / max) * 100}%` }}
                              title={`Egresos: ${formatCurrency(m.egresos)}`}
                            />
                          </div>
                          <span className="mt-2 text-[11px] text-carbon-400">{MESES_CORTOS[m.mes - 1]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-carbon-400">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ingresos
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500/80" /> Egresos
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Órdenes por estado */}
          <Card>
            <CardHeader>
              <CardTitle>Órdenes por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {workOrders === null ? (
                <Skeleton className="h-16 w-full" />
              ) : activeStatusOrder.every((s) => !statusCounts[s]) ? (
                <EmptyState icon={CheckCircle2} title="Sin órdenes activas" description="No hay órdenes de trabajo en curso en este momento." />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {activeStatusOrder.map((s) => (
                    <div key={s} className="rounded-lg border border-carbon-700 bg-carbon-900/50 p-3">
                      <Badge variant={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Badge>
                      <p className="mt-2 text-xl font-bold text-white">{statusCounts[s] || 0}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Objetivos del mes */}
          <Card>
            <CardHeader>
              <CardTitle>Objetivos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : stats!.objetivosMes.length === 0 ? (
                <EmptyState icon={Target} title="Sin objetivos definidos" description="Definí metas mensuales para hacer seguimiento del progreso." action={<Link href="/goals" className="text-xs font-medium text-brand-400 hover:underline">Definir objetivo →</Link>} />
              ) : (
                <div className="space-y-4">
                  {stats!.objetivosMes.map((g, i) => {
                    const pct = Math.min(100, (g.alcanzado / g.objetivo) * 100);
                    return (
                      <div key={i}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="text-carbon-200">{TIPO_LABELS[g.tipo] || g.tipo}</span>
                          <span className={g.estado === "ALCANZADO" ? "font-medium text-emerald-400" : "font-medium text-carbon-300"}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-carbon-700">
                          <div
                            className={`h-2 rounded-full transition-all ${g.estado === "ALCANZADO" ? "bg-emerald-500" : "bg-brand-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral */}
        <div className="space-y-5">
          {/* Acciones rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-start gap-2 rounded-lg border border-carbon-700 bg-carbon-900/40 p-3 text-xs font-medium text-carbon-200 transition-colors hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300"
                >
                  <a.icon className="h-4 w-4 text-brand-400" />
                  {a.label}
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Próximos turnos */}
          <Card>
            <CardHeader>
              <CardTitle>Próximos Turnos</CardTitle>
              <Link href="/schedules" className="text-xs text-brand-400 hover:underline">
                Ver agenda
              </Link>
            </CardHeader>
            <CardContent>
              {schedules === null ? (
                <Skeleton className="h-24 w-full" />
              ) : upcomingSchedules.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Sin turnos próximos" />
              ) : (
                <ul className="space-y-3">
                  {upcomingSchedules.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-carbon-100">{s.client.nombre}</p>
                        <p className="truncate text-xs text-carbon-400">{s.vehicle.patente} · {s.motivo}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="flex items-center gap-1 text-xs font-medium text-carbon-200">
                          <Clock className="h-3 w-3" /> {s.hora}
                        </p>
                        <Badge variant={SCHEDULE_STATUS_COLORS[s.status]} className="mt-1">
                          {s.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Vehículos más frecuentes */}
          <Card>
            <CardHeader>
              <CardTitle>Vehículos más Frecuentes</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : stats!.vehiculosFrecuentes.length === 0 ? (
                <EmptyState icon={Car} title="Sin datos aún" />
              ) : (
                <ul className="space-y-2">
                  {stats!.vehiculosFrecuentes.map((v, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-carbon-200">{v.patente} — {v.marca} {v.modelo}</span>
                      <span className="shrink-0 font-medium text-carbon-400">{v.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Actividad reciente */}
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <Link href="/audit-logs" className="text-xs text-brand-400 hover:underline">
                Ver todo
              </Link>
            </CardHeader>
            <CardContent>
              {activity === null ? (
                <Skeleton className="h-24 w-full" />
              ) : recentActivity.length === 0 ? (
                <EmptyState icon={Activity} title="Sin actividad reciente" />
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      <div className="min-w-0">
                        <p className="truncate text-carbon-200">{ACTION_LABELS[a.accion] || a.accion}</p>
                        <p className="text-xs text-carbon-500">{timeAgo(a.timestamp)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accesos a todas las secciones */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-carbon-300">Explorar el sistema</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Clientes", href: "/clients", icon: Users },
            { label: "Vehículos", href: "/vehicles", icon: Car },
            { label: "Presupuestos", href: "/quotes", icon: FileText },
            { label: "Órdenes de Trabajo", href: "/work-orders", icon: Wrench },
            { label: "Agenda", href: "/schedules", icon: CalendarDays },
            { label: "Caja y Movimientos", href: "/cash-movements", icon: Wallet },
            { label: "Deudas", href: "/debts", icon: CircleDollarSign },
            { label: "Objetivos", href: "/goals", icon: Target },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-xl border border-carbon-700 bg-carbon-850 p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-glow"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-carbon-100">
                <item.icon className="h-4 w-4 text-brand-400" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4 text-carbon-500 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-carbon-950 text-sm text-carbon-400">
          Cargando...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
