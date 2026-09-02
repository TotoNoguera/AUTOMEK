"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/components/common/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/EmptyState";

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

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : !client || !credit ? (
          <p className="text-sm text-carbon-400">Cliente no encontrado</p>
        ) : (
          <>
            <Link href={`/clients/${clientId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300">
              <ArrowLeft className="h-4 w-4" /> Volver a {client.nombre}
            </Link>

            <Card className="mb-8">
              <CardContent>
                <h1 className="mb-4 text-xl font-bold text-white">Cuenta Corriente — {client.nombre}</h1>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-carbon-400">Saldo actual</span>
                    <p className={`text-2xl font-bold ${credit.saldo < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      ${credit.saldo.toFixed(2)}
                    </p>
                    <p className="text-xs text-carbon-500">
                      {credit.saldo < 0 ? "El cliente debe este monto" : "Saldo a favor del cliente"}
                    </p>
                  </div>
                  {credit.creditLimit != null && (
                    <div>
                      <span className="text-xs text-carbon-400">Límite de crédito</span>
                      <p className="text-lg text-carbon-100">${credit.creditLimit.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="mb-4 font-semibold text-white">Registrar Pago</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Monto *"
                      min="0.01"
                      step="0.01"
                      value={monto}
                      onChange={(e) => setMonto(e.target.value)}
                      required
                    />
                    <Input
                      type="text"
                      placeholder="Observaciones"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="success">Registrar Pago</Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
