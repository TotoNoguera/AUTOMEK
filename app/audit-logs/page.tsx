"use client";

import { useEffect, useState } from "react";
import { downloadCsv } from "@/lib/csv";

interface AuditLog {
  id: string;
  accion: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  descripcion?: string;
  timestamp: string;
}

const ACCION_LABELS: Record<string, string> = {
  QUOTE_CREATED: "Presupuesto Creado",
  QUOTE_APPROVED: "Presupuesto Aprobado",
  QUOTE_REJECTED: "Presupuesto Rechazado",
  QUOTE_CONVERTED_TO_WORK_ORDER: "Presupuesto Convertido a Orden",
  WORK_ORDER_CREATED: "Orden Creada",
  WORK_ORDER_STATUS_CHANGED: "Estado de Orden Cambiado",
  WORK_ORDER_COMPLETED: "Orden Completada",
  WORK_ORDER_DELIVERED: "Orden Entregada",
  PAYMENT_RECORDED: "Pago Registrado",
  PAYMENT_ANNULLED: "Pago Anulado",
  PAYMENT_UPDATED: "Pago Actualizado",
  CASH_MOVEMENT_RECORDED: "Movimiento de Caja",
  DAILY_CLOSE_CLOSED: "Cierre de Caja",
  DAILY_CLOSE_REOPENED: "Reapertura de Caja",
  CLIENT_CREDIT_UPDATED: "Cuenta Corriente Actualizada",
  SCHEDULE_STATUS_CHANGED: "Estado de Turno Cambiado",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  async function loadLogs() {
    try {
      setLoading(true);
      const url = new URL("/api/audit-logs", window.location.origin);
      if (entityType) url.searchParams.set("entityType", entityType);
      const response = await fetch(url);
      if (response.ok) {
        setLogs(await response.json());
      }
    } catch (error) {
      console.error("Error loading audit logs:", error);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      `auditoria-${new Date().toISOString().split("T")[0]}.csv`,
      ["Fecha", "Acción", "Entidad", "ID Entidad", "Descripción"],
      logs.map((log) => [
        new Date(log.timestamp).toLocaleString("es-AR"),
        ACCION_LABELS[log.accion] || log.accion,
        log.entityType,
        log.entityId,
        log.descripcion || log.newValue || "",
      ])
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Auditoría</h1>

        <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:justify-between">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="border rounded-md px-4 py-2"
          >
            <option value="">Todas las entidades</option>
            <option value="QUOTE">Presupuestos</option>
            <option value="WORK_ORDER">Órdenes de Trabajo</option>
            <option value="PAYMENT">Pagos</option>
            <option value="CASH_MOVEMENT">Movimientos de Caja</option>
            <option value="DAILY_CLOSE">Cierres de Caja</option>
            <option value="CLIENT_CREDIT">Cuenta Corriente</option>
          </select>
          <button
            onClick={exportCsv}
            disabled={logs.length === 0}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            Exportar CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
            No hay registros de auditoría
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Fecha</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acción</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Entidad</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.timestamp).toLocaleString("es-AR")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {ACCION_LABELS[log.accion] || log.accion}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{log.entityType}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.descripcion || log.newValue || "-"}
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
