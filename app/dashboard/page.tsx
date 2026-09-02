"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import {
  Wrench,
  CircleDollarSign,
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
  MessageCircle,
  PackageCheck,
  Timer,
  History,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/common/StatCard";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppLink, whatsAppConfirmTurno, whatsAppVehiculoListo, whatsAppRecordatorioPago } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Heurística de negocio: una orden se considera "demorada" si sigue sin
// entregarse (no ENTREGADA) y su fecha de ingreso supera este umbral.
const DIAS_DEMORA = 3;
const LAST_VISIT_KEY = "automek_last_visit_ts";

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
  client: { nombre: string; telefono?: string };
  vehicle: { patente: string };
}

interface Payment {
  monto: number;
  status: string;
}

interface WorkOrderItem {
  id: string;
  status: string;
  total: number;
  motivoIngreso: string;
  fecha: string;
  client: { nombre: string; telefono?: string };
  vehicle: { patente: string };
  payments: Payment[];
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

function pendienteDe(wo: WorkOrderItem): number {
  const pagado = wo.payments.filter((p) => p.status === "PAGADO").reduce((s, p) => s + p.monto, 0);
  return wo.total - pagado;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function WhatsAppButton({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20"
    >
      <MessageCircle className="h-3 w-3" /> {label}
    </a>
  );
}

function DashboardContent() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[] | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[] | null>(null);
  const [activity, setActivity] = useState<AuditLogItem[] | null>(null);
  const [lastVisit, setLastVisit] = useState<string | null | undefined>(undefined);

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

  // "Desde tu última visita" se basa en una marca guardada en este navegador
  // (no hay un registro de "último login" en el servidor todavía).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_VISIT_KEY);
      setLastVisit(stored);
      window.localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    } catch {
      setLastVisit(null);
    }
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const turnosHoy = (schedules || [])
    .filter((s) => s.fecha.slice(0, 10) === today && s.status !== "CANCELADO")
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const turnosPorConfirmarHoy = turnosHoy.filter((s) => s.status === "PENDIENTE");

  const upcomingSchedules = (schedules || [])
    .filter((s) => s.fecha.slice(0, 10) > today && s.status !== "CANCELADO" && s.status !== "COMPLETADO")
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .slice(0, 5);

  const vehiculosEnTaller = (workOrders || []).filter((wo) => wo.status === "EN_PROCESO");
  const listosParaEntregar = (workOrders || []).filter((wo) => wo.status === "TERMINADA");
  const ordenesDemoradas = (workOrders || []).filter(
    (wo) => (wo.status === "APROBADA" || wo.status === "EN_PROCESO") && daysSince(wo.fecha) >= DIAS_DEMORA
  );

  const statusCounts = (workOrders || []).reduce<Record<string, number>>((acc, wo) => {
    if (wo.status === "ENTREGADA") return acc;
    acc[wo.status] = (acc[wo.status] || 0) + 1;
    return acc;
  }, {});
  const activeStatusOrder = ["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA"];

  const recentActivity = (activity || []).slice(0, 6);
  const activitySinceLastVisit = lastVisit
    ? (activity || []).filter((a) => new Date(a.timestamp).getTime() > new Date(lastVisit).getTime())
    : [];

  const alerts: Array<{ tone: "danger" | "warning" | "info"; text: string; href: string }> = [];
  if (turnosPorConfirmarHoy.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${turnosPorConfirmarHoy.length} turno${turnosPorConfirmarHoy.length > 1 ? "s" : ""} de hoy sin confirmar.`,
      href: "/schedules",
    });
  }
  if (ordenesDemoradas.length > 0) {
    alerts.push({
      tone: "danger",
      text: `${ordenesDemoradas.length} orden${ordenesDemoradas.length > 1 ? "es" : ""} demorada${ordenesDemoradas.length > 1 ? "s" : ""} (${DIAS_DEMORA}+ días sin avanzar).`,
      href: "/work-orders",
    });
  }
  if (stats && stats.deudasPendientes > 0) {
    alerts.push({
      tone: "warning",
      text: `${formatCurrency(stats.deudasPendientes)} en deudas pendientes de cobro.`,
      href: "/debts",
    });
  }
  if (listosParaEntregar.length > 0) {
    alerts.push({
      tone: "info",
      text: `${listosParaEntregar.length} vehículo${listosParaEntregar.length > 1 ? "s" : ""} listo${listosParaEntregar.length > 1 ? "s" : ""} para entregar.`,
      href: "/work-orders",
    });
  }

  const isLoading = stats === null;
  const opsLoading = schedules === null || workOrders === null;

  return (
    <AppShell>
      {/* Encabezado / saludo */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-400">Centro de Control</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          Hola, {session?.user?.name?.split(" ")[0] || "bienvenido"} 👋
        </h1>
        <p className="mt-1 text-sm text-carbon-400">
          Este es tu día, {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}.
        </p>
      </div>

      {/* Alertas accionables */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className={
                "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-opacity hover:opacity-90 " +
                (a.tone === "danger"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : a.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-300")
              }
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.text}
            </Link>
          ))}
        </div>
      )}

      {/* Tu día: operación en curso */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {opsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          <>
            <StatCard label="Turnos Hoy" value={String(turnosHoy.length)} icon={CalendarDays} tone="brand" />
            <StatCard label="En el Taller" value={String(vehiculosEnTaller.length)} icon={Wrench} tone="warning" />
            <StatCard label="Listos para Entregar" value={String(listosParaEntregar.length)} icon={PackageCheck} tone="success" />
            <StatCard label="Por Confirmar Hoy" value={String(turnosPorConfirmarHoy.length)} icon={Timer} tone="neutral" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-5 lg:col-span-2">
          {/* Turnos de hoy */}
          <Card>
            <CardHeader>
              <CardTitle>Turnos de Hoy</CardTitle>
              <Link href="/schedules" className="text-xs text-brand-400 hover:underline">Ver agenda</Link>
            </CardHeader>
            <CardContent>
              {opsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : turnosHoy.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No hay turnos agendados para hoy" />
              ) : (
                <ul className="space-y-2">
                  {turnosHoy.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-carbon-700 bg-carbon-900/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-carbon-100">
                          <Clock className="h-3.5 w-3.5 text-carbon-400" /> {s.hora} — {s.client.nombre}
                        </p>
                        <p className="truncate text-xs text-carbon-500">{s.vehicle.patente} · {s.motivo}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={SCHEDULE_STATUS_COLORS[s.status]}>{s.status.replace("_", " ")}</Badge>
                        {s.status === "PENDIENTE" && (
                          <WhatsAppButton
                            href={buildWhatsAppLink(
                              s.client.telefono,
                              whatsAppConfirmTurno(s.client.nombre, new Date(`${s.fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR"), s.hora, s.motivo)
                            )}
                            label="Confirmar"
                          />
                        )}
                        <Link href={`/schedules/${s.id}`} className="text-xs font-medium text-brand-400 hover:text-brand-300">Ver</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Vehículos en el taller */}
          <Card>
            <CardHeader>
              <CardTitle>Vehículos Actualmente en el Taller</CardTitle>
            </CardHeader>
            <CardContent>
              {opsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : vehiculosEnTaller.length === 0 ? (
                <EmptyState icon={Wrench} title="No hay vehículos en proceso ahora mismo" />
              ) : (
                <ul className="space-y-2">
                  {vehiculosEnTaller.map((wo) => (
                    <li key={wo.id} className="flex items-center justify-between gap-3 rounded-lg border border-carbon-700 bg-carbon-900/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-carbon-100">{wo.vehicle.patente} — {wo.client.nombre}</p>
                        <p className="truncate text-xs text-carbon-500">{wo.motivoIngreso} · {daysSince(wo.fecha)} día{daysSince(wo.fecha) !== 1 ? "s" : ""} en taller</p>
                      </div>
                      <Link href={`/work-orders/${wo.id}`} className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300">Ver orden</Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Listos para entregar */}
          <Card>
            <CardHeader>
              <CardTitle>Listos para Entregar</CardTitle>
            </CardHeader>
            <CardContent>
              {opsLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : listosParaEntregar.length === 0 ? (
                <EmptyState icon={PackageCheck} title="No hay vehículos listos para entregar" />
              ) : (
                <ul className="space-y-2">
                  {listosParaEntregar.map((wo) => {
                    const saldo = pendienteDe(wo);
                    return (
                      <li key={wo.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-carbon-100">{wo.vehicle.patente} — {wo.client.nombre}</p>
                          <p className="truncate text-xs text-carbon-500">
                            Saldo: {saldo > 0.01 ? <span className="font-medium text-amber-400">{formatCurrency(saldo)}</span> : <span className="text-emerald-400">Pagado</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <WhatsAppButton
                            href={buildWhatsAppLink(wo.client.telefono, whatsAppVehiculoListo(wo.client.nombre, wo.vehicle.patente))}
                            label="Avisar"
                          />
                          {saldo > 0.01 && (
                            <WhatsAppButton
                              href={buildWhatsAppLink(wo.client.telefono, whatsAppRecordatorioPago(wo.client.nombre, saldo, `orden #${wo.id.slice(-6)}`))}
                              label="Cobrar"
                            />
                          )}
                          <Link href={`/work-orders/${wo.id}`} className="text-xs font-medium text-brand-400 hover:text-brand-300">Ver</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Órdenes demoradas */}
          {ordenesDemoradas.length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle>Órdenes Demoradas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {ordenesDemoradas.map((wo) => (
                    <li key={wo.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-carbon-100">{wo.vehicle.patente} — {wo.client.nombre}</p>
                        <p className="truncate text-xs text-red-400">{daysSince(wo.fecha)} días sin avanzar · {STATUS_LABELS[wo.status]}</p>
                      </div>
                      <Link href={`/work-orders/${wo.id}`} className="shrink-0 text-xs font-medium text-brand-400 hover:text-brand-300">Ver orden</Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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

          {/* Dinero pendiente */}
          <Card>
            <CardHeader>
              <CardTitle>Dinero Pendiente de Cobro</CardTitle>
              <Link href="/debts" className="text-xs text-brand-400 hover:underline">Ver deudas</Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <p className={`text-2xl font-bold ${stats!.deudasPendientes > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {formatCurrency(stats!.deudasPendientes)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Próximos turnos (después de hoy) */}
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
              {lastVisit !== undefined && lastVisit !== null && (
                <div className="mb-3 flex items-center gap-1.5 border-b border-carbon-700 pb-3 text-xs text-carbon-500">
                  <History className="h-3.5 w-3.5" />
                  {activitySinceLastVisit.length > 0
                    ? `${activitySinceLastVisit.length} evento${activitySinceLastVisit.length > 1 ? "s" : ""} desde tu última visita`
                    : "Sin novedades desde tu última visita"}
                </div>
              )}
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
