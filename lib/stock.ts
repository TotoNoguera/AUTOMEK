// Servicio de stock. TODA operación recibe la transacción (`tx`) del llamador y filtra por el taller autenticado.
//
// Reglas de arquitectura (aprobadas):
//  - El libro `stock_movements` es la fuente de verdad e inmutable. `products.stockActual` lo actualiza únicamente el
//    trigger de la base en el mismo INSERT (nunca la aplicación).
//  - Orden de bloqueo uniforme: primero la orden de trabajo (lockWorkOrder), después los productos por id (lockProducts).
//  - Lo consumido por una orden se deriva SOLO del libro (SALIDA_ORDEN + DEVOLUCION agrupados por orden y producto).
//  - La reconciliación considera los productos actuales de los ítems y los de movimientos históricos de la orden.
//  - NADA repone stock automáticamente: ni retroceder de estado, ni reducir o quitar un ítem (el repuesto pudo usarse).
//    Lo ya descontado que los ítems no piden queda como "excedente devolvible"; el stock solo vuelve con una devolución
//    explícita (returnToStock): unidades físicamente recuperadas, con cantidad, motivo y auditoría (STOCK_RETURNED).
//  - Sin stock negativo salvo que el taller lo habilite (Taller.permitirStockNegativo).
import { Prisma } from "@prisma/client";
import "./decimal";
import { BusinessError, lockProducts, lockWorkOrder } from "./cash";
import { logAudit } from "./audit";
import { formatQuantity } from "./units";
import { MARGEN, isStockShortageError, orderStockBalance, planOrderStockMovements, shortageMessage, sumByProduct, type Shortage } from "./stock-plan";

type Tx = Prisma.TransactionClient;
const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

export interface StockActor {
  tallerId: string;
  userId: string;
}

/** Estados en los que la orden ya consumió su stock. El descuento ocurre al llegar a EN_PROCESO (o más adelante). */
export const STOCK_CONSUMING_STATES = ["EN_PROCESO", "TERMINADA", "ENTREGADA"] as const;
export const consumesStock = (status: string) => (STOCK_CONSUMING_STATES as readonly string[]).includes(status);

const code = (error: unknown) => (error as { code?: string } | null)?.code;

/** Traduce el rechazo del trigger por stock insuficiente (condición de carrera) a un 409 controlado. */
export function mapStockError(error: unknown): unknown {
  if (isStockShortageError(error)) {
    return new BusinessError("Stock insuficiente: otra operación usó el stock disponible mientras se procesaba. Revisá las cantidades e intentá de nuevo.", 409);
  }
  return error;
}

// ---------------------------------------------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------------------------------------------

export type ProductRow = Prisma.ProductGetPayload<object>;

/** Agrega los campos derivados: margen, porcentaje de margen y alerta de stock bajo (stockActual <= stockMinimo). */
export function withDerived(product: ProductRow) {
  const costo = product.costo;
  const precio = product.precioVenta;
  const margen = MARGEN(precio, costo);
  return {
    ...product,
    margen,
    margenPorcentaje: precio > 0 ? Math.round((margen / precio) * 1000) / 10 : null,
    stockBajo: product.stockActual.lte(product.stockMinimo),
  };
}

export async function getProductOrThrow(tx: Tx, tallerId: string, id: string): Promise<ProductRow> {
  const product = await tx.product.findFirst({ where: { id, tallerId } });
  if (!product) throw new BusinessError("Producto no encontrado.", 404);
  return product;
}

/**
 * Valida que los productos de los ítems pertenezcan al taller y estén activos. Un id de otro taller se informa
 * igual que uno inexistente (404): nunca se confirma que exista.
 */
export async function assertProductsUsable(tx: Tx, tallerId: string, productIds: Array<string | undefined | null>) {
  const ids = [...new Set(productIds.filter((v): v is string => !!v))];
  if (ids.length === 0) return;
  const found = await tx.product.findMany({ where: { id: { in: ids }, tallerId }, select: { id: true, nombre: true, activo: true } });
  if (found.length !== ids.length) throw new BusinessError("Producto no encontrado.", 404);
  const inactive = found.find((p) => !p.activo);
  if (inactive) throw new BusinessError(`El producto "${inactive.nombre}" está inactivo. Activalo o quitalo de los ítems.`, 409);
}

export interface ProductInput {
  nombre: string;
  sku?: string;
  categoria?: string;
  unidad: "UNIDAD" | "LITRO" | "KILO" | "METRO" | "JUEGO" | "PAR";
  costo: number;
  precioVenta: number;
  stockMinimo: number;
  activo?: boolean;
}

export async function createProduct(tx: Tx, actor: StockActor, input: ProductInput & { stockInicial?: number }) {
  const { stockInicial, activo, ...data } = input;
  let product: ProductRow;
  try {
    product = await tx.product.create({ data: { ...data, activo: activo ?? true, tallerId: actor.tallerId } });
  } catch (error) {
    if (code(error) === "P2002") throw new BusinessError("Ya existe un producto con ese código (SKU) en tu taller.", 409);
    throw error;
  }
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "PRODUCT_CREATED",
    entityType: "PRODUCT",
    entityId: product.id,
    newValue: { nombre: product.nombre, sku: product.sku, unidad: product.unidad, costo: product.costo, precioVenta: product.precioVenta },
  });
  if (stockInicial) {
    await registerPurchase(tx, actor, { productId: product.id, cantidad: stockInicial, motivo: "Stock inicial" });
  }
  return getProductOrThrow(tx, actor.tallerId, product.id);
}

export async function updateProduct(tx: Tx, actor: StockActor, id: string, input: ProductInput) {
  const current = await getProductOrThrow(tx, actor.tallerId, id);
  if (input.unidad !== current.unidad) {
    const moved = await tx.stockMovement.count({ where: { productId: id, tallerId: actor.tallerId } });
    if (moved > 0) {
      throw new BusinessError("No se puede cambiar la unidad de un producto que ya tiene movimientos de stock.", 409);
    }
  }
  const { activo, ...rest } = input;
  const data = { ...rest, activo: activo ?? current.activo, sku: input.sku ?? null, categoria: input.categoria ?? null };
  let updated: ProductRow;
  try {
    updated = await tx.product.update({ where: { id }, data });
  } catch (error) {
    if (code(error) === "P2002") throw new BusinessError("Ya existe un producto con ese código (SKU) en tu taller.", 409);
    throw error;
  }
  const changed: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const key of ["nombre", "sku", "categoria", "unidad", "costo", "precioVenta", "activo"] as const) {
    if (current[key] !== updated[key]) changed[key] = { antes: current[key], despues: updated[key] };
  }
  if (!current.stockMinimo.equals(updated.stockMinimo)) changed.stockMinimo = { antes: current.stockMinimo.toNumber(), despues: updated.stockMinimo.toNumber() };
  if (Object.keys(changed).length > 0) {
    await logAudit(tx, {
      tallerId: actor.tallerId,
      userId: actor.userId,
      accion: "PRODUCT_UPDATED",
      entityType: "PRODUCT",
      entityId: id,
      oldValue: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.antes])),
      newValue: Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, v.despues])),
    });
  }
  return updated;
}

// ---------------------------------------------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------------------------------------------

interface InsertMovement {
  actor: StockActor;
  productId: string;
  tipo: "ENTRADA_COMPRA" | "SALIDA_ORDEN" | "AJUSTE" | "DEVOLUCION";
  cantidad: Prisma.Decimal.Value;
  workOrderId?: string;
  motivo?: string | null;
  costoUnitario?: number | null;
}

/** Única puerta de escritura del libro. El trigger actualiza stockActual y valida la política de stock negativo. */
export async function insertMovement(tx: Tx, m: InsertMovement) {
  try {
    return await tx.stockMovement.create({
      data: {
        tallerId: m.actor.tallerId,
        userId: m.actor.userId,
        productId: m.productId,
        workOrderId: m.workOrderId,
        tipo: m.tipo,
        cantidad: D(m.cantidad),
        motivo: m.motivo ?? null,
        costoUnitario: m.costoUnitario ?? null,
      },
    });
  } catch (error) {
    throw mapStockError(error);
  }
}

async function allowsNegativeStock(tx: Tx, tallerId: string): Promise<boolean> {
  const taller = await tx.taller.findUnique({ where: { id: tallerId }, select: { permitirStockNegativo: true } });
  return taller?.permitirStockNegativo ?? false;
}

export async function registerPurchase(
  tx: Tx,
  actor: StockActor,
  input: { productId: string; cantidad: number; costoUnitario?: number; motivo?: string }
) {
  const product = await getProductOrThrow(tx, actor.tallerId, input.productId);
  if (!product.activo) throw new BusinessError(`El producto "${product.nombre}" está inactivo. Activalo para cargar compras.`, 409);
  const movement = await insertMovement(tx, {
    actor,
    productId: product.id,
    tipo: "ENTRADA_COMPRA",
    cantidad: input.cantidad,
    motivo: input.motivo ?? "Compra",
    costoUnitario: input.costoUnitario ?? product.costo,
  });
  // El costo del producto sigue a la última compra
  if (input.costoUnitario !== undefined && input.costoUnitario !== product.costo) {
    await tx.product.update({ where: { id: product.id }, data: { costo: input.costoUnitario } });
  }
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "STOCK_PURCHASED",
    entityType: "STOCK_MOVEMENT",
    entityId: movement.id,
    descripcion: `Compra de ${input.cantidad} ${product.nombre}`,
    newValue: { productId: product.id, cantidad: input.cantidad, costoUnitario: input.costoUnitario ?? null, stockResultante: movement.stockResultante.toNumber() },
  });
  return movement;
}

export async function adjustStock(tx: Tx, actor: StockActor, input: { productId: string; cantidad: number; motivo: string }) {
  const product = await getProductOrThrow(tx, actor.tallerId, input.productId);
  if (input.cantidad < 0) {
    await lockProducts(tx, [product.id]);
    const fresh = await getProductOrThrow(tx, actor.tallerId, input.productId);
    if (fresh.stockActual.plus(input.cantidad).isNegative() && !(await allowsNegativeStock(tx, actor.tallerId))) {
      throw new BusinessError(
        shortageMessage([{ nombre: fresh.nombre, unidad: fresh.unidad, disponible: fresh.stockActual, necesario: Math.abs(input.cantidad) }]),
        409
      );
    }
  }
  const movement = await insertMovement(tx, { actor, productId: product.id, tipo: "AJUSTE", cantidad: input.cantidad, motivo: input.motivo });
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "STOCK_ADJUSTED",
    entityType: "STOCK_MOVEMENT",
    entityId: movement.id,
    descripcion: `Ajuste de ${input.cantidad} ${product.nombre}. Motivo: ${input.motivo}`,
    newValue: { productId: product.id, cantidad: input.cantidad, motivo: input.motivo, stockResultante: movement.stockResultante.toNumber() },
  });
  return movement;
}

export async function setNegativeStockPolicy(tx: Tx, actor: StockActor, permitir: boolean) {
  const current = await tx.taller.findUnique({ where: { id: actor.tallerId }, select: { permitirStockNegativo: true } });
  if (!current) throw new BusinessError("Taller no encontrado.", 404);
  if (current.permitirStockNegativo === permitir) return current;
  const updated = await tx.taller.update({ where: { id: actor.tallerId }, data: { permitirStockNegativo: permitir }, select: { permitirStockNegativo: true } });
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "STOCK_POLICY_CHANGED",
    entityType: "TALLER",
    entityId: actor.tallerId,
    descripcion: permitir ? "Se habilitó el stock negativo" : "Se deshabilitó el stock negativo",
    oldValue: { permitirStockNegativo: current.permitirStockNegativo },
    newValue: { permitirStockNegativo: updated.permitirStockNegativo },
  });
  return updated;
}

// ---------------------------------------------------------------------------------------------------------------
// Órdenes de trabajo
// ---------------------------------------------------------------------------------------------------------------

/** Ítems de la orden (solo los vinculados a un producto) y lo descontado por la orden según el libro, por producto. */
async function loadOrderStock(tx: Tx, actor: StockActor, workOrderId: string) {
  const items = await tx.workOrderItem.findMany({ where: { workOrderId, productId: { not: null } }, select: { productId: true, cantidad: true } });
  const ledger = await tx.stockMovement.groupBy({
    by: ["productId"],
    where: { workOrderId, tallerId: actor.tallerId, tipo: { in: ["SALIDA_ORDEN", "DEVOLUCION"] } },
    _sum: { cantidad: true },
  });
  return {
    desired: sumByProduct(items),
    // Neto consumido = -(salidas + devoluciones): las salidas son negativas y las devoluciones positivas
    consumed: new Map(ledger.map((l) => [l.productId, (l._sum.cantidad ?? D(0)).negated()])),
  };
}

async function loadOrderOrThrow(tx: Tx, actor: StockActor, workOrderId: string) {
  const order = await tx.workOrder.findFirst({ where: { id: workOrderId, tallerId: actor.tallerId }, select: { id: true, status: true } });
  if (!order) throw new BusinessError("Orden de trabajo no encontrada.", 404);
  return order;
}

/**
 * Registra el descuento que falta para que lo descontado en el libro alcance lo que piden los ítems de la orden.
 * Es idempotente: repetirla (reintento, doble clic, cambio de estado repetido) no genera movimientos nuevos.
 * Solo descuenta: nunca repone. Debe llamarse dentro de una transacción; toma el bloqueo de la orden.
 */
export async function reconcileOrderStock(tx: Tx, actor: StockActor, workOrderId: string) {
  await lockWorkOrder(tx, workOrderId); // 1) la orden
  await loadOrderOrThrow(tx, actor, workOrderId);
  const { desired, consumed } = await loadOrderStock(tx, actor, workOrderId);
  const plan = planOrderStockMovements(desired, consumed);
  if (plan.length === 0) return [];

  await lockProducts(tx, plan.map((p) => p.productId)); // 2) los productos, por id ascendente
  const products = new Map((await tx.product.findMany({ where: { id: { in: plan.map((p) => p.productId) }, tallerId: actor.tallerId } })).map((p) => [p.id, p]));
  for (const p of plan) if (!products.has(p.productId)) throw new BusinessError("Producto no encontrado.", 404);

  const shortages: Shortage[] = [];
  if (!(await allowsNegativeStock(tx, actor.tallerId))) {
    for (const p of plan) {
      const product = products.get(p.productId)!;
      if (product.stockActual.plus(p.cantidad).isNegative()) {
        shortages.push({ nombre: product.nombre, unidad: product.unidad, disponible: product.stockActual, necesario: p.cantidad.abs() });
      }
    }
  }
  if (shortages.length > 0) throw new BusinessError(shortageMessage(shortages), 409);

  const created = [];
  for (const p of plan) {
    const product = products.get(p.productId)!;
    const movement = await insertMovement(tx, {
      actor,
      productId: p.productId,
      workOrderId,
      tipo: "SALIDA_ORDEN",
      cantidad: p.cantidad,
      motivo: "Consumo por orden de trabajo",
      costoUnitario: product.costo,
    });
    created.push(movement);
    await logAudit(tx, {
      tallerId: actor.tallerId,
      userId: actor.userId,
      accion: "STOCK_CONSUMED",
      entityType: "STOCK_MOVEMENT",
      entityId: movement.id,
      descripcion: `Descuento de ${p.cantidad.abs().toString()} ${product.nombre} (orden ${workOrderId.slice(-6)})`,
      newValue: { workOrderId, productId: p.productId, cantidad: p.cantidad.toNumber(), stockResultante: movement.stockResultante.toNumber() },
    });
  }
  return created;
}

/** Resumen de stock de una orden por producto: solicitado, consumido, devuelto y excedente devolvible. */
export async function getOrderStockSummary(tx: Tx, actor: StockActor, workOrderId: string) {
  const order = await loadOrderOrThrow(tx, actor, workOrderId);
  const { desired, consumed } = await loadOrderStock(tx, actor, workOrderId);
  const lines = orderStockBalance(desired, consumed);
  const ids = lines.map((l) => l.productId);
  const products = await tx.product.findMany({ where: { id: { in: ids }, tallerId: actor.tallerId }, select: { id: true, nombre: true, unidad: true, stockActual: true } });
  const returns = await tx.stockMovement.groupBy({ by: ["productId"], where: { workOrderId, tallerId: actor.tallerId, tipo: "DEVOLUCION" }, _sum: { cantidad: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const returned = new Map(returns.map((r) => [r.productId, r._sum.cantidad ?? D(0)]));
  return {
    estado: order.status,
    consumeStock: consumesStock(order.status),
    productos: lines.map((l) => ({
      productId: l.productId,
      nombre: byId.get(l.productId)?.nombre ?? "Producto",
      unidad: byId.get(l.productId)?.unidad ?? "UNIDAD",
      stockActual: byId.get(l.productId)?.stockActual ?? D(0),
      solicitado: l.solicitado,
      consumido: l.consumido,
      devuelto: returned.get(l.productId) ?? D(0),
      excedente: l.excedente,
    })),
  };
}

/**
 * Devolución explícita al stock: unidades físicamente recuperadas de una orden. Solo se puede devolver el excedente
 * (lo descontado que los ítems actuales ya no piden); lo que los ítems siguen pidiendo no se devuelve: primero hay que
 * reducir o quitar el ítem. Queda en el libro con cantidad y motivo, y en la auditoría con el usuario.
 */
export async function returnToStock(tx: Tx, actor: StockActor, input: { workOrderId: string; productId: string; cantidad: number; motivo: string }) {
  await lockWorkOrder(tx, input.workOrderId); // 1) la orden
  await loadOrderOrThrow(tx, actor, input.workOrderId);
  const product = await getProductOrThrow(tx, actor.tallerId, input.productId);
  await lockProducts(tx, [product.id]); // 2) el producto
  const { desired, consumed } = await loadOrderStock(tx, actor, input.workOrderId);
  const line = orderStockBalance(desired, consumed).find((l) => l.productId === product.id);
  if (!line || line.consumido.lte(0)) {
    throw new BusinessError(`La orden no descontó "${product.nombre}" del stock: no hay nada para devolver.`, 409);
  }
  const pedido = D(input.cantidad);
  if (pedido.gt(line.excedente)) {
    throw new BusinessError(
      line.excedente.isZero()
        ? `Los ítems de la orden todavía piden ${formatQuantity(line.solicitado, product.unidad)} de "${product.nombre}": no hay unidades sobrantes para devolver. Reducí o quitá el ítem primero.`
        : `Solo se pueden devolver hasta ${formatQuantity(line.excedente, product.unidad)} de "${product.nombre}": el resto sigue pedido en los ítems de la orden.`,
      409
    );
  }
  const movement = await insertMovement(tx, {
    actor,
    productId: product.id,
    workOrderId: input.workOrderId,
    tipo: "DEVOLUCION",
    cantidad: pedido,
    motivo: input.motivo,
    costoUnitario: product.costo,
  });
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "STOCK_RETURNED",
    entityType: "STOCK_MOVEMENT",
    entityId: movement.id,
    descripcion: `Devolución de ${input.cantidad} ${product.nombre} (orden ${input.workOrderId.slice(-6)}). Motivo: ${input.motivo}`,
    newValue: { workOrderId: input.workOrderId, productId: product.id, cantidad: input.cantidad, motivo: input.motivo, stockResultante: movement.stockResultante.toNumber() },
  });
  return movement;
}
