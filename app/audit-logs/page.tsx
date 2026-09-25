"use client";

import { useEffect, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { formatDateTimeAR, todayAR } from "@/lib/dates";

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
      `auditoria-${todayAR()}.csv`,
      ["Fecha", "Acción", "Entidad", "ID Entidad", "Descripción"],
      logs.map((log) => [
        formatDateTimeAR(log.timestamp),
        ACCION_LABELS[log.accion] || log.accion,
        log.entityType,
        log.entityId,
        log.descripcion || log.newValue || "",
      ])
    );
  }

  return (
    <AppShell>
      <PageHeader title="Auditoría" description="Historial de cambios sensibles del sistema" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="sm:max-w-xs">
          <option value="">Todas las entidades</option>
          <option value="QUOTE">Presupuestos</option>
          <option value="WORK_ORDER">Órdenes de Trabajo</option>
          <option value="PAYMENT">Pagos</option>
          <option value="CASH_MOVEMENT">Movimientos de Caja</option>
          <option value="DAILY_CLOSE">Cierres de Caja</option>
          <option value="CLIENT_CREDIT">Cuenta Corriente</option>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={logs.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="No hay registros de auditoría" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Acción</Th>
              <Th>Entidad</Th>
              <Th>Descripción</Th>
            </tr>
          </Thead>
          <Tbody>
            {logs.map((log) => (
              <Tr key={log.id}>
                <Td className="whitespace-nowrap text-carbon-400">{formatDateTimeAR(log.timestamp)}</Td>
                <Td className="font-medium">{ACCION_LABELS[log.accion] || log.accion}</Td>
                <Td className="text-carbon-400">{log.entityType}</Td>
                <Td className="text-carbon-400">{log.descripcion || log.newValue || "-"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </AppShell>
  );
}
