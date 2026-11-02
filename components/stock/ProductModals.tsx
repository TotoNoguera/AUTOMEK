"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/common/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSubmitGuard } from "@/lib/useSubmitGuard";
import { formatQuantity, PRODUCT_UNIT_OPTIONS } from "@/lib/units";

export interface ProductRow {
  id: string;
  nombre: string;
  sku?: string | null;
  categoria?: string | null;
  unidad: string;
  costo: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  margen: number;
  margenPorcentaje: number | null;
  stockBajo: boolean;
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: { error?: string } & Record<string, unknown> }> {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data: { error?: string } & Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    // sin cuerpo
  }
  return { ok: response.ok, data };
}

const num = (value: string) => (value.trim() === "" ? undefined : Number(value.replace(",", ".")));

// ---------------------------------------------------------------------------------------------------------------------
// Alta / edición de producto
// ---------------------------------------------------------------------------------------------------------------------

interface FormState {
  nombre: string;
  sku: string;
  categoria: string;
  unidad: string;
  costo: string;
  precioVenta: string;
  stockMinimo: string;
  stockInicial: string;
}

const emptyForm: FormState = { nombre: "", sku: "", categoria: "", unidad: "UNIDAD", costo: "0", precioVenta: "0", stockMinimo: "0", stockInicial: "" };

export function ProductFormModal({ open, onClose, product, onSaved }: { open: boolean; onClose: () => void; product: ProductRow | null; onSaved: () => void }) {
  const { submitting, guard } = useSubmitGuard();
  const { showToast } = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(
      product
        ? { nombre: product.nombre, sku: product.sku ?? "", categoria: product.categoria ?? "", unidad: product.unidad, costo: String(product.costo), precioVenta: String(product.precioVenta), stockMinimo: String(product.stockMinimo), stockInicial: "" }
        : emptyForm
    );
  }, [open, product]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const margen = (num(form.precioVenta) ?? 0) - (num(form.costo) ?? 0);

  async function submit() {
    const body = {
      nombre: form.nombre,
      sku: form.sku || undefined,
      categoria: form.categoria || undefined,
      unidad: form.unidad,
      costo: num(form.costo) ?? 0,
      precioVenta: num(form.precioVenta) ?? 0,
      stockMinimo: num(form.stockMinimo) ?? 0,
      ...(product ? { activo: product.activo } : { stockInicial: num(form.stockInicial) }),
    };
    try {
      const { ok, data } = await send(product ? `/api/products/${product.id}` : "/api/products", product ? "PUT" : "POST", body);
      if (!ok) return showToast(`Error: ${data.error}`, "error");
      showToast(product ? "Producto actualizado correctamente" : "Producto creado correctamente", "success");
      onSaved();
      onClose();
    } catch {
      showToast("Error guardando el producto", "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={product ? "Editar producto" : "Nuevo producto"} className="max-w-xl">
      <form onSubmit={guard(submit)} className="space-y-4">
        <div>
          <Label htmlFor="p-nombre">Nombre *</Label>
          <Input id="p-nombre" value={form.nombre} onChange={set("nombre")} required maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="p-sku">Código / SKU</Label>
            <Input id="p-sku" value={form.sku} onChange={set("sku")} maxLength={40} placeholder="Opcional, único en tu taller" />
          </div>
          <div>
            <Label htmlFor="p-cat">Categoría</Label>
            <Input id="p-cat" value={form.categoria} onChange={set("categoria")} maxLength={60} placeholder="Ej: Lubricantes" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="p-unidad">Unidad</Label>
            <Select id="p-unidad" value={form.unidad} onChange={set("unidad")}>
              {PRODUCT_UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-costo">Costo ($)</Label>
            <Input id="p-costo" type="number" min="0" step="0.01" value={form.costo} onChange={set("costo")} required />
          </div>
          <div>
            <Label htmlFor="p-precio">Precio de venta ($)</Label>
            <Input id="p-precio" type="number" min="0" step="0.01" value={form.precioVenta} onChange={set("precioVenta")} required />
          </div>
          <div>
            <Label htmlFor="p-min">Stock mínimo</Label>
            <Input id="p-min" type="number" min="0" step="0.001" value={form.stockMinimo} onChange={set("stockMinimo")} required />
          </div>
        </div>
        <p className="text-xs text-carbon-400">
          Margen: <span className={margen >= 0 ? "text-emerald-400" : "text-red-400"}>${margen.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> por unidad.
          {product && " La unidad no se puede cambiar si el producto ya tiene movimientos de stock."}
        </p>
        {!product && (
          <div>
            <Label htmlFor="p-inicial">Stock inicial (opcional)</Label>
            <Input id="p-inicial" type="number" min="0" step="0.001" value={form.stockInicial} onChange={set("stockInicial")} placeholder="Se registra como una entrada de stock" />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>{product ? "Guardar cambios" : "Crear producto"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Carga de compra (entrada)
// ---------------------------------------------------------------------------------------------------------------------

export function PurchaseModal({ open, onClose, product, onDone }: { open: boolean; onClose: () => void; product: ProductRow | null; onDone: () => void }) {
  const { submitting, guard } = useSubmitGuard();
  const { showToast } = useToast();
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open && product) {
      setCantidad("");
      setCosto(String(product.costo));
      setMotivo("");
    }
  }, [open, product]);

  if (!product) return null;
  const cant = num(cantidad) ?? 0;

  async function submit() {
    try {
      const { ok, data } = await send("/api/stock/purchase", "POST", { productId: product!.id, cantidad: cant, costoUnitario: num(costo), motivo: motivo || undefined });
      if (!ok) return showToast(`Error: ${data.error}`, "error");
      showToast("Compra registrada: el stock se actualizó", "success");
      onDone();
      onClose();
    } catch {
      showToast("Error registrando la compra", "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Cargar compra · ${product.nombre}`}>
      <form onSubmit={guard(submit)} className="space-y-4">
        <p className="text-xs text-carbon-400">Stock actual: <span className="font-medium text-carbon-100">{formatQuantity(product.stockActual, product.unidad)}</span></p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="c-cant">Cantidad comprada *</Label>
            <Input id="c-cant" type="number" min="0.001" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="c-costo">Costo unitario ($)</Label>
            <Input id="c-costo" type="number" min="0" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="c-motivo">Detalle (opcional)</Label>
          <Input id="c-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej: Factura 0001-1234 del proveedor" />
        </div>
        {cant > 0 && <p className="text-xs text-carbon-400">Stock resultante: <span className="text-emerald-400">{formatQuantity(product.stockActual + cant, product.unidad)}</span>. El costo del producto pasa a ser el de esta compra.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Registrar compra</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Ajuste manual (con motivo)
// ---------------------------------------------------------------------------------------------------------------------

export function AdjustModal({ open, onClose, product, onDone }: { open: boolean; onClose: () => void; product: ProductRow | null; onDone: () => void }) {
  const { submitting, guard } = useSubmitGuard();
  const { showToast } = useToast();
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) {
      setCantidad("");
      setMotivo("");
    }
  }, [open, product]);

  if (!product) return null;
  const delta = num(cantidad) ?? 0;

  async function submit() {
    try {
      const { ok, data } = await send("/api/stock/adjust", "POST", { productId: product!.id, cantidad: delta, motivo });
      if (!ok) return showToast(`Error: ${data.error}`, "error");
      showToast("Ajuste registrado", "success");
      onDone();
      onClose();
    } catch {
      showToast("Error registrando el ajuste", "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Ajustar stock · ${product.nombre}`}>
      <form onSubmit={guard(submit)} className="space-y-4">
        <p className="text-xs text-carbon-400">Stock actual: <span className="font-medium text-carbon-100">{formatQuantity(product.stockActual, product.unidad)}</span></p>
        <div>
          <Label htmlFor="a-cant">Cantidad del ajuste (con signo) *</Label>
          <Input id="a-cant" type="number" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required autoFocus placeholder="Ej: -2 para restar 2, 3,5 para sumar 3,5" />
        </div>
        <div>
          <Label htmlFor="a-motivo">Motivo * (queda registrado)</Label>
          <Input id="a-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={3} maxLength={200} placeholder="Ej: Conteo físico, rotura, derrame" />
        </div>
        {delta !== 0 && (
          <p className={`text-xs ${product.stockActual + delta < 0 ? "text-amber-400" : "text-carbon-400"}`}>
            Stock resultante: {formatQuantity(product.stockActual + delta, product.unidad)}
            {product.stockActual + delta < 0 && " — no se permite dejar el stock en negativo salvo que el taller lo habilite."}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Registrar ajuste</Button>
        </div>
      </form>
    </Modal>
  );
}
