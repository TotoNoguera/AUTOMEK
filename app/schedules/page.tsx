"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Eye, Check, MessageCircle } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink, whatsAppConfirmTurno } from "@/lib/whatsapp";

interface Schedule {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  status: "PENDIENTE" | "CONFIRMADO" | "EN_ESPERA" | "CANCELADO" | "COMPLETADO";
  workOrderId: string | null;
  client: { id: string; nombre: string; telefono?: string };
  vehicle: { id: string; patente: string };
}

interface Client {
  id: string;
  nombre: string;
  vehicles: Array<{ id: string; patente: string; marca: string; modelo: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  EN_ESPERA: "En Espera",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_VARIANT: Record<string, "warning" | "info" | "neutral" | "danger" | "success"> = {
  PENDIENTE: "warning",
  CONFIRMADO: "info",
  EN_ESPERA: "neutral",
  CANCELADO: "danger",
  COMPLETADO: "success",
};

const STATUS_DOT: Record<string, string> = {
  PENDIENTE: "bg-amber-400",
  CONFIRMADO: "bg-sky-400",
  EN_ESPERA: "bg-carbon-400",
  CANCELADO: "bg-red-400",
  COMPLETADO: "bg-emerald-400",
};

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date;
}

export default function SchedulesPage() {
  const { showToast } = useToast();
  const [view, setView] = useState<"mes" | "semana">("mes");
  const [refDate, setRefDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(toDateStr(new Date()));
  const [showForm, setShowForm] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [formFecha, setFormFecha] = useState(toDateStr(new Date()));
  const [formHora, setFormHora] = useState("09:00");
  const [formMotivo, setFormMotivo] = useState("");

  const monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const monthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = new Date(startOfWeek(monthEnd));
  gridEnd.setDate(gridEnd.getDate() + 6);

  const weekStart = startOfWeek(refDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const loadSchedules = useCallback(async () => {
    try {
      const from = view === "mes" ? gridStart : weekStart;
      const to = view === "mes" ? gridEnd : weekEnd;
      const url = new URL("/api/schedules", window.location.origin);
      url.searchParams.set("from", toDateStr(from));
      url.searchParams.set("to", toDateStr(to));

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error("Error loading schedules:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, refDate]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch("/api/clients");
        if (response.ok) {
          const data = await response.json();
          setClients(data);
        }
      } catch (error) {
        console.error("Error loading clients:", error);
      }
    }
    loadClients();
  }, []);

  function buildMonthDays() {
    const days: Date[] = [];
    const cur = new Date(gridStart);
    while (cur <= gridEnd) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  function buildWeekDays() {
    const days: Date[] = [];
    const cur = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  const schedulesByDay: Record<string, Schedule[]> = {};
  for (const s of schedules) {
    const key = s.fecha.split("T")[0];
    if (!schedulesByDay[key]) schedulesByDay[key] = [];
    schedulesByDay[key].push(s);
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const todayStr = toDateStr(new Date());

  function openCreateForm(dateStr: string) {
    setFormFecha(dateStr);
    setSelectedClientId("");
    setSelectedVehicleId("");
    setFormHora("09:00");
    setFormMotivo("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          vehicleId: selectedVehicleId,
          fecha: formFecha,
          hora: formHora,
          motivo: formMotivo,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        showToast("Turno creado correctamente", "success");
        loadSchedules();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error creando turno", "error");
    }
  }

  async function confirmSchedule(s: Schedule) {
    try {
      const response = await fetch(`/api/schedules/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: s.client.id,
          vehicleId: s.vehicle.id,
          fecha: s.fecha.split("T")[0],
          hora: s.hora,
          motivo: s.motivo,
          status: "CONFIRMADO",
        }),
      });
      if (response.ok) {
        showToast("Turno confirmado", "success");
        loadSchedules();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error confirmando turno", "error");
    }
  }

  const monthLabel = refDate.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  const weekLabel = `${weekStart.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} - ${weekEnd.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`;

  function navigate(delta: number) {
    const d = new Date(refDate);
    if (view === "mes") d.setMonth(d.getMonth() + delta);
    else d.setDate(d.getDate() + delta * 7);
    setRefDate(d);
  }

  const daysToShow = view === "mes" ? buildMonthDays() : buildWeekDays();
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <AppShell>
      <PageHeader
        title="Agenda / Turnos"
        description="Calendario de turnos del taller"
        actions={
          <Button onClick={() => openCreateForm(selectedDay)}>
            <Plus className="h-4 w-4" /> Nuevo Turno
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo Turno">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedVehicleId("");
              }}
              required
            >
              <option value="">Seleccionar Cliente *</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.nombre}
                </option>
              ))}
            </Select>

            <Select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              required
              disabled={!selectedClientId}
            >
              <option value="">Seleccionar Vehículo *</option>
              {selectedClient?.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.patente} - {vehicle.marca} {vehicle.modelo}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} required />
            <Input type="time" value={formHora} onChange={(e) => setFormHora(e.target.value)} required />
          </div>

          <Input type="text" placeholder="Motivo *" value={formMotivo} onChange={(e) => setFormMotivo(e.target.value)} required />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear Turno</Button>
          </div>
        </form>
      </Modal>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-carbon-700 bg-carbon-900 p-1">
          <button
            onClick={() => setView("mes")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              view === "mes" ? "bg-brand-500 text-white" : "text-carbon-300 hover:text-white"
            )}
          >
            Mes
          </button>
          <button
            onClick={() => setView("semana")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              view === "semana" ? "bg-brand-500 text-white" : "text-carbon-300 hover:text-white"
            )}
          >
            Semana
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-md border border-carbon-600 p-1.5 text-carbon-300 hover:bg-carbon-800 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-carbon-100">
            {view === "mes" ? monthLabel : weekLabel}
          </span>
          <button onClick={() => navigate(1)} className="rounded-md border border-carbon-600 p-1.5 text-carbon-300 hover:bg-carbon-800 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-carbon-700">
        <div className="grid grid-cols-7 border-b border-carbon-700 bg-carbon-800/60">
          {dayLabels.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-carbon-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {daysToShow.map((day) => {
            const dateStr = toDateStr(day);
            const dayTurnos = schedulesByDay[dateStr] || [];
            const isCurrentMonth = day.getMonth() === refDate.getMonth();
            const isSelected = dateStr === selectedDay;
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(dateStr)}
                className={cn(
                  "min-h-[84px] border-b border-r border-carbon-700 p-1.5 text-left align-top transition-colors last:border-r-0",
                  isSelected ? "bg-brand-500/10 ring-1 ring-inset ring-brand-500/40" : "hover:bg-carbon-800/50",
                  !isCurrentMonth && view === "mes" && "bg-carbon-900/40 text-carbon-600"
                )}
              >
                <div className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                  isToday ? "bg-brand-500 text-white" : "text-carbon-300"
                )}>
                  {day.getDate()}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayTurnos.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center gap-1 truncate text-[10px] text-carbon-300">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[t.status])} />
                      {t.hora} {t.client.nombre}
                    </div>
                  ))}
                  {dayTurnos.length > 3 && (
                    <div className="text-[10px] text-carbon-500">+{dayTurnos.length - 3} más</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold text-white">
        Turnos del {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("es-AR")}
      </h2>

      {(schedulesByDay[selectedDay] || []).length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title="No hay turnos para este día" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Hora</Th>
              <Th>Cliente</Th>
              <Th>Vehículo</Th>
              <Th>Motivo</Th>
              <Th>Estado</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {(schedulesByDay[selectedDay] || []).map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">{s.hora}</Td>
                <Td>{s.client.nombre}</Td>
                <Td className="text-carbon-400">{s.vehicle.patente}</Td>
                <Td className="text-carbon-400">{s.motivo}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    {s.status === "PENDIENTE" && (
                      <>
                        <button
                          onClick={() => confirmSchedule(s)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="h-3.5 w-3.5" /> Confirmar
                        </button>
                        {buildWhatsAppLink(s.client.telefono, whatsAppConfirmTurno(s.client.nombre, new Date(`${s.fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR"), s.hora, s.motivo)) && (
                          <a
                            href={buildWhatsAppLink(s.client.telefono, whatsAppConfirmTurno(s.client.nombre, new Date(`${s.fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR"), s.hora, s.motivo))!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                      </>
                    )}
                    <Link href={`/schedules/${s.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300">
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Link>
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
