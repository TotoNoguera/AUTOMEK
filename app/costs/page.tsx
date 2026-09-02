"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastProvider";

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
  const now = new Date();
  return { mes: now.getMonth() + 1, anio: now.getFullYear() };
}

export default function CostsPage() {
  const { showToast } = useToast();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { mes: defaultMes, anio: defaultAnio } = todayMesAnio();
  const [mesFilter, setMesFilter] = useState(defaultMes);
  const [anioFilter, setAnioFilter] = useState(defaultAnio);

  const [tipo, setTipo] = useState<"FIJO" | "VARIABLE">("VARIABLE");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [mes, setMes] = useState(defaultMes);
  const [anio, setAnio] = useState(defaultAnio);

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
    setAnio(defaultAnio);
    setEditingId(null);
  }

  function editCost(c: Cost) {
    setEditingId(c.id);
    setTipo(c.tipo);
    setCategoria(c.categoria);
    setDescripcion(c.descripcion);
    setMonto(String(c.monto));
    setMes(c.mes);
    setAnio(c.anio);
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
          anio: Number(anio),
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Costos</h1>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "+ Nuevo Costo"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "FIJO" | "VARIABLE")}
                className="border rounded px-3 py-2"
              >
                <option value="FIJO">Fijo</option>
                <option value="VARIABLE">Variable</option>
              </select>
              <input
                type="text"
                list="categorias-sugeridas"
                placeholder="Categoría *"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <datalist id="categorias-sugeridas">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <input
              type="text"
              placeholder="Descripción *"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <input
                type="number"
                placeholder="Monto *"
                min="0.01"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
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
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
              {editingId ? "Actualizar Costo" : "Registrar Costo"}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <select
            value={mesFilter}
            onChange={(e) => setMesFilter(parseInt(e.target.value))}
            className="border rounded-md px-4 py-2"
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={anioFilter}
            onChange={(e) => setAnioFilter(parseInt(e.target.value))}
            className="border rounded-md px-4 py-2"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Costos Fijos del período</p>
            <p className="text-xl font-bold text-gray-900">${totalFijos.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Costos Variables del período</p>
            <p className="text-xl font-bold text-gray-900">${totalVariables.toFixed(2)}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : costs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No hay costos registrados para este período
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Tipo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Categoría</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Descripción</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Monto</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${c.tipo === "FIJO" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}
                      >
                        {c.tipo === "FIJO" ? "Fijo" : "Variable"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.categoria}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{c.descripcion}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${c.monto.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button onClick={() => editCost(c)} className="text-blue-600 hover:text-blue-800">
                        Editar
                      </button>
                      <button onClick={() => deleteCost(c.id)} className="text-red-600 hover:text-red-800">
                        Eliminar
                      </button>
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
