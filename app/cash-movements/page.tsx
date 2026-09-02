"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Minus, Download, Wallet } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { downloadCsv } from "@/lib/csv";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

interface PaymentMethod {
  id: string;
  tipo: string;
  nombre: string;
}

interface WorkOrderOption {
  id: string;
  total: number;
  motivoIngreso: string;
  client: { nombre: string };
  vehicle: { patente: string };
  payments: Array<{ monto: number; status: string }>;
}

interface CashMovement {
  id: string;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  monto: number;
  descripcion?: string;
  fecha: string;
  workOrder?: { id: string; client: { nombre: string }; vehicle: { patente: string } } | null;
}

const CATEGORIA_LABELS: Record<string, string> = {
  PAGO_ORDEN: "Pago de Orden",
  ANTICIPO: "Anticipo",
  COMPRA_REPUESTOS: "Compra de Repuestos",
  COMPRA_MATERIALES: "Compra de Materiales",
  GASTO_SERVICIOS: "Gasto de Servicios",
  GASTO_MANTENIMIENTO: "Gasto de Mantenimiento",
  GASTO_SUELDOS: "Sueldos",
  GASTO_ALQUILER: "Alquiler",
  GASTO_SERVICIOS_UTILES: "Servicios (luz, agua, etc.)",
  GASTO_IMPUESTOS: "Impuestos",
  GASTO_OTROS: "Otros Gastos",
};

const EGRESO_CATEGORIAS = [
  "COMPRA_REPUESTOS",
  "COMPRA_MATERIALES",
  "GASTO_SERVICIOS",
  "GASTO_MANTENIMIENTO",
  "GASTO_SUELDOS",
  "GASTO_ALQUILER",
  "GASTO_SERVICIOS_UTILES",
  "GASTO_IMPUESTOS",
  "GASTO_OTROS",
];

export default function CashMovementsPage() {
  const { showToast } = useToast();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [tipoFilter, setTipoFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);

  const [ingresoWorkOrderId, setIngresoWorkOrderId] = useState("");
  const [ingresoMethodId, setIngresoMethodId] = useState("");
  const [ingresoMonto, setIngresoMonto] = useState("");
  const [ingresoDescripcion, setIngresoDescripcion] = useState("");

  const [egresoCategoria, setEgresoCategoria] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [egresoDescripcion, setEgresoDescripcion] = useState("");

  const loadMovements = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/cash-movements", window.location.origin);
      if (tipoFilter) url.searchParams.set("tipo", tipoFilter);
      const response = await fetch(url);
      if (response.ok) {
        setMovements(await response.json());
      }
    } catch (error) {
      console.error("Error loading movements:", error);
    } finally {
      setLoading(false);
    }
  }, [tipoFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    async function loadInitial() {
      try {
        const [methodsRes, workOrdersRes] = await Promise.all([
          fetch("/api/payment-methods"),
          fetch("/api/work-orders"),
        ]);
        if (methodsRes.ok) setMethods(await methodsRes.json());
        if (workOrdersRes.ok) setWorkOrders(await workOrdersRes.json());
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    }
    loadInitial();
  }, []);

  function pendienteDe(wo: WorkOrderOption) {
    const pagado = wo.payments
      .filter((p) => p.status === "PAGADO")
      .reduce((sum, p) => sum + p.monto, 0);
    return wo.total - pagado;
  }

  async function handleIngresoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-movements/ingreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrderId: ingresoWorkOrderId || undefined,
          methodId: ingresoMethodId,
          monto: Number(ingresoMonto),
          descripcion: ingresoDescripcion || undefined,
        }),
      });
      if (response.ok) {
        setIngresoWorkOrderId("");
        setIngresoMethodId("");
        setIngresoMonto("");
        setIngresoDescripcion("");
        setShowIngreso(false);
        showToast("Ingreso registrado correctamente", "success");
        loadMovements();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error registrando ingreso", "error");
    }
  }

  async function handleEgresoSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-movements/egreso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria: egresoCategoria,
          monto: Number(egresoMonto),
          descripcion: egresoDescripcion || undefined,
        }),
      });
      if (response.ok) {
        setEgresoCategoria("");
        setEgresoMonto("");
        setEgresoDescripcion("");
        setShowEgreso(false);
        showToast("Egreso registrado correctamente", "success");
        loadMovements();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error registrando egreso", "error");
    }
  }

  function exportCsv() {
    downloadCsv(
      `movimientos-caja-${new Date().toISOString().split("T")[0]}.csv`,
      ["Fecha", "Tipo", "Categoría", "Cliente", "Vehículo", "Descripción", "Monto"],
      movements.map((m) => [
        new Date(m.fecha).toLocaleDateString("es-AR"),
        m.tipo === "INGRESO" ? "Ingreso" : "Egreso",
        CATEGORIA_LABELS[m.categoria] || m.categoria,
        m.workOrder?.client.nombre || "",
        m.workOrder?.vehicle.patente || "",
        m.descripcion || "",
        m.monto.toFixed(2),
      ])
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Caja y Movimientos"
        description="Ingresos y egresos de tu taller"
        actions={
          <>
            <Button variant="success" onClick={() => { setShowIngreso(true); setShowEgreso(false); }}>
              <Plus className="h-4 w-4" /> Nuevo Ingreso
            </Button>
            <Button variant="danger" onClick={() => { setShowEgreso(true); setShowIngreso(false); }}>
              <Minus className="h-4 w-4" /> Nuevo Egreso
            </Button>
          </>
        }
      />

      <Modal open={showIngreso} onClose={() => setShowIngreso(false)} title="Registrar Ingreso">
        <form onSubmit={handleIngresoSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={ingresoWorkOrderId} onChange={(e) => setIngresoWorkOrderId(e.target.value)}>
              <option value="">Sin orden asociada (Anticipo)</option>
              {workOrders.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.client.nombre} - {wo.vehicle.patente} - Pendiente: ${pendienteDe(wo).toFixed(2)}
                </option>
              ))}
            </Select>
            <Select value={ingresoMethodId} onChange={(e) => setIngresoMethodId(e.target.value)} required>
              <option value="">Método de Pago *</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" placeholder="Monto *" min="0.01" step="0.01" value={ingresoMonto} onChange={(e) => setIngresoMonto(e.target.value)} required />
            <Input type="text" placeholder="Descripción" value={ingresoDescripcion} onChange={(e) => setIngresoDescripcion(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowIngreso(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success">Registrar Ingreso</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEgreso} onClose={() => setShowEgreso(false)} title="Registrar Egreso">
        <form onSubmit={handleEgresoSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select value={egresoCategoria} onChange={(e) => setEgresoCategoria(e.target.value)} required>
              <option value="">Categoría *</option>
              {EGRESO_CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABELS[c]}
                </option>
              ))}
            </Select>
            <Input type="number" placeholder="Monto *" min="0.01" step="0.01" value={egresoMonto} onChange={(e) => setEgresoMonto(e.target.value)} required />
          </div>
          <Input type="text" placeholder="Descripción" value={egresoDescripcion} onChange={(e) => setEgresoDescripcion(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEgreso(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger">Registrar Egreso</Button>
          </div>
        </form>
      </Modal>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="sm:max-w-xs">
          <option value="">Todos los movimientos</option>
          <option value="INGRESO">Solo Ingresos</option>
          <option value="EGRESO">Solo Egresos</option>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={movements.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <Card>
          <EmptyState icon={Wallet} title="No hay movimientos registrados" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Tipo</Th>
              <Th>Categoría</Th>
              <Th>Orden</Th>
              <Th>Descripción</Th>
              <Th>Monto</Th>
            </tr>
          </Thead>
          <Tbody>
            {movements.map((m) => (
              <Tr key={m.id}>
                <Td className="text-carbon-400">{new Date(m.fecha).toLocaleDateString("es-AR")}</Td>
                <Td>
                  <Badge variant={m.tipo === "INGRESO" ? "success" : "danger"}>{m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</Badge>
                </Td>
                <Td className="text-carbon-400">{CATEGORIA_LABELS[m.categoria] || m.categoria}</Td>
                <Td className="text-carbon-400">{m.workOrder ? `${m.workOrder.client.nombre} - ${m.workOrder.vehicle.patente}` : "-"}</Td>
                <Td className="text-carbon-400">{m.descripcion || "-"}</Td>
                <Td className={`font-semibold ${m.tipo === "INGRESO" ? "text-emerald-400" : "text-red-400"}`}>
                  {m.tipo === "INGRESO" ? "+" : "-"}${m.monto.toFixed(2)}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </AppShell>
  );
}
