"use client";

import { useEffect, useState } from "react";
import { Plus, Target, X } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

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

const ESTADO_VARIANT: Record<string, "info" | "success" | "danger" | "neutral"> = {
  EN_PROGRESO: "info",
  ALCANZADO: "success",
  NO_ALCANZADO: "danger",
  CANCELADO: "neutral",
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
    <AppShell>
      <PageHeader
        title="Objetivos y Metas"
        description="Definí metas mensuales y seguí el progreso real"
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Nueva Meta
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nueva Meta">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="INGRESO_MENSUAL">Ingreso Mensual ($)</option>
              <option value="ORDENES_MENSUALES">Órdenes Mensuales (cantidad)</option>
              <option value="CLIENTES_NUEVOS">Clientes Nuevos (cantidad)</option>
            </Select>
            <Input
              type="number"
              placeholder="Objetivo *"
              min="0.01"
              step="0.01"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
            <Input type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(parseInt(e.target.value))} />
          </div>
          <Input type="text" placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear Meta</Button>
          </div>
        </form>
      </Modal>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <EmptyState icon={Target} title="No hay metas registradas" />
        </Card>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const pct = Math.min(100, (g.alcanzado / g.objetivo) * 100);
            return (
              <Card key={g.id}>
                <CardContent>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{TIPO_LABELS[g.tipo]}</h3>
                      <p className="text-sm text-carbon-400">
                        {MESES[g.mes - 1]} {g.anio}
                      </p>
                    </div>
                    <Badge variant={ESTADO_VARIANT[g.estado]}>{ESTADO_LABELS[g.estado]}</Badge>
                  </div>
                  <div className="mb-1.5 flex justify-between text-sm text-carbon-300">
                    <span>
                      {isMonto(g.tipo) ? `$${g.alcanzado.toFixed(2)}` : g.alcanzado} de{" "}
                      {isMonto(g.tipo) ? `$${g.objetivo.toFixed(2)}` : g.objetivo}
                    </span>
                    <span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-carbon-700">
                    <div
                      className={`h-2.5 rounded-full transition-all ${g.estado === "ALCANZADO" ? "bg-emerald-500" : "bg-brand-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {g.notas && <p className="mt-2 text-sm text-carbon-400">{g.notas}</p>}
                  {g.estado !== "CANCELADO" && (
                    <button
                      onClick={() => cancelGoal(g.id)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar meta
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
