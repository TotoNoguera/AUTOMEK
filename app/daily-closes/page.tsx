"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastProvider";

interface DailyClose {
  id: string;
  fecha: string;
  estado: "ABIERTO" | "CERRADO" | "REABIERTO";
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  notas?: string;
  closedAt?: string;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function DailyClosesPage() {
  const { showToast } = useToast();
  const [closes, setCloses] = useState<DailyClose[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(todayStr());
  const [notas, setNotas] = useState("");
  const [preview, setPreview] = useState<{ ingresos: number; egresos: number } | null>(null);

  useEffect(() => {
    loadCloses();
  }, []);

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  async function loadCloses() {
    try {
      setLoading(true);
      const response = await fetch("/api/daily-closes");
      if (response.ok) {
        setCloses(await response.json());
      }
    } catch (error) {
      console.error("Error loading daily closes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    try {
      const url = new URL("/api/cash-movements", window.location.origin);
      url.searchParams.set("from", fecha);
      url.searchParams.set("to", fecha);
      const response = await fetch(url);
      if (response.ok) {
        const movements = await response.json();
        const ingresos = movements
          .filter((m: { tipo: string }) => m.tipo === "INGRESO")
          .reduce((sum: number, m: { monto: number }) => sum + m.monto, 0);
        const egresos = movements
          .filter((m: { tipo: string }) => m.tipo === "EGRESO")
          .reduce((sum: number, m: { monto: number }) => sum + m.monto, 0);
        setPreview({ ingresos, egresos });
      }
    } catch (error) {
      console.error("Error loading preview:", error);
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`¿Cerrar la caja del día ${fecha}? Esta acción no se puede deshacer.`)) return;
    try {
      const response = await fetch("/api/daily-closes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, notas: notas || undefined }),
      });
      if (response.ok) {
        setNotas("");
        showToast("Caja cerrada correctamente", "success");
        loadCloses();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error cerrando caja", "error");
    }
  }

  const alreadyClosed = closes.some((c) => c.fecha.split("T")[0] === fecha);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="no-print flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cierre de Caja Diaria</h1>
          <button
            onClick={() => window.print()}
            className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            Imprimir / PDF
          </button>
        </div>

        <form onSubmit={handleClose} className="no-print bg-white p-6 rounded-lg shadow-md mb-8">
          <h3 className="font-medium text-gray-900 mb-4">Cerrar Caja</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border rounded px-3 py-2"
              required
            />
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>

          {preview && (
            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
              <div className="bg-green-50 p-3 rounded">
                <span className="text-gray-600">Ingresos del día:</span>
                <p className="font-bold text-green-700">${preview.ingresos.toFixed(2)}</p>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <span className="text-gray-600">Egresos del día:</span>
                <p className="font-bold text-red-700">${preview.egresos.toFixed(2)}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <span className="text-gray-600">Neto del día:</span>
                <p className="font-bold text-blue-700">
                  ${(preview.ingresos - preview.egresos).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={alreadyClosed}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {alreadyClosed ? "Este día ya fue cerrado" : "Cerrar Caja de este Día"}
          </button>
        </form>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Historial de Cierres</h2>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : closes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            No hay cierres registrados
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Saldo Inicial</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Ingresos</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Egresos</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Saldo Final</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Estado</th>
                </tr>
              </thead>
              <tbody>
                {closes.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(c.fecha).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">${c.saldoInicial.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-green-700">${c.totalIngresos.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-red-700">${c.totalEgresos.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">${c.saldoFinal.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {c.estado}
                      </span>
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
