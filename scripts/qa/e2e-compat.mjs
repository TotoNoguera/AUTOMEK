// Regresión de punta a punta (lectura y escritura) de los flujos existentes de AUTOMEK contra la base de QA, con la app que
// esté escuchando en QA_APP_URL (por defecto http://localhost:3002).
//
// Sirve para dos cosas:
//   * regresión del código actual (npm run qa:dev) contra el schema actual o el migrado;
//   * compatibilidad del código ya desplegado contra un schema nuevo (npm run qa:serve-head en lugar de qa:dev).
// Es re-ejecutable (sufijos únicos). Si la base tiene los datos de `npm run qa:seed`, también lee esos datos heredados.
import { BASE_URL, createChecker, createPrisma, loginAs, randomHex, round2, target, todayAR, viaPooler } from "./lib/common.mjs";

const { check, info, section, finish } = createChecker();
const db = createPrisma();
const SUF = randomHex(3);
const PLATE = "Q" + randomHex(3).toUpperCase();
console.log(`[QA] e2e-compat: endpoint=${target.endpoint} vía ${viaPooler ? "POOLER" : "conexión directa"}, app=${BASE_URL}`);

const A = await loginAs(db, "qa-alfa@example.invalid");
const B = await loginAs(db, "qa-beta@example.invalid");
const alfa = await db.userTaller.findFirst({ where: { user: { email: "qa-alfa@example.invalid" } } });
const items = (...rows) => rows.map(([descripcion, cantidad, precioUnitario]) => ({ descripcion, cantidad, precioUnitario }));
const totalOf = (its) => round2(its.reduce((s, i) => s + round2(i.cantidad * i.precioUnitario), 0));
let r;

section("A) Lectura de datos heredados");
const oldQuote = await db.quote.findFirst({ where: { tallerId: alfa.tallerId, status: "APROBADO", workOrder: { isNot: null } }, include: { items: true } });
if (oldQuote) {
  r = await A("GET", `/api/quotes/${oldQuote.id}`);
  check(r.s === 200 && r.d.items.length === oldQuote.items.length && r.d.items.every((i) => typeof i.cantidad === "number"), "presupuesto heredado: ítems con cantidad numérica", `${r.s} ${JSON.stringify(r.d?.items?.[0]?.cantidad)}`);
} else info("sin presupuestos heredados (npm run qa:seed los crea)");
const oldWo = await db.workOrder.findFirst({ where: { tallerId: alfa.tallerId, status: "ENTREGADA" }, include: { items: true } });
if (oldWo) {
  r = await A("GET", `/api/work-orders/${oldWo.id}`);
  check(r.s === 200 && r.d.items.length === oldWo.items.length && r.d.total === oldWo.total, "orden heredada entregada: ítems y total intactos", `${r.s}`);
  r = await A("PUT", `/api/work-orders/${oldWo.id}`, { clientId: oldWo.clientId, vehicleId: oldWo.vehicleId, motivoIngreso: "x", items: items(["x", 1, 1]) });
  check(r.s === 409, "una orden entregada no se puede editar -> 409", r.s);
}
for (const p of ["/api/clients", "/api/vehicles", "/api/quotes", "/api/work-orders", "/api/cash-movements", "/api/debts", "/api/audit-logs", "/api/dashboard/stats", "/api/reports/pnl", "/api/payment-methods", "/api/schedules"]) {
  r = await A("GET", p);
  check(r.s === 200, `GET ${p}`, r.s);
}

section("B) Escritura nueva");
r = await A("POST", "/api/clients", { nombre: `Compat ${SUF}`, email: `compat-${SUF}@example.invalid`, telefono: "+54 9 11 5555-0000" }); check(r.s === 201, "crear cliente", r.s); const c1 = r.d?.id;
r = await A("POST", "/api/clients", { nombre: `Compat CC ${SUF}` }); check(r.s === 201, "crear cliente de cuenta corriente", r.s); const c2 = r.d?.id;
r = await A("POST", "/api/vehicles", { clientId: c1, patente: PLATE, marca: "Ford", modelo: "Ka", anio: 2018 }); check(r.s === 201, "crear vehículo", r.s); const v1 = r.d?.id;
r = await A("POST", "/api/vehicles", { clientId: c2, patente: PLATE, marca: "X", modelo: "Y", anio: 2000 }); check(r.s === 409, "patente duplicada en el taller -> 409", r.s);
r = await A("POST", "/api/vehicles", { clientId: c2, patente: "C" + PLATE.slice(1), marca: "Fiat", modelo: "Uno", anio: 2011 }); check(r.s === 201, "segundo vehículo", r.s); const v2 = r.d?.id;
const q1 = items(["Cambio de aceite", 4, 2500.5], ["Filtro", 1, 3200], ["Mano de obra", 1, 8000]);
r = await A("POST", "/api/quotes", { clientId: c1, vehicleId: v1, items: q1 }); check(r.s === 201 && r.d.total === totalOf(q1), "crear presupuesto (total exacto)", `${r.s} ${r.d?.total}`); const qid = r.d?.id;
r = await A("PATCH", `/api/quotes/${qid}`, { status: "APROBADO" }); check(r.s === 200, "aprobar presupuesto", r.s);
r = await A("POST", "/api/work-orders", { clientId: c1, vehicleId: v1, quoteId: qid, motivoIngreso: "Service", items: q1 }); check(r.s === 201 && r.d.total === totalOf(q1), "convertir en orden", r.s); const wid = r.d?.id;
r = await A("POST", "/api/work-orders", { clientId: c1, vehicleId: v1, quoteId: qid, motivoIngreso: "otra", items: q1 }); check(r.s === 409, "doble conversión -> 409", r.s);
r = await A("POST", `/api/work-orders/${wid}/add-item`, { descripcion: "Extra", cantidad: 2, precioUnitario: 500 }); check(r.s === 201, "agregar ítem", r.s);
const extra = r.d?.items?.find((i) => i.descripcion === "Extra");
r = await A("DELETE", `/api/work-orders/${wid}/items/${extra?.id}`); check(r.s === 200 && r.d.total === totalOf(q1), "quitar ítem", `${r.s} ${r.d?.total}`);
for (const st of ["EN_PROCESO", "TERMINADA"]) { r = await A("PUT", `/api/work-orders/${wid}/status`, { status: st }); check(r.s === 200, `estado -> ${st}`, r.s); }
r = await A("PUT", `/api/work-orders/${wid}/status`, { status: "APROBADA" }); check(r.s === 400, "retroceso de estado -> 400", r.s);
r = await A("GET", "/api/payment-methods"); const M = Object.fromEntries(r.d.map((m) => [m.tipo, m.id]));
const tot = totalOf(q1);
const part = round2(tot * 0.4);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: wid, methodId: M.EFECTIVO, monto: part }); check(r.s === 201, "pago parcial", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: wid, methodId: M.TRANSFERENCIA, monto: round2(tot - part + 1) }); check(r.s === 400 || r.s === 409, "pago de más -> rechazado", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: wid, methodId: M.TRANSFERENCIA, monto: round2(tot - part) }); check(r.s === 201, "pago del saldo", r.s);
r = await A("PUT", `/api/work-orders/${wid}/status`, { status: "ENTREGADA" }); check(r.s === 200, "entregar orden paga", r.s);
r = await A("GET", "/api/cash-movements"); const movs = r.d?.movements ?? r.d;
const pay = movs.find((m) => m.workOrderId === wid && m.categoria === "PAGO_ORDEN");
r = await A("POST", `/api/payments/${pay.paymentId}/annul`, { motivo: "Prueba de anulación de compatibilidad" }); check(r.s === 200 || r.s === 201, "anular pago", r.s);
r = await A("POST", `/api/payments/${pay.paymentId}/annul`, { motivo: "otra vez" }); check(r.s === 409, "doble anulación -> 409", r.s);
r = await A("POST", "/api/cash-movements/egreso", { categoria: "GASTO_OTROS", monto: 1234.56, descripcion: "Compat" }); check(r.s === 201, "egreso", r.s);
r = await A("POST", "/api/work-orders", { clientId: c2, vehicleId: v2, motivoIngreso: "CC", items: items(["Diagnóstico", 1, 15000]) }); check(r.s === 201, "orden para cuenta corriente", r.s); const w2id = r.d?.id;
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: w2id, methodId: M.CUENTA_CORRIENTE, monto: 15000 }); check(r.s === 201, "cargo a cuenta corriente", r.s);
r = await A("POST", `/api/clients/${c2}/credit/payment`, { monto: 5000 }); check(r.s === 200 || r.s === 201, "cobro de deuda", r.s);
r = await A("POST", "/api/schedules", { clientId: c1, vehicleId: v1, fecha: todayAR(), hora: "15:00", motivo: "Compat" }); check(r.s === 201, "crear turno", r.s);
r = await A("POST", `/api/schedules/${r.d?.id}/to-work-order`, { motivoIngreso: "Compat turno", items: items(["Revisión", 1, 7000]) }); check(r.s === 201, "turno -> orden", r.s);

section("C) Caja cerrada, aislamiento y fracciones");
const beta = await db.userTaller.findFirst({ where: { user: { email: "qa-beta@example.invalid" } } });
const bClose = await db.dailyClose.findFirst({ where: { tallerId: beta.tallerId, fecha: new Date(`${todayAR()}T00:00:00.000Z`) } });
if (bClose) { r = await B("POST", "/api/cash-movements/egreso", { categoria: "GASTO_OTROS", monto: 10 }); check(r.s === 409, "la caja cerrada de Beta sigue bloqueando los movimientos de hoy -> 409", r.s); }
r = await B("GET", `/api/work-orders/${wid}`); check(r.s === 404, "Beta no ve la orden de Alfa -> 404", r.s);
if (oldQuote) { r = await B("GET", `/api/quotes/${oldQuote.id}`); check(r.s === 404, "Beta no ve presupuestos de Alfa -> 404", r.s); }
r = await A("POST", "/api/quotes", { clientId: c1, vehicleId: v1, items: items([`Fracción ${SUF}`, 1.5, 1000]) });
const frac = (await db.$queryRawUnsafe(`SELECT cantidad::text c, subtotal FROM quote_items WHERE descripcion = 'Fracción ${SUF}'`))[0];
info(`cantidad 1.5 -> HTTP ${r.s}, guardado: ${frac ? `cantidad=${frac.c} subtotal=${frac.subtotal}` : "nada (rechazado)"}`);
if (frac) check(Number(frac.c) === 1.5 && frac.subtotal === 1500, "una cantidad fraccionaria, si se acepta, se guarda exacta (nunca truncada)", `${frac.c}`);

section("D) Integridad al terminar");
const wos = await db.workOrder.findMany({ where: { tallerId: alfa.tallerId }, include: { items: true } });
check(wos.every((w) => round2(w.items.reduce((s, i) => s + i.subtotal, 0)) === w.total), "total de cada orden = suma de ítems");
check((await db.auditLog.count({ where: { userId: null } })) === 0, "ninguna auditoría sin usuario");
check(!Object.keys(A.statuses).some((s) => Number(s) >= 500), `ninguna respuesta 5xx (${JSON.stringify(A.statuses)})`);

finish();
await db.$disconnect();
