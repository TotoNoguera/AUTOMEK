"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useToast } from "@/components/common/ToastProvider";

interface ClientCredit {
  id: string;
  saldo: number;
  creditLimit?: number;
  updatedAt: string;
}

interface Client {
  id: string;
  nombre: string;
}

export default function ClientCreditPage() {
  const params = useParams();
  const { showToast } = useToast();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [credit, setCredit] = useState<ClientCredit | null>(null);
  const [loading, setLoading] = useState(true);
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    load();
  }, [clientId]);

  async function load() {
    try {
      setLoading(true);
      const [clientRes, creditRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/credit`),
      ]);
      if (clientRes.ok) setClient(await clientRes.json());
      if (creditRes.ok) setCredit(await creditRes.json());
    } catch (error) {
      console.error("Error loading client credit:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch(`/api/clients/${clientId}/credit/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: Number(monto),
          observaciones: observaciones || undefined,
        }),
      });
      if (response.ok) {
        setMonto("");
        setObservaciones("");
        showToast("Pago registrado correctamente", "success");
        load();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error registrando pago", "error");
    }
  }

  if (loading) return <div className="text-center py-12">Cargando...</div>;
  if (!client || !credit) return <div className="text-center py-12">Cliente no encontrado</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Link href={`/clients/${clientId}`} className="text-blue-600 hover:text-blue-800 mb-6 inline-block">
          ← Volver a {client.nombre}
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Cuenta Corriente — {client.nombre}
          </h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600 text-sm">Saldo actual:</span>
              <p className={`text-2xl font-bold ${credit.saldo < 0 ? "text-red-700" : "text-green-700"}`}>
                ${credit.saldo.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                {credit.saldo < 0 ? "El cliente debe este monto" : "Saldo a favor del cliente"}
              </p>
            </div>
            {credit.creditLimit != null && (
              <div>
                <span className="text-gray-600 text-sm">Límite de crédito:</span>
                <p className="text-lg text-gray-900">${credit.creditLimit.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-medium text-gray-900 mb-4">Registrar Pago</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
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
            <input
              type="text"
              placeholder="Observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            Registrar Pago
          </button>
        </form>
      </div>
    </div>
  );
}
