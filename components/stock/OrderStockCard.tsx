"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Undo2 } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { formatQuantity } from "@/lib/units";

interface Line {
  productId: string;
  nombre: string;
  unidad: string;
  stockActual: number;
  solicitado: number;
  consumido: number;
  devuelto: number;
  excedente: number;
}

interface Summary {
  estado: string;
  consumeStock: boolean;
  productos: Line[];
}

/**
 * Stock de los repuestos de una orden: lo pedido, lo descontado, lo devuelto y el excedente devolvible.
 * Reducir o quitar un ítem NO repone stock solo (el repuesto pudo usarse): lo recuperado físicamente se devuelve acá,
 * con cantidad y motivo, y queda auditado.
 */
export function OrderStockCard({ workOrderId, refreshKey }: { workOrderId: string; refreshKey: string }) {
  const { showToast } = useToast();
  const { submitting, guard } = useSubmitGuard();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [returning, setReturning] = useState<Line | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/stock`);
      if (response.ok) setSummary(await response.json());
    } catch (error) {
      console.error("Error loading order stock:", error);
    }
  }, [workOrderId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!summary || summary.productos.length === 0) return null;

  async function submitReturn() {
    if (!returning) return;
    try {
      const response = await fetch("/api/stock/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId, productId: returning.productId, cantidad: Number(cantidad.replace(",", ".")), motivo }),
      });
      if (response.ok) {
        showToast("Devolución registrada: el stock se actualizó", "success");
        setReturning(null);
        load();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch {
      showToast("Error registrando la devolución", "error");
    }
  }

  const hayExcedente = summary.productos.some((l) => l.excedente > 0);

  return (
    <Card className="no-print mb-8">
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-400" />
          <h3 className="font-semibold text-white">Stock de repuestos</h3>
        </div>
        <p className="mb-3 text-xs text-carbon-400">
          {summary.consumeStock
            ? "El stock de los productos ya se descontó al pasar la orden a En proceso. Si quitás o reducís un ítem, el stock no se repone solo: registrá la devolución cuando recuperes las unidades."
            : "El stock de estos productos se descontará al pasar la orden a En proceso."}
        </p>
        <Table>
          <Thead>
            <tr>
              <Th>Producto</Th>
              <Th className="text-right">Pedido</Th>
              <Th className="text-right">Descontado</Th>
              <Th className="text-right">Devuelto</Th>
              {hayExcedente && <Th className="text-right">Sobrante</Th>}
              {hayExcedente && <Th className="text-right">Acción</Th>}
            </tr>
          </Thead>
          <Tbody>
            {summary.productos.map((l) => (
              <Tr key={l.productId}>
                <Td className="font-medium">{l.nombre}</Td>
                <Td className="text-right text-carbon-300">{formatQuantity(l.solicitado, l.unidad)}</Td>
                <Td className="text-right text-carbon-300">{formatQuantity(l.consumido + l.devuelto, l.unidad)}</Td>
                <Td className="text-right text-carbon-300">{formatQuantity(l.devuelto, l.unidad)}</Td>
                {hayExcedente && <Td className={`text-right ${l.excedente > 0 ? "font-medium text-amber-400" : "text-carbon-500"}`}>{formatQuantity(l.excedente, l.unidad)}</Td>}
                {hayExcedente && (
                  <Td className="text-right">
                    {l.excedente > 0 && (
                      <button
                        onClick={() => { setReturning(l); setCantidad(String(l.excedente)); setMotivo(""); }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Devolver al stock
                      </button>
                    )}
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </CardContent>

      <Modal open={!!returning} onClose={() => setReturning(null)} title={returning ? `Devolver al stock · ${returning.nombre}` : undefined}>
        {returning && (
          <form onSubmit={guard(submitReturn)} className="space-y-4">
            <p className="text-xs text-carbon-400">
              Sobrante de la orden: <span className="font-medium text-carbon-100">{formatQuantity(returning.excedente, returning.unidad)}</span>. Registrá solo las unidades que recuperaste físicamente.
            </p>
            <div>
              <Label htmlFor="d-cant">Cantidad recuperada *</Label>
              <Input id="d-cant" type="number" min="0.001" max={returning.excedente} step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required autoFocus />
            </div>
            <div>
              <Label htmlFor="d-motivo">Motivo * (queda registrado)</Label>
              <Input id="d-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={3} maxLength={200} placeholder="Ej: El cliente no lo usó, envase cerrado" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setReturning(null)}>Cancelar</Button>
              <Button type="submit" loading={submitting}>Registrar devolución</Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
