"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/common/ToastProvider";

interface Schedule {
  id: string;
  fecha: string;
  hora: string;
  motivo: string;
  status: "PENDIENTE" | "CONFIRMADO" | "EN_ESPERA" | "CANCELADO" | "COMPLETADO";
  workOrderId: string | null;
  client: { id: string; nombre: string };
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

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EN_ESPERA: "bg-orange-100 text-orange-800",
  CANCELADO: "bg-red-100 text-red-800",
  COMPLETADO: "bg-green-100 text-green-800",
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agenda / Turnos</h1>
          <button
            onClick={() => openCreateForm(selectedDay)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Turno"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-lg shadow-md mb-8"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedVehicleId("");
                }}
                className="border rounded px-3 py-2"
                required
              >
                <option value="">Seleccionar Cliente *</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombre}
                  </option>
                ))}
              </select>

              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="border rounded px-3 py-2"
                required
                disabled={!selectedClientId}
              >
                <option value="">Seleccionar Vehículo *</option>
                {selectedClient?.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.patente} - {vehicle.marca} {vehicle.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="time"
                value={formHora}
                onChange={(e) => setFormHora(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </div>

            <input
              type="text"
              placeholder="Motivo *"
              value={formMotivo}
              onChange={(e) => setFormMotivo(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              required
            />

            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Crear Turno
            </button>
          </form>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView("mes")}
              className={`px-3 py-1 rounded text-sm ${view === "mes" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
            >
              Mes
            </button>
            <button
              onClick={() => setView("semana")}
              className={`px-3 py-1 rounded text-sm ${view === "semana" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
            >
              Semana
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="px-2 py-1 border rounded">
              ←
            </button>
            <span className="font-medium text-gray-900 capitalize">
              {view === "mes" ? monthLabel : weekLabel}
            </span>
            <button onClick={() => navigate(1)} className="px-2 py-1 border rounded">
              →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="grid grid-cols-7 bg-gray-100 border-b">
            {dayLabels.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-600">
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
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr)}
                  className={`min-h-[80px] border-b border-r p-1 text-left align-top ${isSelected ? "bg-blue-50" : ""} ${!isCurrentMonth && view === "mes" ? "bg-gray-50 text-gray-400" : ""}`}
                >
                  <div className="text-xs font-medium">{day.getDate()}</div>
                  {dayTurnos.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      className={`text-[10px] rounded px-1 mt-1 truncate ${STATUS_COLORS[t.status]}`}
                    >
                      {t.hora} {t.client.nombre}
                    </div>
                  ))}
                  {dayTurnos.length > 3 && (
                    <div className="text-[10px] text-gray-500">+{dayTurnos.length - 3} más</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Turnos del {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("es-AR")}
        </h2>

        {(schedulesByDay[selectedDay] || []).length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            No hay turnos para este día
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Hora</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Cliente</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Vehículo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Motivo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Estado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(schedulesByDay[selectedDay] || []).map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{s.hora}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{s.client.nombre}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{s.vehicle.patente}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{s.motivo}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/schedules/${s.id}`} className="text-blue-600 hover:text-blue-800">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
