"use client";

import { formatCurrency } from "@/lib/utils";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, FileSearch, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { buildWhatsAppLink, whatsAppRecordatorioPago } from "@/lib/whatsapp";

interface UnpaidWorkOrder {
  id: string;
  fecha: string;
  status: string;
  total: number;
  pagado: number;
  pendiente: number;
  client: { id: string; nombre: string; telefono?: string };
  vehicle: { patente: string };
}

interface NegativeCredit {
  id: string;
  saldo: number;
  client: { id: string; nombre: string; telefono?: string };
}

export default function DebtsPage() {
  const [unpaidWorkOrders, setUnpaidWorkOrders] = useState<UnpaidWorkOrder[]>([]);
  const [negativeCredits, setNegativeCredits] = useState<NegativeCredit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch("/api/debts");
        if (response.ok) {
          const data = await response.json();
          setUnpaidWorkOrders(data.unpaidWorkOrders);
          setNegativeCredits(data.negativeCredits);
        }
      } catch (error) {
        console.error("Error loading debts:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AppShell>
      <PageHeader title="Deudas" description="Saldos pendientes de cobro y cuentas corrientes en rojo" />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes con Saldo Pendiente</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {unpaidWorkOrders.length === 0 ? (
                <EmptyState icon={CircleDollarSign} title="No hay órdenes con saldo pendiente" />
              ) : (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th>Vehículo</Th>
                      <Th>Total</Th>
                      <Th>Pagado</Th>
                      <Th>Pendiente</Th>
                      <Th className="text-right">Acciones</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {unpaidWorkOrders.map((wo) => (
                      <Tr key={wo.id}>
                        <Td className="font-medium">{wo.client.nombre}</Td>
                        <Td className="text-carbon-400">{wo.vehicle.patente}</Td>
                        <Td className="text-carbon-400">{formatCurrency(wo.total)}</Td>
                        <Td className="text-emerald-400">{formatCurrency(wo.pagado)}</Td>
                        <Td className="font-semibold text-red-400">{formatCurrency(wo.pendiente)}</Td>
                        <Td>
                          <div className="flex justify-end gap-3">
                            {buildWhatsAppLink(wo.client.telefono, whatsAppRecordatorioPago(wo.client.nombre, wo.pendiente, `orden #${wo.id.slice(-6)}`)) && (
                              <a
                                href={buildWhatsAppLink(wo.client.telefono, whatsAppRecordatorioPago(wo.client.nombre, wo.pendiente, `orden #${wo.id.slice(-6)}`))!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> Recordar
                              </a>
                            )}
                            <Link
                              href={`/work-orders/${wo.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                            >
                              <FileSearch className="h-3.5 w-3.5" /> Ver Orden
                            </Link>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clientes con Saldo Negativo (Cuenta Corriente)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {negativeCredits.length === 0 ? (
                <EmptyState icon={CircleDollarSign} title="No hay clientes con saldo negativo" />
              ) : (
                <Table>
                  <Thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th>Saldo</Th>
                      <Th className="text-right">Acciones</Th>
                    </tr>
                  </Thead>
                  <Tbody>
                    {negativeCredits.map((c) => (
                      <Tr key={c.id}>
                        <Td className="font-medium">{c.client.nombre}</Td>
                        <Td className="font-semibold text-red-400">{formatCurrency(c.saldo)}</Td>
                        <Td>
                          <div className="flex justify-end gap-3">
                            {buildWhatsAppLink(c.client.telefono, whatsAppRecordatorioPago(c.client.nombre, Math.abs(c.saldo), "cuenta corriente")) && (
                              <a
                                href={buildWhatsAppLink(c.client.telefono, whatsAppRecordatorioPago(c.client.nombre, Math.abs(c.saldo), "cuenta corriente"))!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> Recordar
                              </a>
                            )}
                            <Link
                              href={`/clients/${c.client.id}/credit`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                            >
                              <FileSearch className="h-3.5 w-3.5" /> Ver Cuenta Corriente
                            </Link>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
