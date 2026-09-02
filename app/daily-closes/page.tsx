"use client";

import { useEffect, useState } from "react";
import { Printer, Lock, History } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/common/StatCard";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";

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
    <AppShell>
      <PageHeader
        className="no-print"
        title="Cierre de Caja Diaria"
        description="Cerrá la caja del día y consultá el historial"
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        }
      />

      <Card className="no-print mb-8">
        <CardContent>
          <h3 className="mb-4 font-semibold text-white">Cerrar Caja</h3>
          <form onSubmit={handleClose} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              <Input type="text" placeholder="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>

            {preview && (
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Ingresos del día" value={`$${preview.ingresos.toFixed(2)}`} tone="success" />
                <StatCard label="Egresos del día" value={`$${preview.egresos.toFixed(2)}`} tone="danger" />
                <StatCard
                  label="Neto del día"
                  value={`$${(preview.ingresos - preview.egresos).toFixed(2)}`}
                  tone={preview.ingresos - preview.egresos >= 0 ? "brand" : "warning"}
                />
              </div>
            )}

            <Button type="submit" disabled={alreadyClosed}>
              <Lock className="h-4 w-4" /> {alreadyClosed ? "Este día ya fue cerrado" : "Cerrar Caja de este Día"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-4 text-lg font-semibold text-white">Historial de Cierres</h2>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : closes.length === 0 ? (
        <Card>
          <EmptyState icon={History} title="No hay cierres registrados" />
        </Card>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Saldo Inicial</Th>
              <Th>Ingresos</Th>
              <Th>Egresos</Th>
              <Th>Saldo Final</Th>
              <Th>Estado</Th>
            </tr>
          </Thead>
          <Tbody>
            {closes.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium">{new Date(c.fecha).toLocaleDateString("es-AR")}</Td>
                <Td className="text-carbon-400">${c.saldoInicial.toFixed(2)}</Td>
                <Td className="text-emerald-400">${c.totalIngresos.toFixed(2)}</Td>
                <Td className="text-red-400">${c.totalEgresos.toFixed(2)}</Td>
                <Td className="font-semibold">${c.saldoFinal.toFixed(2)}</Td>
                <Td>
                  <Badge variant="neutral">{c.estado}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </AppShell>
  );
}
