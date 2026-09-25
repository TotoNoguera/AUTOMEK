"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/common/ToastProvider";

export interface QuickVehicle {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje?: number;
}

const currentYear = new Date().getFullYear();

/**
 * Alta rápida de vehículo para un cliente ya seleccionado, sin salir del
 * formulario en curso (Nuevo Turno / Nueva Orden). No pisa ni reinicia
 * ningún otro campo del formulario padre.
 */
export function QuickAddVehicle({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: (vehicle: QuickVehicle) => void;
}) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const [form, setForm] = useState({ patente: "", marca: "", modelo: "", anio: String(currentYear), kilometraje: "" });

  function reset() {
    setForm({ patente: "", marca: "", modelo: "", anio: String(currentYear), kilometraje: "" });
    setExpanded(false);
  }

  async function handleCreate() {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          patente: form.patente.toUpperCase(),
          marca: form.marca,
          modelo: form.modelo,
          anio: Number(form.anio) || currentYear,
          kilometraje: form.kilometraje ? Number(form.kilometraje) : undefined,
        }),
      });
      if (response.ok) {
        const vehicle = await response.json();
        showToast("Vehículo creado correctamente", "success");
        onCreated(vehicle);
        reset();
      } else {
        const error = await response.json();
        showToast(`Error: ${error.error}`, "error");
      }
    } catch (error) {
      showToast("Error creando vehículo", "error");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
      >
        <Plus className="h-3.5 w-3.5" /> Crear vehículo para este cliente
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-carbon-700 bg-carbon-900/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-carbon-200">Nuevo vehículo</p>
        <button type="button" onClick={reset} className="text-carbon-400 hover:text-white" aria-label="Cancelar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="qa-patente">Patente *</Label>
          <Input
            id="qa-patente"
            type="text"
            value={form.patente}
            onChange={(e) => setForm({ ...form, patente: e.target.value })}
            className="uppercase"
            required
          />
        </div>
        <div>
          <Label htmlFor="qa-anio">Año *</Label>
          <Input
            id="qa-anio"
            type="number"
            value={form.anio}
            onChange={(e) => setForm({ ...form, anio: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="qa-marca">Marca *</Label>
          <Input id="qa-marca" type="text" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="qa-modelo">Modelo *</Label>
          <Input id="qa-modelo" type="text" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} required />
        </div>
      </div>
      <div>
        <Label htmlFor="qa-km">Kilometraje</Label>
        <Input id="qa-km" type="number" value={form.kilometraje} onChange={(e) => setForm({ ...form, kilometraje: e.target.value })} />
      </div>
      <Button type="button" size="sm" loading={submitting} onClick={handleCreate}>
        Crear y usar
      </Button>
    </div>
  );
}
