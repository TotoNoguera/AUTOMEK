"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UnpaidWorkOrder {
  id: string;
  fecha: string;
  status: string;
  total: number;
  pagado: number;
  pendiente: number;
  client: { id: string; nombre: string };
  vehicle: { patente: string };
}

interface NegativeCredit {
  id: string;
  saldo: number;
  client: { id: string; nombre: string };
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

  if (loading) return <div className="text-center py-12">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Deudas</h1>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Órdenes con Saldo Pendiente</h2>
        {unpaidWorkOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow mb-8">
            No hay órdenes con saldo pendiente
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Cliente</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Vehículo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Total</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Pagado</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Pendiente</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {unpaidWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{wo.client.nombre}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{wo.vehicle.patente}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">${wo.total.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-green-700">${wo.pagado.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-red-700">${wo.pendiente.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:text-blue-800">
                        Ver Orden
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-4">Clientes con Saldo Negativo (Cuenta Corriente)</h2>
        {negativeCredits.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">
            No hay clientes con saldo negativo
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Cliente</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Saldo</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {negativeCredits.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{c.client.nombre}</td>
                    <td className="px-6 py-4 text-sm font-medium text-red-700">${c.saldo.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/clients/${c.client.id}/credit`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ver Cuenta Corriente
                      </Link>
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
