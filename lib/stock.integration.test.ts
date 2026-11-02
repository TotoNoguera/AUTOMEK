// Pruebas de INTEGRACIÓN del servicio de stock contra una base real (triggers, bloqueos y concurrencia incluidos).
//
//   npm run qa:test:integration              (conexión directa de QA)
//   QA_VIA_POOLER=1 npm run qa:test:integration   (por el pooler, como producción; en PowerShell: $env:QA_VIA_POOLER=1)
//
// Corren SOLO a través del runner de QA: el setup (scripts/qa/vitest-qa-setup.mjs) se niega a ejecutar si la conexión
// apunta a producción. El libro de movimientos es inmutable, así que estas pruebas dejan datos: usar una branch de QA
// descartable. Cada corrida crea sus propios talleres, así que son re-ejecutables.
import { beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { BusinessError, lockProducts, lockWorkOrder } from "@/lib/cash";
import {
  adjustStock,
  assertProductsUsable,
  createProduct,
  getProductOrThrow,
  insertMovement,
  getOrderStockSummary,
  reconcileOrderStock,
  registerPurchase,
  returnToStock,
  setNegativeStockPolicy,
  updateProduct,
  withDerived,
  type StockActor,
} from "@/lib/stock";

const RUN = crypto.randomBytes(4).toString("hex");
const transaction = <T>(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) =>
  db.$transaction(fn as never, { timeout: 30000, maxWait: 20000 }) as Promise<T>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Tenant {
  actor: StockActor;
  clientId: string;
  vehicleId: string;
}

async function newTenant(label: string): Promise<Tenant> {
  const user = await db.user.create({ data: { email: `stock-${label}-${RUN}@example.invalid`, name: `Stock ${label}`, password: "no-se-usa" } });
  const taller = await db.taller.create({ data: { nombre: `QA Stock ${label} ${RUN}` } });
  await db.userTaller.create({ data: { userId: user.id, tallerId: taller.id } });
  const client = await db.client.create({ data: { tallerId: taller.id, nombre: `Cliente ${label}` } });
  const vehicle = await db.vehicle.create({ data: { clientId: client.id, tallerId: taller.id, patente: `T${RUN.slice(0, 4).toUpperCase()}${label.toUpperCase()}`.slice(0, 8), marca: "Ford", modelo: "Ka", anio: 2020 } });
  return { actor: { tallerId: taller.id, userId: user.id }, clientId: client.id, vehicleId: vehicle.id };
}

let seq = 0;
async function newProduct(t: Tenant, nombre: string, opts: { stock?: number; minimo?: number; costo?: number; unidad?: "UNIDAD" | "LITRO" } = {}) {
  return transaction((tx) =>
    createProduct(tx, t.actor, {
      nombre: `${nombre} ${RUN}-${++seq}`,
      unidad: opts.unidad ?? "UNIDAD",
      costo: opts.costo ?? 100,
      precioVenta: (opts.costo ?? 100) * 2,
      stockMinimo: opts.minimo ?? 0,
      ...(opts.stock ? { stockInicial: opts.stock } : {}),
    })
  );
}

async function newOrder(t: Tenant, items: Array<{ productId?: string; cantidad: number }>, status: "APROBADA" | "EN_PROCESO" = "APROBADA") {
  return db.workOrder.create({
    data: {
      tallerId: t.actor.tallerId,
      clientId: t.clientId,
      vehicleId: t.vehicleId,
      motivoIngreso: "Prueba de stock",
      status,
      total: items.length * 100,
      items: { create: items.map((i) => ({ productId: i.productId, descripcion: "Ítem", cantidad: i.cantidad, precioUnitario: 100, subtotal: 100 })) },
    },
  });
}

/** Reemplaza los ítems de la orden como hace PUT /api/work-orders/[id] (borra y recrea) y reconcilia (solo descuenta). */
async function editOrderItems(t: Tenant, orderId: string, items: Array<{ productId?: string; cantidad: number }>) {
  return transaction(async (tx) => {
    await lockWorkOrder(tx, orderId);
    await tx.workOrderItem.deleteMany({ where: { workOrderId: orderId } });
    for (const i of items) await tx.workOrderItem.create({ data: { workOrderId: orderId, productId: i.productId, descripcion: "Ítem", cantidad: i.cantidad, precioUnitario: 100, subtotal: 100 } });
    return reconcileOrderStock(tx, t.actor, orderId);
  });
}

const reconcile = (t: Tenant, orderId: string) => transaction((tx) => reconcileOrderStock(tx, t.actor, orderId));
const stockOf = async (id: string) => Number((await db.product.findUniqueOrThrow({ where: { id } })).stockActual);
const ledgerSum = async (id: string) => Number((await db.stockMovement.aggregate({ where: { productId: id }, _sum: { cantidad: true } }))._sum.cantidad ?? 0);
const movementsOf = (orderId: string) => db.stockMovement.findMany({ where: { workOrderId: orderId }, orderBy: { createdAt: "asc" } });
const expectBusiness = async (promise: Promise<unknown>, status: number, message?: RegExp) => {
  const error = await promise.then(() => null, (e) => e);
  expect(error, "debía fallar con un error de negocio").toBeInstanceOf(BusinessError);
  expect((error as BusinessError).status).toBe(status);
  if (message) expect((error as BusinessError).message).toMatch(message);
};

let A: Tenant;
let B: Tenant;
beforeAll(async () => {
  A = await newTenant("A");
  B = await newTenant("B");
});

// =====================================================================================================================
describe("productos", () => {
  it("se crean con stock 0, derivados (margen, stock bajo) y auditoría con el usuario de la sesión", async () => {
    const p = await newProduct(A, "Aceite", { costo: 1000, minimo: 2 });
    expect(Number(p.stockActual)).toBe(0);
    const d = withDerived(p);
    expect(d.margen).toBe(1000);
    expect(d.margenPorcentaje).toBe(50);
    expect(d.stockBajo).toBe(true); // 0 <= 2
    const audit = await db.auditLog.findFirst({ where: { entityId: p.id, accion: "PRODUCT_CREATED" } });
    expect(audit?.userId).toBe(A.actor.userId);
    expect(audit?.tallerId).toBe(A.actor.tallerId);
  });

  it("el stock inicial se registra como una entrada en el libro (nunca se escribe stockActual)", async () => {
    const p = await newProduct(A, "Con stock inicial", { stock: 12.5, unidad: "LITRO" });
    expect(Number(p.stockActual)).toBe(12.5);
    const [m] = await db.stockMovement.findMany({ where: { productId: p.id } });
    expect(m.tipo).toBe("ENTRADA_COMPRA");
    expect(Number(m.cantidad)).toBe(12.5);
    expect(Number(m.stockResultante)).toBe(12.5);
    expect(m.userId).toBe(A.actor.userId);
    expect(await db.auditLog.count({ where: { entityId: m.id, accion: "STOCK_PURCHASED" } })).toBe(1);
  });

  it("el SKU es único por taller (409) pero puede repetirse entre talleres", async () => {
    const sku = `SKU-${RUN}`;
    await transaction((tx) => createProduct(tx, A.actor, { nombre: "Con sku", sku, unidad: "UNIDAD", costo: 1, precioVenta: 2, stockMinimo: 0 }));
    await expectBusiness(transaction((tx) => createProduct(tx, A.actor, { nombre: "Repetido", sku, unidad: "UNIDAD", costo: 1, precioVenta: 2, stockMinimo: 0 })), 409, /código \(SKU\)/);
    await transaction((tx) => createProduct(tx, B.actor, { nombre: "Mismo sku, otro taller", sku, unidad: "UNIDAD", costo: 1, precioVenta: 2, stockMinimo: 0 }));
  });

  it("la edición audita antes/después y no permite cambiar la unidad si ya hay movimientos", async () => {
    const p = await newProduct(A, "Editable", { stock: 5, costo: 100 });
    const input = { nombre: p.nombre, unidad: p.unidad, costo: 150, precioVenta: 400, stockMinimo: 1 };
    const updated = await transaction((tx) => updateProduct(tx, A.actor, p.id, input));
    expect(updated.costo).toBe(150);
    const audit = await db.auditLog.findFirst({ where: { entityId: p.id, accion: "PRODUCT_UPDATED" } });
    expect(JSON.parse(audit!.oldValue!)).toMatchObject({ costo: 100 });
    expect(JSON.parse(audit!.newValue!)).toMatchObject({ costo: 150, precioVenta: 400 });
    await expectBusiness(transaction((tx) => updateProduct(tx, A.actor, p.id, { ...input, unidad: "LITRO" })), 409, /unidad/);
    const sinMovs = await newProduct(A, "Sin movimientos");
    const cambiado = await transaction((tx) => updateProduct(tx, A.actor, sinMovs.id, { nombre: sinMovs.nombre, unidad: "KILO", costo: 1, precioVenta: 2, stockMinimo: 0 }));
    expect(cambiado.unidad).toBe("KILO");
  });

  it("un producto inactivo no se puede usar en ítems ni recibir compras", async () => {
    const p = await newProduct(A, "A desactivar");
    await transaction((tx) => updateProduct(tx, A.actor, p.id, { nombre: p.nombre, unidad: p.unidad, costo: 1, precioVenta: 2, stockMinimo: 0, activo: false }));
    await expectBusiness(transaction((tx) => assertProductsUsable(tx, A.actor.tallerId, [p.id])), 409, /inactivo/);
    await expectBusiness(transaction((tx) => registerPurchase(tx, A.actor, { productId: p.id, cantidad: 1 })), 409, /inactivo/);
  });
});

// =====================================================================================================================
describe("compras, ajustes y política de stock negativo", () => {
  it("una compra suma stock, actualiza el costo con el de la última compra y audita", async () => {
    const p = await newProduct(A, "Compra", { costo: 100 });
    const m = await transaction((tx) => registerPurchase(tx, A.actor, { productId: p.id, cantidad: 8, costoUnitario: 120 }));
    expect(Number(m.stockResultante)).toBe(8);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).costo).toBe(120);
    expect(m.costoUnitario).toBe(120);
    expect(await db.auditLog.count({ where: { entityId: m.id, accion: "STOCK_PURCHASED", userId: A.actor.userId } })).toBe(1);
  });

  it("un ajuste exige motivo (en la base) y queda auditado; un ajuste que deja stock negativo se rechaza con 409", async () => {
    const p = await newProduct(A, "Ajuste", { stock: 3 });
    const m = await transaction((tx) => adjustStock(tx, A.actor, { productId: p.id, cantidad: -2, motivo: "Conteo físico" }));
    expect(m.motivo).toBe("Conteo físico");
    expect(await stockOf(p.id)).toBe(1);
    await expectBusiness(transaction((tx) => adjustStock(tx, A.actor, { productId: p.id, cantidad: -5, motivo: "Error" })), 409, /Stock insuficiente.*disponible 1/);
    expect(await stockOf(p.id)).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: m.id, accion: "STOCK_ADJUSTED" } })).toBe(1);
  });

  it("con stock negativo habilitado se permite; al deshabilitarlo vuelve a bloquear (y la política se audita)", async () => {
    const T = await newTenant("N");
    const p = await newProduct(T, "Politica", { stock: 1 });
    const o = await newOrder(T, [{ productId: p.id, cantidad: 3 }], "EN_PROCESO");
    await expectBusiness(reconcile(T, o.id), 409, /Stock insuficiente/);
    await transaction((tx) => setNegativeStockPolicy(tx, T.actor, true));
    await reconcile(T, o.id);
    expect(await stockOf(p.id)).toBe(-2);
    await transaction((tx) => setNegativeStockPolicy(tx, T.actor, false));
    const o2 = await newOrder(T, [{ productId: p.id, cantidad: 1 }], "EN_PROCESO");
    await expectBusiness(reconcile(T, o2.id), 409, /Stock insuficiente/);
    expect(await db.auditLog.count({ where: { tallerId: T.actor.tallerId, accion: "STOCK_POLICY_CHANGED" } })).toBe(2);
    expect((await db.taller.findUniqueOrThrow({ where: { id: T.actor.tallerId } })).permitirStockNegativo).toBe(false);
  });
});

// =====================================================================================================================
describe("descuento por orden de trabajo (reconciliación)", () => {
  it("descuenta una sola vez: repetir la reconciliación (reintento, doble clic) no genera movimientos", async () => {
    const p = await newProduct(A, "Idem", { stock: 10, costo: 250 });
    const o = await newOrder(A, [{ productId: p.id, cantidad: 2.5 }, { cantidad: 1 }]); // un ítem sin producto no cuenta
    const first = await reconcile(A, o.id);
    expect(first).toHaveLength(1);
    expect(first[0].tipo).toBe("SALIDA_ORDEN");
    expect(Number(first[0].cantidad)).toBe(-2.5);
    expect(first[0].costoUnitario).toBe(250); // costo del producto al momento del consumo
    for (let i = 0; i < 3; i++) expect(await reconcile(A, o.id)).toHaveLength(0);
    expect(await stockOf(p.id)).toBe(7.5);
    expect(await movementsOf(o.id)).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: first[0].id, accion: "STOCK_CONSUMED", userId: A.actor.userId } })).toBe(1);
  });

  it("aumentar la cantidad descuenta la diferencia; reducir o quitar un ítem NO repone stock (queda como excedente devolvible)", async () => {
    const p = await newProduct(A, "Edición", { stock: 20 });
    const q = await newProduct(A, "Edición 2", { stock: 20 });
    const o = await newOrder(A, [{ productId: p.id, cantidad: 2 }]);
    await reconcile(A, o.id);
    expect(await stockOf(p.id)).toBe(18);

    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 5 }]); // 2 -> 5: descuenta 3
    expect(await stockOf(p.id)).toBe(15);
    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 1 }]); // 5 -> 1: el repuesto pudo usarse, no se repone
    expect(await stockOf(p.id)).toBe(15);
    expect((await movementsOf(o.id)).filter((m) => m.tipo === "DEVOLUCION")).toHaveLength(0);
    const resumen = await transaction((tx) => getOrderStockSummary(tx, A.actor, o.id));
    const linea = resumen.productos.find((l) => l.productId === p.id)!;
    expect([Number(linea.solicitado), Number(linea.consumido), Number(linea.excedente)]).toEqual([1, 5, 4]);

    await editOrderItems(A, o.id, [{ productId: q.id, cantidad: 3 }]); // cambia de producto: descuenta q y p queda como excedente
    expect(await stockOf(p.id)).toBe(15);
    expect(await stockOf(q.id)).toBe(17);
    await editOrderItems(A, o.id, [{ cantidad: 1 }]); // se quitan todos los productos: nada se repone solo
    expect(await stockOf(q.id)).toBe(17);
    const sinProductos = await transaction((tx) => getOrderStockSummary(tx, A.actor, o.id));
    expect(sinProductos.productos.map((l) => [l.productId === p.id ? "p" : "q", Number(l.excedente)]).sort()).toEqual([["p", 5], ["q", 3]]);
    expect(await ledgerSum(p.id)).toBe(await stockOf(p.id));
    expect(await ledgerSum(q.id)).toBe(await stockOf(q.id));
  });

  it("lo ya descontado cuenta para aumentos posteriores: bajar y volver a subir no descuenta dos veces", async () => {
    const p = await newProduct(A, "Subir y bajar", { stock: 20 });
    const o = await newOrder(A, [{ productId: p.id, cantidad: 5 }]);
    await reconcile(A, o.id);
    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 2 }]);
    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 4 }]); // sigue por debajo de lo ya descontado (5)
    expect(await stockOf(p.id)).toBe(15);
    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 7 }]); // ahora faltan 2
    expect(await stockOf(p.id)).toBe(13);
  });

  it("una orden sin productos o con todo ya descontado no toca el stock", async () => {
    const o = await newOrder(A, [{ cantidad: 2 }, { cantidad: 1 }]);
    expect(await reconcile(A, o.id)).toEqual([]);
    expect(await movementsOf(o.id)).toHaveLength(0);
  });

  it("si falta stock se rechaza con 409 detallado y no queda NINGÚN movimiento (todo o nada)", async () => {
    const ok = await newProduct(A, "Hay", { stock: 10 });
    const poco = await newProduct(A, "Poco", { stock: 1, unidad: "LITRO" });
    const o = await newOrder(A, [{ productId: ok.id, cantidad: 2 }, { productId: poco.id, cantidad: 3 }], "EN_PROCESO");
    await expectBusiness(reconcile(A, o.id), 409, /Stock insuficiente: .*Poco.*disponible 1 L.*necesario 3 L/);
    expect(await movementsOf(o.id)).toHaveLength(0);
    expect(await stockOf(ok.id)).toBe(10);
    expect(await stockOf(poco.id)).toBe(1);
  });

  it("una orden de otro taller no se puede reconciliar (404)", async () => {
    const p = await newProduct(B, "De B", { stock: 5 });
    const oB = await newOrder(B, [{ productId: p.id, cantidad: 1 }]);
    await expectBusiness(reconcile(A, oB.id), 404);
    expect(await stockOf(p.id)).toBe(5);
  });
});

// =====================================================================================================================
describe("devoluciones explícitas al stock", () => {
  const devolver = (t: Tenant, workOrderId: string, productId: string, cantidad: number, motivo = "Repuesto sin usar recuperado") =>
    transaction((tx) => returnToStock(tx, t.actor, { workOrderId, productId, cantidad, motivo }));

  async function ordenConExcedente(t: Tenant, { stock = 10, pedido = 4, quedan = 1 } = {}) {
    const p = await newProduct(t, "Devolvible", { stock });
    const o = await newOrder(t, [{ productId: p.id, cantidad: pedido }]);
    await reconcile(t, o.id);
    await editOrderItems(t, o.id, [{ productId: p.id, cantidad: quedan }]); // excedente = pedido - quedan
    return { p, o };
  }

  it("repone solo las unidades recuperadas, con cantidad, motivo y auditoría con el usuario", async () => {
    const { p, o } = await ordenConExcedente(A); // salieron 4, quedó 1 pedido: excedente 3
    expect(await stockOf(p.id)).toBe(6);
    const m = await devolver(A, o.id, p.id, 2.5, "Cliente no usó el filtro; se recuperó en perfecto estado");
    expect(m.tipo).toBe("DEVOLUCION");
    expect(Number(m.cantidad)).toBe(2.5);
    expect(m.motivo).toMatch(/recuperó/);
    expect(m.workOrderId).toBe(o.id);
    expect(await stockOf(p.id)).toBe(8.5);
    const audit = await db.auditLog.findFirst({ where: { entityId: m.id, accion: "STOCK_RETURNED" } });
    expect(audit?.userId).toBe(A.actor.userId);
    expect(JSON.parse(audit!.newValue!)).toMatchObject({ workOrderId: o.id, productId: p.id, cantidad: 2.5 });
    const resumen = await transaction((tx) => getOrderStockSummary(tx, A.actor, o.id));
    const l = resumen.productos[0];
    expect([Number(l.devuelto), Number(l.excedente), Number(l.consumido)]).toEqual([2.5, 0.5, 1.5]);
  });

  it("no se puede devolver más que el excedente (409 con la cantidad máxima) ni lo que los ítems todavía piden", async () => {
    const { p, o } = await ordenConExcedente(A);
    await expectBusiness(devolver(A, o.id, p.id, 3.5), 409, /Solo se pueden devolver hasta 3 u\./);
    expect(await stockOf(p.id)).toBe(6);
    await devolver(A, o.id, p.id, 3);
    await expectBusiness(devolver(A, o.id, p.id, 0.5), 409, /todavía piden 1 u\..*Reducí o quitá el ítem primero/);
    expect(await stockOf(p.id)).toBe(9);
  });

  it("una orden que no descontó el producto no admite devolución, y una orden entera sin cambios tampoco", async () => {
    const p = await newProduct(A, "Sin consumo", { stock: 5 });
    const o = await newOrder(A, [{ productId: p.id, cantidad: 2 }]); // APROBADA: todavía no descontó nada
    await expectBusiness(devolver(A, o.id, p.id, 1), 409, /no descontó/);
    await reconcile(A, o.id);
    await expectBusiness(devolver(A, o.id, p.id, 1), 409, /todavía piden 2 u\./);
    expect(await stockOf(p.id)).toBe(3);
  });

  it("tras una devolución, si el ítem vuelve a pedir esas unidades se descuentan de nuevo", async () => {
    const { p, o } = await ordenConExcedente(A, { stock: 10, pedido: 4, quedan: 1 });
    await devolver(A, o.id, p.id, 3); // consumido neto 1, stock 9
    await editOrderItems(A, o.id, [{ productId: p.id, cantidad: 3 }]); // faltan 2
    expect(await stockOf(p.id)).toBe(7);
  });

  it("aislamiento: otro taller no puede devolver en una orden ajena (404) ni con productos ajenos", async () => {
    const { p, o } = await ordenConExcedente(A);
    await expectBusiness(devolver(B, o.id, p.id, 1), 404);
    const deB = await newProduct(B, "Producto de B", { stock: 3 });
    await expectBusiness(devolver(A, o.id, deB.id, 1), 404);
    expect(await stockOf(p.id)).toBe(6);
  });

  it("devoluciones simultáneas no pueden superar el excedente", async () => {
    const { p, o } = await ordenConExcedente(A, { stock: 20, pedido: 5, quedan: 1 }); // excedente 4
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => devolver(A, o.id, p.id, 1)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const rechazadas = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toBe(4);
    expect(rechazadas).toHaveLength(2);
    for (const r of rechazadas) {
      expect(r.reason).toBeInstanceOf(BusinessError);
      expect((r.reason as BusinessError).status).toBe(409);
    }
    expect(await stockOf(p.id)).toBe(19); // 20 - 5 + 4
    expect(await ledgerSum(p.id)).toBe(19);
  });
});

// =====================================================================================================================
describe("aislamiento entre talleres", () => {
  it("un producto de otro taller se informa como inexistente (404), sin confirmar que existe", async () => {
    const deB = await newProduct(B, "Solo B");
    await expectBusiness(transaction((tx) => assertProductsUsable(tx, A.actor.tallerId, [deB.id])), 404, /no encontrado/);
    await expectBusiness(transaction((tx) => getProductOrThrow(tx, A.actor.tallerId, deB.id)), 404);
    await expectBusiness(transaction((tx) => registerPurchase(tx, A.actor, { productId: deB.id, cantidad: 1 })), 404);
    await expectBusiness(transaction((tx) => adjustStock(tx, A.actor, { productId: deB.id, cantidad: 1, motivo: "x" })), 404);
    await expectBusiness(transaction((tx) => updateProduct(tx, A.actor, deB.id, { nombre: "x", unidad: "UNIDAD", costo: 1, precioVenta: 1, stockMinimo: 0 })), 404);
    expect(await stockOf(deB.id)).toBe(0);
  });

  it("la base impide referencias cruzadas aunque la aplicación se equivoque (triggers y clave compuesta)", async () => {
    const deB = await newProduct(B, "Cruce", { stock: 3 });
    const oA = await newOrder(A, [{ cantidad: 1 }]);
    await expect(db.workOrderItem.create({ data: { workOrderId: oA.id, productId: deB.id, descripcion: "x", cantidad: 1, precioUnitario: 1, subtotal: 1 } })).rejects.toThrow(/no pertenece al taller/);
    const qA = await db.quote.create({ data: { tallerId: A.actor.tallerId, clientId: A.clientId, vehicleId: A.vehicleId } });
    await expect(db.quoteItem.create({ data: { quoteId: qA.id, productId: deB.id, descripcion: "x", cantidad: 1, precioUnitario: 1, subtotal: 1 } })).rejects.toThrow(/no pertenece al taller/);
    await expect(insertMovement(db as never, { actor: A.actor, productId: deB.id, tipo: "ENTRADA_COMPRA", cantidad: 1 })).rejects.toThrow();
    expect(await stockOf(deB.id)).toBe(3);
  });

  it("el historial de un producto solo contiene movimientos de su taller", async () => {
    const p = await newProduct(A, "Historial", { stock: 2 });
    await transaction((tx) => registerPurchase(tx, A.actor, { productId: p.id, cantidad: 3 }));
    const rows = await db.stockMovement.findMany({ where: { productId: p.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((m) => m.tallerId === A.actor.tallerId)).toBe(true);
  });
});

// =====================================================================================================================
describe("concurrencia", () => {
  it("dos solicitudes simultáneas sobre la MISMA orden descuentan una sola vez", async () => {
    const p = await newProduct(A, "Misma orden", { stock: 10 });
    const o = await newOrder(A, [{ productId: p.id, cantidad: 2 }]);
    const results = await Promise.all([reconcile(A, o.id), reconcile(A, o.id)]);
    expect(results.map((r) => r.length).sort()).toEqual([0, 1]);
    expect(await stockOf(p.id)).toBe(8);
    expect(await movementsOf(o.id)).toHaveLength(1);
  });

  it("dos órdenes DISTINTAS compitiendo por el mismo stock: una gana y la otra recibe 409 sin dejar rastros", async () => {
    const p = await newProduct(A, "Compartido", { stock: 3 });
    const o1 = await newOrder(A, [{ productId: p.id, cantidad: 2 }], "EN_PROCESO");
    const o2 = await newOrder(A, [{ productId: p.id, cantidad: 2 }], "EN_PROCESO");
    const results = await Promise.allSettled([reconcile(A, o1.id), reconcile(A, o2.id)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(BusinessError);
    expect((rejected[0].reason as BusinessError).status).toBe(409);
    expect(await stockOf(p.id)).toBe(1);
    expect((await movementsOf(o1.id)).length + (await movementsOf(o2.id)).length).toBe(1);
  });

  it("10 compras simultáneas del mismo producto: stock exacto y cadena de stockResultante sin repetidos", async () => {
    const p = await newProduct(A, "Compras");
    await Promise.all(Array.from({ length: 10 }, () => transaction((tx) => registerPurchase(tx, A.actor, { productId: p.id, cantidad: 1 }))));
    expect(await stockOf(p.id)).toBe(10);
    const chain = (await db.stockMovement.findMany({ where: { productId: p.id }, select: { stockResultante: true } })).map((m) => Number(m.stockResultante)).sort((a, b) => a - b);
    expect(chain).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("si la condición de carrera supera la verificación previa, el trigger responde y el servicio lo traduce a 409 (nunca 500)", async () => {
    const p = await newProduct(A, "Carrera", { stock: 5 });
    const o = await newOrder(A, [{ cantidad: 1 }]);
    // insertMovement va directo al libro, sin la verificación previa: solo el trigger protege el stock
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => transaction((tx) => insertMovement(tx, { actor: A.actor, productId: p.id, workOrderId: o.id, tipo: "SALIDA_ORDEN", cantidad: -1 })))
    );
    const rejected = attempts.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(rejected).toHaveLength(5);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(BusinessError);
      expect((r.reason as BusinessError).status).toBe(409);
    }
    expect(await stockOf(p.id)).toBe(0);
  });

  it("órdenes con los mismos productos en sentido contrario no generan deadlocks (orden de bloqueo uniforme)", async () => {
    const p1 = await newProduct(A, "Lock 1", { stock: 1000 });
    const p2 = await newProduct(A, "Lock 2", { stock: 1000 });
    for (let round = 0; round < 3; round++) {
      const orders = await Promise.all(
        Array.from({ length: 6 }, (_, i) => newOrder(A, i % 2 === 0 ? [{ productId: p1.id, cantidad: 1 }, { productId: p2.id, cantidad: 1 }] : [{ productId: p2.id, cantidad: 1 }, { productId: p1.id, cantidad: 1 }]))
      );
      const results = await Promise.allSettled(orders.map((o) => reconcile(A, o.id)));
      expect(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason))).toEqual([]);
    }
    expect(await stockOf(p1.id)).toBe(1000 - 18);
    expect(await stockOf(p2.id)).toBe(1000 - 18);
  });

  it("lockProducts acepta ids desordenados, repetidos o vacíos sin error", async () => {
    const p1 = await newProduct(A, "L1");
    const p2 = await newProduct(A, "L2");
    await transaction(async (tx) => {
      await lockProducts(tx, []);
      await lockProducts(tx, [p2.id, p1.id, p2.id]);
    });
  });
});

// =====================================================================================================================
describe("integridad del libro", () => {
  it("el libro es inmutable y stockActual no se puede escribir desde la aplicación", async () => {
    const p = await newProduct(A, "Inmutable", { stock: 4 });
    const m = (await db.stockMovement.findMany({ where: { productId: p.id } }))[0];
    await expect(db.stockMovement.update({ where: { id: m.id }, data: { motivo: "cambiado" } })).rejects.toThrow(/inmutables/);
    await expect(db.stockMovement.delete({ where: { id: m.id } })).rejects.toThrow(/inmutables/);
    await expect(db.product.update({ where: { id: p.id }, data: { stockActual: 999 } })).rejects.toThrow(/movimientos de stock/);
    await expect(db.product.delete({ where: { id: p.id } })).rejects.toThrow();
    expect(await stockOf(p.id)).toBe(4);
  });

  it("para todos los productos de esta corrida, stockActual coincide con la suma del libro y no hay stock negativo", async () => {
    await sleep(50);
    const products = await db.product.findMany({ where: { tallerId: { in: [A.actor.tallerId, B.actor.tallerId] } } });
    expect(products.length).toBeGreaterThan(10);
    for (const p of products) {
      expect(Number(p.stockActual), p.nombre).toBe(await ledgerSum(p.id));
    }
    expect(products.filter((p) => Number(p.stockActual) < 0).map((p) => p.nombre)).toEqual([]);
  });
});
