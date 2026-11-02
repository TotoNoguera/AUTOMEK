import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { isStockShortageError, normalizeSku, orderStockBalance, planOrderStockMovements, shortageMessage, sumByProduct } from "./stock-plan";
import { ProductSchema, ProductUpdateSchema, PurchaseSchema, StockAdjustSchema, StockReturnSchema, StockSettingsSchema } from "./validations";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const map = (entries: Array<[string, Prisma.Decimal.Value]>) => new Map(entries.map(([k, v]) => [k, D(v)]));
const plain = (plan: ReturnType<typeof planOrderStockMovements>) => plan.map((p) => [p.productId, p.tipo, p.cantidad.toNumber()]);

describe("planificación del descuento de stock de una orden (solo descuenta, nunca repone)", () => {
  it("primer descuento: una salida (negativa) por producto, ordenadas por id", () => {
    const plan = planOrderStockMovements(map([["pB", 2], ["pA", 0.5]]), new Map());
    expect(plain(plan)).toEqual([["pA", "SALIDA_ORDEN", -0.5], ["pB", "SALIDA_ORDEN", -2]]);
  });

  it("es idempotente: si el libro ya descontó lo pedido, no hay movimientos", () => {
    expect(planOrderStockMovements(map([["pA", 3], ["pB", 1.25]]), map([["pA", 3], ["pB", 1.25]]))).toEqual([]);
  });

  it("aumento de cantidad: descuenta solo la diferencia", () => {
    expect(plain(planOrderStockMovements(map([["pA", 5]]), map([["pA", 3]])))).toEqual([["pA", "SALIDA_ORDEN", -2]]);
  });

  it("baja de cantidad o ítem quitado: NO repone stock (el repuesto pudo usarse)", () => {
    expect(planOrderStockMovements(map([["pA", 1]]), map([["pA", 3]]))).toEqual([]);
    expect(planOrderStockMovements(new Map(), map([["pA", 4]]))).toEqual([]);
  });

  it("producto cambiado: descuenta el nuevo y deja el anterior como excedente (sin reponerlo)", () => {
    const plan = planOrderStockMovements(map([["pB", 2]]), map([["pA", 2]]));
    expect(plain(plan)).toEqual([["pB", "SALIDA_ORDEN", -2]]);
  });

  it("lo ya descontado cuenta para futuros aumentos: tras bajar de 5 a 2 y volver a subir a 4 no se descuenta de nuevo", () => {
    expect(planOrderStockMovements(map([["pA", 4]]), map([["pA", 5]]))).toEqual([]);
    expect(plain(planOrderStockMovements(map([["pA", 7]]), map([["pA", 5]])))).toEqual([["pA", "SALIDA_ORDEN", -2]]);
  });

  it("decimales exactos: 0,1 + 0,2 no deja residuos de coma flotante", () => {
    const desired = sumByProduct([{ productId: "pA", cantidad: 0.1 }, { productId: "pA", cantidad: 0.2 }]);
    expect(planOrderStockMovements(desired, map([["pA", "0.3"]]))).toEqual([]);
    expect(plain(planOrderStockMovements(desired, new Map()))).toEqual([["pA", "SALIDA_ORDEN", -0.3]]);
  });

  it("suma los ítems repetidos del mismo producto e ignora los ítems sin producto", () => {
    const totals = sumByProduct([
      { productId: "pA", cantidad: 1 },
      { productId: null, cantidad: 99 },
      { productId: "pA", cantidad: 2.5 },
    ]);
    expect([...totals.entries()].map(([k, v]) => [k, v.toNumber()])).toEqual([["pA", 3.5]]);
  });

  it("la planificación no depende del orden de entrada (bloqueos uniformes)", () => {
    const a = planOrderStockMovements(map([["p3", 1], ["p1", 1], ["p2", 1]]), new Map());
    const b = planOrderStockMovements(map([["p2", 1], ["p3", 1], ["p1", 1]]), new Map());
    expect(plain(a)).toEqual(plain(b));
    expect(a.map((p) => p.productId)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("balance de stock de una orden (excedente devolvible)", () => {
  const balance = (d: Array<[string, Prisma.Decimal.Value]>, c: Array<[string, Prisma.Decimal.Value]>) =>
    orderStockBalance(map(d), map(c)).map((l) => [l.productId, l.solicitado.toNumber(), l.consumido.toNumber(), l.excedente.toNumber()]);

  it("sin cambios: lo consumido es lo solicitado y no hay excedente", () => {
    expect(balance([["pA", 3]], [["pA", 3]])).toEqual([["pA", 3, 3, 0]]);
  });

  it("al bajar la cantidad aparece el excedente (lo descontado que ya no se pide)", () => {
    expect(balance([["pA", 1]], [["pA", 3]])).toEqual([["pA", 1, 3, 2]]);
  });

  it("un producto quitado de los ítems queda con todo su consumo como excedente", () => {
    expect(balance([], [["pA", 4.5]])).toEqual([["pA", 0, 4.5, 4.5]]);
  });

  it("lo que falta descontar no es excedente", () => {
    expect(balance([["pA", 5]], [["pA", 2]])).toEqual([["pA", 5, 2, 0]]);
  });

  it("una devolución ya registrada reduce el consumido neto y por lo tanto el excedente", () => {
    // pedido 1, salieron 3 y se devolvieron 2: consumido neto 1, sin excedente
    expect(balance([["pA", 1]], [["pA", 1]])).toEqual([["pA", 1, 1, 0]]);
  });
});

describe("utilidades de stock", () => {
  it("normaliza el SKU", () => {
    expect(normalizeSku("  ace-5w30 ")).toBe("ACE-5W30");
  });

  it("reconoce el rechazo del trigger por stock insuficiente (también dentro de meta de Prisma)", () => {
    expect(isStockShortageError(new Error("Stock insuficiente: el movimiento dejaría el stock en -5."))).toBe(true);
    expect(isStockShortageError({ code: "P2010", message: "Raw query failed", meta: { code: "23514", message: "ERROR: Stock insuficiente: ..." } })).toBe(true);
    expect(isStockShortageError(new Error("otro error"))).toBe(false);
    expect(isStockShortageError(null)).toBe(false);
  });

  it("arma un mensaje claro con disponible y necesario", () => {
    const msg = shortageMessage([{ nombre: "Aceite 5W30", unidad: "LITRO", disponible: 2, necesario: 3.5 }]);
    expect(msg).toContain("Aceite 5W30 (disponible 2 L, necesario 3,5 L)");
    expect(msg).toMatch(/^Stock insuficiente:/);
  });
});

describe("validaciones del módulo de stock", () => {
  const cuid = "cmu7a30ld0001i604fl83lkr6";

  it("producto: aplica valores por defecto y normaliza el SKU", () => {
    const r = ProductSchema.safeParse({ nombre: "  Aceite 5W30 ", sku: " ace-1 " });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ nombre: "Aceite 5W30", sku: "ACE-1", unidad: "UNIDAD", costo: 0, precioVenta: 0, stockMinimo: 0 });
    }
    const vacio = ProductSchema.safeParse({ nombre: "Filtro", sku: "   " });
    expect(vacio.success && vacio.data.sku).toBeUndefined();
  });

  it("producto: rechaza datos inválidos con mensajes en español", () => {
    expect(ProductSchema.safeParse({ nombre: "A" }).success).toBe(false);
    expect(ProductSchema.safeParse({ nombre: "Aceite", unidad: "GALON" }).success).toBe(false);
    expect(ProductSchema.safeParse({ nombre: "Aceite", costo: -1 }).success).toBe(false);
    expect(ProductSchema.safeParse({ nombre: "Aceite", sku: "con espacios!" }).success).toBe(false);
    expect(ProductSchema.safeParse({ nombre: "Aceite", stockMinimo: 1.2345 }).success).toBe(false);
    expect(ProductSchema.safeParse({ nombre: "Aceite", stockActual: 50 }).success).toBe(false); // el stock nunca se escribe directo
    const r = ProductSchema.safeParse({ nombre: "Aceite", unidad: "GALON" });
    expect(!r.success && r.error.errors.every((e) => !/Invalid|Required/.test(e.message))).toBe(true);
  });

  it("las seis unidades aprobadas son válidas", () => {
    for (const unidad of ["UNIDAD", "LITRO", "KILO", "METRO", "JUEGO", "PAR"]) {
      expect(ProductSchema.safeParse({ nombre: "Producto", unidad }).success).toBe(true);
    }
  });

  it("el stock inicial es opcional y solo existe al crear", () => {
    expect(ProductSchema.safeParse({ nombre: "Aceite", stockInicial: 12.5 }).success).toBe(true);
    expect(ProductSchema.safeParse({ nombre: "Aceite", stockInicial: 0 }).success).toBe(false);
    expect(ProductUpdateSchema.safeParse({ nombre: "Aceite", stockInicial: 5 }).success).toBe(false);
  });

  it("compra: cantidad positiva con hasta 3 decimales", () => {
    expect(PurchaseSchema.safeParse({ productId: cuid, cantidad: 4.5, costoUnitario: 1200.5 }).success).toBe(true);
    expect(PurchaseSchema.safeParse({ productId: cuid, cantidad: 0 }).success).toBe(false);
    expect(PurchaseSchema.safeParse({ productId: cuid, cantidad: -2 }).success).toBe(false);
    expect(PurchaseSchema.safeParse({ productId: "x", cantidad: 1 }).success).toBe(false);
  });

  it("ajuste: cantidad con signo, nunca 0, y motivo obligatorio", () => {
    expect(StockAdjustSchema.safeParse({ productId: cuid, cantidad: -3, motivo: "Conteo físico" }).success).toBe(true);
    expect(StockAdjustSchema.safeParse({ productId: cuid, cantidad: 2.5, motivo: "Hallazgo" }).success).toBe(true);
    expect(StockAdjustSchema.safeParse({ productId: cuid, cantidad: 0, motivo: "Conteo físico" }).success).toBe(false);
    expect(StockAdjustSchema.safeParse({ productId: cuid, cantidad: 1 }).success).toBe(false);
    expect(StockAdjustSchema.safeParse({ productId: cuid, cantidad: 1, motivo: "  " }).success).toBe(false);
  });

  it("devolución: orden, producto, cantidad física positiva y motivo obligatorio", () => {
    const ok = { workOrderId: cuid, productId: cuid, cantidad: 1.5, motivo: "Repuesto sin usar" };
    expect(StockReturnSchema.safeParse(ok).success).toBe(true);
    expect(StockReturnSchema.safeParse({ ...ok, cantidad: 0 }).success).toBe(false);
    expect(StockReturnSchema.safeParse({ ...ok, cantidad: -1 }).success).toBe(false);
    expect(StockReturnSchema.safeParse({ ...ok, motivo: " " }).success).toBe(false);
    expect(StockReturnSchema.safeParse({ ...ok, workOrderId: undefined }).success).toBe(false);
  });

  it("política de stock negativo: exige un booleano", () => {
    expect(StockSettingsSchema.safeParse({ permitirStockNegativo: true }).success).toBe(true);
    expect(StockSettingsSchema.safeParse({ permitirStockNegativo: "si" }).success).toBe(false);
    expect(StockSettingsSchema.safeParse({}).success).toBe(false);
  });
});
