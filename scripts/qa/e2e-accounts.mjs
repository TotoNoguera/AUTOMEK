// Verifica en QA el alta de talleres e identidades: inicio de sesión, aislamiento entre talleres, logo de cada uno en los
// documentos y suficiencia de los datos de la DEMO. Requiere los talleres creados con scripts/accounts/* en la base de QA:
//   MARIA_EMAIL (taller "San Rafael"), DEMO_EMAIL (taller "Taller", sembrado) y la cuenta de QA "qa-alfa" como tercer taller.
//   npm run qa:dev   (otra terminal)   y   MARIA_EMAIL=... DEMO_EMAIL=... npm run qa:e2e:accounts
import { createChecker, createPrisma, loginAs, round2, target } from "./lib/common.mjs";

const { check, info, section, finish } = createChecker();
const MARIA = process.env.MARIA_EMAIL;
const DEMO = process.env.DEMO_EMAIL;
if (!MARIA || !DEMO) throw new Error("Definí MARIA_EMAIL y DEMO_EMAIL (cuentas de QA).");
const db = createPrisma();
console.log(`[QA] e2e-accounts: endpoint=${target.endpoint}`);

const M = await loginAs(db, MARIA);
const D = await loginAs(db, DEMO);
const A = await loginAs(db, "qa-alfa@example.invalid");
check(true, "las tres cuentas inician sesión (San Rafael, Taller demo y QA Alfa)");

const tallerOf = async (email) => (await db.userTaller.findMany({ where: { user: { email } }, include: { taller: true } }));
for (const email of [MARIA, DEMO, "qa-alfa@example.invalid"]) {
  const t = await tallerOf(email);
  check(t.length === 1, `${email.split("@")[0]}: vinculada a exactamente 1 taller`, String(t.length));
}
const tM = (await tallerOf(MARIA))[0].taller, tD = (await tallerOf(DEMO))[0].taller, tA = (await tallerOf("qa-alfa@example.invalid"))[0].taller;
check(new Set([tM.id, tD.id, tA.id]).size === 3, "los tres talleres son distintos e independientes");

section("1) Identidad de cada taller (nombre y logo propios)");
let r = await M("GET", "/api/taller"); check(r.s === 200 && r.d.nombre === "San Rafael" && r.d.logo === "/logos/san-rafael.png", "San Rafael: nombre y logo propios", JSON.stringify(r.d));
r = await D("GET", "/api/taller"); check(r.s === 200 && r.d.nombre === "Taller" && r.d.logo === "/logos/taller-demo.svg", "Demo: nombre 'Taller' y su logo genérico", JSON.stringify(r.d));
r = await A("GET", "/api/taller"); check(r.s === 200 && r.d.logo === null, "QA Alfa (sin logo): sigue sin logo", JSON.stringify(r.d));
check(tM.logo !== tD.logo, "San Rafael y Demo no comparten logo");

section("2) Aislamiento entre las tres cuentas");
const sample = async (api) => ({
  client: (await api("GET", "/api/clients")).d,
  vehicle: (await api("GET", "/api/vehicles")).d,
  quote: (await api("GET", "/api/quotes")).d,
  order: (await api("GET", "/api/work-orders")).d,
  product: (await api("GET", "/api/products?estado=todos&limit=200")).d,
});
const idsOf = (d) => (Array.isArray(d) ? d : d?.clients ?? d?.vehicles ?? d?.quotes ?? d?.workOrders ?? d?.products ?? []).map((x) => x.id);
const sD = await sample(D);
const sA = await sample(A);
const sM = await sample(M);
// Cada registro que ve una cuenta pertenece a SU taller (en QA, San Rafael puede tener datos de corridas anteriores)
const tablaDe = { client: "clients", vehicle: "vehicles", quote: "quotes", order: "work_orders", product: "products" };
for (const [who, sampleOf, taller] of [["San Rafael", sM, tM], ["Demo", sD, tD], ["QA Alfa", sA, tA]]) {
  let ajenos = 0;
  let vistos = 0;
  for (const k of Object.keys(tablaDe)) {
    const ids = idsOf(sampleOf[k]);
    vistos += ids.length;
    if (ids.length) ajenos += Number((await db.$queryRawUnsafe(`SELECT count(*)::int n FROM ${tablaDe[k]} WHERE id = ANY($1) AND "tallerId" <> $2`, ids, taller.id))[0].n);
  }
  check(ajenos === 0, `${who}: los ${vistos} registros que ve (clientes, vehículos, presupuestos, órdenes y productos) son todos de su taller`, String(ajenos));
}
const overlap = ["client", "vehicle", "quote", "order", "product"].filter((k) => idsOf(sD[k]).some((id) => idsOf(sA[k]).includes(id)));
check(overlap.length === 0, "Demo y QA Alfa no comparten ningún registro en los listados", overlap.join());
const demoIds = { client: idsOf(sD.client)[0], vehicle: idsOf(sD.vehicle)[0], quote: idsOf(sD.quote)[0], order: idsOf(sD.order)[0], product: idsOf(sD.product)[0] };
const path = { client: "/api/clients/", vehicle: "/api/vehicles/", quote: "/api/quotes/", order: "/api/work-orders/", product: "/api/products/" };
for (const [who, api] of [["San Rafael", M], ["QA Alfa", A]]) {
  for (const k of Object.keys(path)) { r = await api("GET", path[k] + demoIds[k]); check(r.s === 404, `${who} no puede leer ${k} de la Demo -> 404`, r.s); }
}
const alfaIds = { client: idsOf(sA.client)[0], order: idsOf(sA.order)[0] };
for (const [who, api] of [["San Rafael", M], ["Demo", D]]) {
  r = await api("GET", "/api/clients/" + alfaIds.client); check(r.s === 404, `${who} no puede leer un cliente de QA Alfa -> 404`, r.s);
  r = await api("GET", "/api/work-orders/" + alfaIds.order + "/stock"); check(r.s === 404, `${who} no puede ver el stock de una orden de QA Alfa -> 404`, r.s);
}
r = await D("POST", "/api/work-orders", { clientId: alfaIds.client, vehicleId: idsOf(sA.vehicle)[0], motivoIngreso: "x", items: [{ descripcion: "x", cantidad: 1, precioUnitario: 1 }] }); check(r.s === 404, "la Demo no puede crear una orden con un cliente de otro taller -> 404", r.s);
r = await D("POST", "/api/cash-movements/ingreso", { workOrderId: alfaIds.order, methodId: idsOf((await D("GET", "/api/payment-methods")))[0] ?? "x", monto: 1 }); check(r.s === 404 || r.s === 400, "la Demo no puede cobrar una orden de otro taller", r.s);

section("3) Presupuestos con la identidad de cada taller");
r = await D("GET", "/api/quotes/" + demoIds.quote); check(r.s === 200 && r.d.taller?.nombre === "Taller" && r.d.taller?.logo === "/logos/taller-demo.svg", "presupuesto de la Demo muestra el logo y nombre de la Demo", JSON.stringify(r.d?.taller));
const qA = idsOf(sA.quote)[0];
if (qA) { r = await A("GET", "/api/quotes/" + qA); check(r.s === 200 && r.d.taller?.nombre === tA.nombre && r.d.taller.logo === null, "presupuesto de QA Alfa conserva su identidad (sin logo)", JSON.stringify(r.d?.taller)); }
// Un presupuesto de San Rafael (creado con su propio cliente) usa SU logo
r = await M("POST", "/api/clients", { nombre: "Cliente San Rafael QA" }); const mc = r.d?.id;
r = await M("POST", "/api/vehicles", { clientId: mc, patente: "SR" + String(Date.now()).slice(-5), marca: "Ford", modelo: "Ka", anio: 2018 }); const mv = r.d?.id;
r = await M("POST", "/api/quotes", { clientId: mc, vehicleId: mv, items: [{ descripcion: "Parabrisas delantero", cantidad: 1, precioUnitario: 185000 }] }); const mq = r.d?.id;
r = await M("GET", "/api/quotes/" + mq); check(r.s === 200 && r.d.taller?.nombre === "San Rafael" && r.d.taller.logo === "/logos/san-rafael.png", "presupuesto de San Rafael muestra el logo de San Rafael", JSON.stringify(r.d?.taller));
r = await M("GET", "/api/quotes/" + mq); check(r.d?.taller?.logo !== tD.logo && r.d?.taller?.logo !== tA.logo, "y nunca el de otro taller");

section("4) La Demo tiene datos suficientes para recorrer todo el sistema");
const count = async (sql) => Number((await db.$queryRawUnsafe(sql))[0].n);
const T = `'${tD.id}'`;
const n = {
  clientes: await count(`SELECT count(*)::int n FROM clients WHERE "tallerId"=${T}`),
  vehiculos: await count(`SELECT count(*)::int n FROM vehicles WHERE "tallerId"=${T}`),
  tecnicos: await count(`SELECT count(*)::int n FROM technicians WHERE "tallerId"=${T}`),
  productos: await count(`SELECT count(*)::int n FROM products WHERE "tallerId"=${T}`),
  movStock: await count(`SELECT count(*)::int n FROM stock_movements WHERE "tallerId"=${T}`),
  turnosHoy: await count(`SELECT count(*)::int n FROM schedules WHERE "tallerId"=${T} AND fecha = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date`),
  cierres: await count(`SELECT count(*)::int n FROM daily_closes WHERE "tallerId"=${T}`),
  reversiones: await count(`SELECT count(*)::int n FROM cash_movements WHERE "tallerId"=${T} AND categoria='REVERSION'`),
  anulados: await count(`SELECT count(*)::int n FROM payments WHERE "tallerId"=${T} AND status='ANULADO'`),
  auditoria: await count(`SELECT count(*)::int n FROM audit_logs WHERE "tallerId"=${T} AND "userId" IS NOT NULL`),
};
info(JSON.stringify(n));
check(n.clientes >= 12 && n.vehiculos >= 14 && n.tecnicos >= 3, "clientes, vehículos y técnicos", JSON.stringify(n));
check(n.productos >= 14 && n.movStock >= 30, "productos y movimientos de stock", JSON.stringify(n));
check(n.turnosHoy >= 3, "turnos para hoy", String(n.turnosHoy));
check(n.cierres >= 10 && n.reversiones >= 1 && n.anulados >= 1, "cierres de caja y una anulación contable", JSON.stringify(n));
check(n.auditoria >= 100, "auditoría con usuario", String(n.auditoria));
const byStatus = Object.fromEntries((await db.$queryRawUnsafe(`SELECT status, count(*)::int n FROM work_orders WHERE "tallerId"=${T} GROUP BY 1`)).map((x) => [x.status, x.n]));
check(["APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"].every((s) => byStatus[s] > 0), "órdenes en todos los estados del flujo", JSON.stringify(byStatus));
const qStatus = Object.fromEntries((await db.$queryRawUnsafe(`SELECT status, count(*)::int n FROM quotes WHERE "tallerId"=${T} GROUP BY 1`)).map((x) => [x.status, x.n]));
check(["PENDIENTE", "APROBADO", "RECHAZADO"].every((s) => qStatus[s] > 0), "presupuestos pendientes, aprobados y rechazados", JSON.stringify(qStatus));
r = await D("GET", "/api/dashboard/stats"); check(r.s === 200 && r.d.ordenesActivas > 0 && r.d.cobrosMes > 0 && r.d.deudasPendientes > 0 && r.d.stockBajo.total >= 3, "el dashboard muestra actividad, cobros, deudas y stock bajo", JSON.stringify({ a: r.d?.ordenesActivas, c: r.d?.cobrosMes, d: r.d?.deudasPendientes, s: r.d?.stockBajo?.total }));
r = await D("GET", "/api/debts"); check(r.s === 200 && JSON.stringify(r.d).length > 200, "la pantalla de deudas tiene contenido", r.s);
for (const p of ["/api/cash-movements", "/api/daily-closes", "/api/schedules", "/api/technicians", "/api/goals", "/api/costs", "/api/reports/pnl", "/api/audit-logs", "/api/payment-methods"]) { r = await D("GET", p); check(r.s === 200, `GET ${p}`, r.s); }

section("5) Integridad de los datos de la Demo");
const bad1 = await count(`SELECT count(*)::int n FROM work_orders w WHERE w."tallerId"=${T} AND round(w.total::numeric,2) <> round(coalesce((SELECT sum(subtotal) FROM work_order_items i WHERE i."workOrderId"=w.id),0)::numeric,2)`);
check(bad1 === 0, "total de cada orden = suma de sus ítems", String(bad1));
const bad2 = await count(`SELECT count(*)::int n FROM quotes q WHERE q."tallerId"=${T} AND round(q.total::numeric,2) <> round(coalesce((SELECT sum(subtotal) FROM quote_items i WHERE i."quoteId"=q.id),0)::numeric,2)`);
check(bad2 === 0, "total de cada presupuesto = suma de sus ítems", String(bad2));
const bad3 = await count(`SELECT count(*)::int n FROM work_orders w WHERE w."tallerId"=${T} AND round(coalesce((SELECT sum(monto) FROM payments p WHERE p."workOrderId"=w.id AND p.status='PAGADO'),0)::numeric,2) <> round((coalesce((SELECT sum(monto) FROM cash_movements m WHERE m."workOrderId"=w.id AND m.tipo='INGRESO'),0) + coalesce((SELECT sum(p.monto) FROM payments p JOIN payment_methods pm ON pm.id=p."methodId" WHERE p."workOrderId"=w.id AND p.status='PAGADO' AND pm.tipo='CUENTA_CORRIENTE'),0))::numeric,2)`);
check(bad3 === 0, "pagos cobrados = movimientos de caja + cuenta corriente, en cada orden", String(bad3));
const closes = await db.dailyClose.findMany({ where: { tallerId: tD.id }, orderBy: { fecha: "asc" } });
let chainOk = true;
for (let i = 0; i < closes.length; i++) {
  const c = closes[i];
  if (round2(c.saldoInicial + c.totalIngresos - c.totalEgresos) !== c.saldoFinal) chainOk = false;
  if (i > 0 && closes[i - 1].saldoFinal !== c.saldoInicial) chainOk = false;
}
check(chainOk, `los ${closes.length} cierres diarios encadenan (inicial + ingresos − egresos = final y final = inicial del siguiente)`);
const bad4 = await count(`SELECT count(*)::int n FROM products p WHERE p."tallerId"=${T} AND p."stockActual" <> coalesce((SELECT sum(cantidad) FROM stock_movements m WHERE m."productId"=p.id),0)`);
check(bad4 === 0, "stock de cada producto = suma de su libro de movimientos", String(bad4));
const bad5 = await count(`SELECT count(*)::int n FROM products WHERE "tallerId"=${T} AND "stockActual" < 0`);
check(bad5 === 0, "ningún producto con stock negativo");
const credit = await db.clientCredit.findMany({ where: { tallerId: tD.id } });
check(credit.some((c) => c.saldo < 0), "hay una cuenta corriente con deuda");
const leak = await count(`SELECT count(*)::int n FROM stock_movements m JOIN products p ON p.id=m."productId" WHERE m."tallerId"=${T} AND p."tallerId" <> ${T}`);
check(leak === 0, "ningún movimiento de la Demo toca productos de otro taller");

section("6) La demo se puede probar sin riesgo para los datos reales");
r = await D("POST", "/api/clients", { nombre: "Visitante de prueba " + Date.now() }); check(r.s === 201, "un visitante puede crear datos en la Demo", r.s);
const mt = await db.taller.findFirst({ where: { nombre: { contains: "MT", mode: "insensitive" } } });
check(!mt || tD.id !== mt.id, "la Demo no es el taller de MT Mecánica");
r = await D("GET", "/api/audit-logs"); const logs = r.d?.logs ?? r.d?.items ?? r.d;
check(Array.isArray(logs) && logs.every((l) => !l.tallerId || l.tallerId === tD.id), "la auditoría de la Demo solo muestra eventos de la Demo");

finish();
await db.$disconnect();
