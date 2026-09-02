"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastProvider";

interface Goal {
  id: string;
  tipo: "INGRESO_MENSUAL" | "ORDENES_MENSUALES" | "CLIENTES_NUEVOS";
  objetivo: number;
  alcanzado: number;
  mes: number;
  anio: number;
  estado: "EN_PROGRESO" | "ALCANZADO" | "NO_ALCANZADO" | "CANCELADO";
  notas?: string;
}

const TIPO_LABELS: Record<string, string> = {
  INGRESO_MENSUAL: "Ingreso Mensual",
  ORDENES_MENSUALES: "Órdenes Mensuales",
  CLIENTES_NUEVOS: "Clientes Nuevos",
};

const ESTADO_COLORS: Record<string, string> = {
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  ALCANZADO: "bg-green-100 text-green-800",
  NO_ALCANZADO: "bg-red-100 text-red-800",
  CANCELADO: "bg-gray-100 text-gray-800",
};

const ESTADO_LABELS: Record<string, string> = {
  EN_PROGRESO: "En Progreso",
  ALCANZADO: "Alcanzado",
  NO_ALCANZADO: "No Alcanzado",
  CANCELADO: "Cancelado",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function isMonto(tipo: string) {
  return tipo === "INGRESO_MENSUAL";
}

export default function GoalsPage() {
  const { showToast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const now = new Date();
  const [tipo, setTipo] = useState("INGRESO_MENSUAL");
  const [objetivo, setObjetivo] = useState("");
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [notas, setNotas] = useState("");

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      setLoading(true);
      const response = await fetch("/api/goals");
      if (response.ok) {
        setGoals(await response.json());
      }
    } catch (error) {
      console.error("Error loading goals:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          objetivo: Number(objetivo),
          mes: Number(mes),
          anio: Number(anio),
          notas: notas || undefined,
        }),
      });
      if (response.ok) {
        setObjetivo("");
        setNotas("");
        setShowForm(false);
        showToast("Meta creada correctamente", "success");
        loadGoals();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error creando meta", "error");
    }
  }

  async function cancelGoal(id: string) {
    if (!confirm("¿Cancelar esta meta?")) return;
    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "CANCELADO" }),
      });
      if (response.ok) {
        showToast("Meta cancelada", "success");
        loadGoals();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error cancelando meta", "error");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Objetivos y Metas</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nueva Meta"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="INGRESO_MENSUAL">Ingreso Mensual ($)</option>
                <option value="ORDENES_MENSUALES">Órdenes Mensuales (cantidad)</option>
                <option value="CLIENTES_NUEVOS">Clientes Nuevos (cantidad)</option>
              </select>
              <input
                type="number"
                placeholder="Objetivo *"
                min="0.01"
                step="0.01"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                className="border rounded px-3 py-2"
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Año"
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value))}
                className="border rounded px-3 py-2"
              />
            </div>
            <input
              type="text"
              placeholder="Notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
            />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              Crear Meta
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : goals.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No hay metas registradas
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((g) => {
              const pct = Math.min(100, (g.alcanzado / g.objetivo) * 100);
              return (
                <div key={g.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{TIPO_LABELS[g.tipo]}</h3>
                      <p className="text-sm text-gray-600">
                        {MESES[g.mes - 1]} {g.anio}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLORS[g.estado]}`}>
                      {ESTADO_LABELS[g.estado]}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 mb-1">
                    <span>
                      {isMonto(g.tipo) ? `$${g.alcanzado.toFixed(2)}` : g.alcanzado} de{" "}
                      {isMonto(g.tipo) ? `$${g.objetivo.toFixed(2)}` : g.objetivo}
                    </span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${g.estado === "ALCANZADO" ? "bg-green-600" : "bg-blue-600"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {g.notas && <p className="text-sm text-gray-500 mt-2">{g.notas}</p>}
                  {g.estado !== "CANCELADO" && (
                    <button
                      onClick={() => cancelGoal(g.id)}
                      className="mt-3 text-sm text-red-600 hover:text-red-800"
                    >
                      Cancelar meta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
