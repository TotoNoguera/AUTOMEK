"use client";

import { formatCurrency } from "@/lib/utils";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { yearMonthAR } from "@/lib/dates";
import { useEffect, useState } from "react";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/common/StatCard";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

interface Cost {
  id: string;
  tipo: "FIJO" | "VARIABLE";
  categoria: string;
  descripcion: string;
  monto: number;
  mes: number;
  anio: number;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CATEGORIAS_SUGERIDAS = [
  "Materia Prima",
  "Mano de Obra",
  "Servicios",
  "Alquiler",
  "Impuestos",
  "Seguros",
  "Mantenimiento de Equipos",
  "Otros",
];

function todayMesAnio() {
  const now = yearMonthAR();
  return { mes: now.month, anio: now.year };
}

export default function CostsPage() {
  const { submitting, guard } = useSubmitGuard();
  const { showToast } = useToast();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { mes: defaultMes, anio: defaultAnio } = todayMesAnio();
  const [mesFilter, setMesFilter] = useState(defaultMes);
  const [anioFilter, setAnioFilter] = useState(String(defaultAnio));

  const [tipo, setTipo] = useState<"FIJO" | "VARIABLE">("VARIABLE");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [mes, setMes] = useState(defaultMes);
  const [anio, setAnio] = useState(String(defaultAnio));

  useEffect(() => {
    loadCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesFilter, anioFilter]);

  async function loadCosts() {
    try {
      setLoading(true);
      const url = new URL("/api/costs", window.location.origin);
      url.searchParams.set("mes", String(mesFilter));
      url.searchParams.set("anio", String(anioFilter));
      const response = await fetch(url);
      if (response.ok) {
        setCosts(await response.json());
      }
    } catch (error) {
      console.error("Error loading costs:", error);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTipo("VARIABLE");
    setCategoria("");
    setDescripcion("");
    setMonto("");
    setMes(defaultMes);
    setAnio(String(defaultAnio));
    setEditingId(null);
  }

  function editCost(c: Cost) {
    setEditingId(c.id);
    setTipo(c.tipo);
    setCategoria(c.categoria);
    setDescripcion(c.descripcion);
    setMonto(String(c.monto));
    setMes(c.mes);
    setAnio(String(c.anio));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? `/api/costs/${editingId}` : "/api/costs";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          categoria,
          descripcion,
          monto: Number(monto),
          mes: Number(mes),
          anio: Number(anio) || defaultAnio,
        }),
      });
      if (response.ok) {
        resetForm();
        setShowForm(false);
        showToast(editingId ? "Costo actualizado correctamente" : "Costo registrado correctamente", "success");
        loadCosts();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error guardando costo", "error");
    }
  }

  async function deleteCost(id: string) {
    if (!confirm("¿Eliminar este costo?")) return;
    try {
      const response = await fetch(`/api/costs/${id}`, { method: "DELETE" });
      if (response.ok) {
        showToast("Costo eliminado", "success");
        loadCosts();
      } else {
        showToast("Error eliminando costo", "error");
      }
    } catch (error) {
      showToast("Error eliminando costo", "error");
    }
  }

  const totalFijos = costs.filter((c) => c.tipo === "FIJO").reduce((s, c) => s + c.monto, 0);
  const totalVariables = costs.filter((c) => c.tipo === "VARIABLE").reduce((s, c) => s + c.monto, 0);

  return (
    <AppShell>
      <PageHeader
        title="Costos"
        description="Costos fijos y variables por período"
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nuevo Costo
          </Button>
        }
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Editar Costo" : "Nuevo Costo"}>
        <form onSubmit={guard(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as "FIJO" | "VARIABLE")}>
              <option value="FIJO">Fijo</option>
              <option value="VARIABLE">Variable</option>
            </Select>
            <div>
              <Input
                type="text"
                list="categorias-sugeridas"
                placeholder="Categoría *"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                required
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <Input type="text" placeholder="Descripción *" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input type="number" placeholder="Monto *" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required />
            <Select value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
            <Input type="number" placeholder="Año" value={anio} onChange={(e) => setAnio(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>{editingId ? "Actualizar Costo" : "Registrar Costo"}</Button>
          </div>
        </form>
      </Modal>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select value={mesFilter} onChange={(e) => setMesFilter(parseInt(e.target.value))}>
          {MESES.map((m, i) => (
            <option key={i + 1} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Input type="number" value={anioFilter} onChange={(e) => setAnioFilter(e.target.value)} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Costos Fijos del período" value={formatCurrency(totalFijos)} tone="brand" />
        <StatCard label="Costos Variables del período" value={formatCurrency(totalVariables)} tone="warning" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : costs.length === 0 ? (
        <Card>
          <EmptyState icon={Receipt} title="No hay costos registrados para este período" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Tipo</Th>
              <Th>Categoría</Th>
              <Th>Descripción</Th>
              <Th>Monto</Th>
              <Th className="text-right">Acciones</Th>
            </tr>
          </Thead>
          <Tbody>
            {costs.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Badge variant={c.tipo === "FIJO" ? "brand" : "info"}>{c.tipo === "FIJO" ? "Fijo" : "Variable"}</Badge>
                </Td>
                <Td className="text-carbon-400">{c.categoria}</Td>
                <Td className="text-carbon-400">{c.descripcion}</Td>
                <Td className="font-medium">{formatCurrency(c.monto)}</Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => editCost(c)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button onClick={() => deleteCost(c.id)} className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300">
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
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
