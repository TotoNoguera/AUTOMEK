// Siembra de la base de QA con datos ficticios que reproducen escenarios reales de AUTOMEK. Se hace A TRAVÉS DE LA
// APLICACIÓN (HTTP), así que además es una prueba de lectura y escritura de clientes, vehículos, presupuestos, órdenes,
// pagos, cuenta corriente y cierres.
//
//   1) npm run qa:prisma -- migrate deploy      (aplica las migraciones en la base de QA)
//   2) npm run qa:dev                           (en otra terminal: la app en http://localhost:3002)
//   3) npm run qa:seed
//
// Crea dos talleres: "QA Taller Alfa" (queda con la caja operativa) y "QA Taller Beta" (cierra la caja de hoy).
// No es re-ejecutable sobre la misma base: si ya está sembrada, se detiene sin tocar nada.
import { BASE_URL, createChecker, createPrisma, loginAs, round2, target, todayAR } from "./lib/common.mjs";

const { check, section, finish } = createChecker();
const db = createPrisma();
console.log(`[QA] siembra en endpoint=${target.endpoint} usando la app de ${BASE_URL}`);

const ACCOUNTS = [
  { key: "alfa", email: "qa-alfa@example.invalid", name: "QA Alfa", taller: "QA Taller Alfa" },
  { key: "beta", email: "qa-beta@example.invalid", name: "QA Beta", taller: "QA Taller Beta" },
];
if ((await db.client.count({ where: { taller: { nombre: { in: ACCOUNTS.map((a) => a.taller) } } } })) > 0) {
  console.log("[QA] La base ya está sembrada (hay clientes en los talleres de QA). No se hace nada.");
  await db.$disconnect();
  process.exit(0);
}

// Cuentas y talleres (el registro público está deshabilitado: se crean directo en la base de QA)
for (const a of ACCOUNTS) {
  const user = await db.user.upsert({ where: { email: a.email }, update: {}, create: { email: a.email, name: a.name, password: "se-reemplaza-al-iniciar-sesion" } });
  const existing = await db.userTaller.findFirst({ where: { userId: user.id } });
  if (!existing) {
    const taller = await db.taller.create({ data: { nombre: a.taller } });
    await db.userTaller.create({ data: { userId: user.id, tallerId: taller.id } });
  }
}
const A = await loginAs(db, ACCOUNTS[0].email);
const B = await loginAs(db, ACCOUNTS[1].email);
const ids = {};
const items = (...rows) => rows.map(([descripcion, cantidad, precioUnitario]) => ({ descripcion, cantidad, precioUnitario }));
const totalOf = (its) => round2(its.reduce((s, i) => s + round2(i.cantidad * i.precioUnitario), 0));
let r;

section("Clientes y vehículos");
r = await A("POST", "/api/clients", { nombre: "Juan Pérez QA", telefono: "+54 9 11 5555-1234", email: "juan.qa@example.invalid", direccion: "Calle Falsa 123" }); check(r.s === 201, "cliente con teléfono, email y dirección", r.s); ids.c1 = r.d?.id;
r = await A("POST", "/api/clients", { nombre: "María Gómez QA" }); check(r.s === 201, "cliente solo con nombre", r.s); ids.c2 = r.d?.id;
r = await A("POST", "/api/clients", { nombre: "Cliente Cuenta Corriente QA", telefono: "011 4444-0000" }); check(r.s === 201, "cliente de cuenta corriente", r.s); ids.c3 = r.d?.id;
r = await A("POST", "/api/clients", { nombre: "Otro Nombre", email: "juan.qa@example.invalid" }); check(r.s === 409, "cliente duplicado por email -> 409", r.s);
r = await A("POST", "/api/vehicles", { clientId: ids.c1, patente: "ab 123-cd", marca: "Ford", modelo: "Focus", anio: 2019, kilometraje: 85000 }); check(r.s === 201 && r.d?.patente === "AB123CD", "vehículo con patente normalizada", `${r.s} ${r.d?.patente}`); ids.v1 = r.d?.id;
r = await A("POST", "/api/vehicles", { clientId: ids.c2, patente: "AC456DE", marca: "VW", modelo: "Gol", anio: 2015 }); check(r.s === 201, "segundo vehículo", r.s); ids.v2 = r.d?.id;
r = await A("POST", "/api/vehicles", { clientId: ids.c3, patente: "ZZ999ZZ", marca: "Fiat", modelo: "Uno", anio: 2010 }); check(r.s === 201, "tercer vehículo", r.s); ids.v3 = r.d?.id;
r = await A("POST", "/api/vehicles", { clientId: ids.c2, patente: "AB123CD", marca: "X", modelo: "Y", anio: 2000 }); check(r.s === 409, "patente duplicada en el taller -> 409", r.s);
r = await B("POST", "/api/clients", { nombre: "Cliente Beta QA" }); check(r.s === 201, "Beta: cliente", r.s); ids.b1 = r.d?.id;
r = await B("POST", "/api/vehicles", { clientId: ids.b1, patente: "AB123CD", marca: "Ford", modelo: "Focus", anio: 2019 }); check(r.s === 201, "Beta: la misma patente en otro taller se permite", r.s); ids.bv1 = r.d?.id;

section("Presupuestos y órdenes");
const q1 = items(["Cambio de aceite", 4, 2500.5], ["Filtro de aceite", 1, 3200], ["Mano de obra", 1, 8000]);
r = await A("POST", "/api/quotes", { clientId: ids.c1, vehicleId: ids.v1, items: q1, observaciones: "QA" }); check(r.s === 201 && r.d?.total === totalOf(q1), "presupuesto con total exacto", `${r.s} ${r.d?.total}`); ids.q1 = r.d?.id;
r = await A("PATCH", `/api/quotes/${ids.q1}`, { status: "APROBADO" }); check(r.s === 200, "aprobar presupuesto", r.s);
const q2 = items(["Pastillas de freno", 2, 12000], ["Mano de obra", 1, 6000]);
r = await A("POST", "/api/quotes", { clientId: ids.c2, vehicleId: ids.v2, items: q2 }); check(r.s === 201, "segundo presupuesto", r.s); ids.q2 = r.d?.id;
r = await A("PATCH", `/api/quotes/${ids.q2}`, { status: "RECHAZADO" }); check(r.s === 200, "rechazar presupuesto", r.s);
r = await A("POST", "/api/quotes", { clientId: ids.c3, vehicleId: ids.v3, items: items(["Correa de distribución", 1, 45000]) }); ids.q3 = r.d?.id;
r = await A("PATCH", `/api/quotes/${ids.q3}`, { status: "APROBADO" }); check(r.s === 200, "tercer presupuesto aprobado (queda sin convertir)", r.s);
r = await A("POST", "/api/work-orders", { clientId: ids.c1, vehicleId: ids.v1, quoteId: ids.q1, motivoIngreso: "Service 85.000 km", kmIngreso: 85000, items: q1 }); check(r.s === 201 && r.d?.total === totalOf(q1), "orden desde presupuesto aprobado", `${r.s} ${r.d?.total}`); ids.w1 = r.d?.id;
const w2 = items(["Cambio de pastillas", 2, 12000], ["Rectificado de discos", 2, 4500], ["Mano de obra", 1, 9000]);
r = await A("POST", "/api/work-orders", { clientId: ids.c2, vehicleId: ids.v2, motivoIngreso: "Ruido al frenar", items: w2 }); check(r.s === 201, "orden directa", r.s); ids.w2 = r.d?.id;
r = await A("POST", "/api/work-orders", { clientId: ids.c3, vehicleId: ids.v3, motivoIngreso: "Luz de motor", items: items(["Diagnóstico electrónico", 1, 15000]) }); check(r.s === 201, "orden para cuenta corriente", r.s); ids.w3 = r.d?.id;
for (const st of ["EN_PROCESO", "TERMINADA"]) { r = await A("PUT", `/api/work-orders/${ids.w1}/status`, { status: st }); check(r.s === 200, `orden 1 -> ${st}`, r.s); }
r = await A("POST", "/api/schedules", { clientId: ids.c2, vehicleId: ids.v2, fecha: todayAR(), hora: "10:30", motivo: "Revisión QA" }); check(r.s === 201, "turno", r.s); ids.s1 = r.d?.id;
r = await A("POST", `/api/schedules/${ids.s1}/to-work-order`, { motivoIngreso: "Revisión QA", items: items(["Revisión general", 1, 7000], ["Aceite 5W30", 3, 4000]) }); check(r.s === 201, "turno convertido en orden", r.s);

section("Pagos, cuenta corriente y caja");
r = await A("GET", "/api/payment-methods"); const M = Object.fromEntries(r.d.map((m) => [m.tipo, m.id]));
const w1total = totalOf(q1);
const part = round2(w1total * 0.4);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: ids.w1, methodId: M.EFECTIVO, monto: part, descripcion: "Seña" }); check(r.s === 201, "pago parcial en efectivo", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: ids.w1, methodId: M.TRANSFERENCIA, monto: round2(w1total - part) }); check(r.s === 201, "pago del saldo por transferencia", r.s);
r = await A("PUT", `/api/work-orders/${ids.w1}/status`, { status: "ENTREGADA" }); check(r.s === 200, "orden pagada -> ENTREGADA", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: ids.w2, methodId: M.EFECTIVO, monto: 10000 }); check(r.s === 201, "orden 2: pago de $10.000", r.s);
r = await A("POST", "/api/cash-movements/egreso", { categoria: "COMPRA_REPUESTOS", monto: 5000.25, descripcion: "Compra QA" }); check(r.s === 201, "egreso", r.s);
const movs = (await A("GET", "/api/cash-movements")).d;
const pay = (movs.movements ?? movs).find((m) => m.workOrderId === ids.w2 && m.categoria === "PAGO_ORDEN");
r = await A("POST", `/api/payments/${pay?.paymentId}/annul`, { motivo: "Pago cargado por error (QA)" }); check(r.s === 200 || r.s === 201, "anulación contable de un pago", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: ids.w2, methodId: M.TRANSFERENCIA, monto: 6000 }); check(r.s === 201, "orden 2: nuevo pago", r.s);
r = await A("POST", "/api/cash-movements/ingreso", { workOrderId: ids.w3, methodId: M.CUENTA_CORRIENTE, monto: 15000 }); check(r.s === 201, "cargo a cuenta corriente", r.s);
r = await A("POST", `/api/clients/${ids.c3}/credit/payment`, { monto: 5000 }); check(r.s === 200 || r.s === 201, "cobro de deuda", r.s);
r = await B("POST", "/api/work-orders", { clientId: ids.b1, vehicleId: ids.bv1, motivoIngreso: "Service Beta", items: items(["Service", 1, 20000]) }); ids.bw1 = r.d?.id;
r = await B("GET", "/api/payment-methods"); const bEf = r.d.find((m) => m.tipo === "EFECTIVO").id;
r = await B("POST", "/api/cash-movements/ingreso", { workOrderId: ids.bw1, methodId: bEf, monto: 12000 }); check(r.s === 201, "Beta: pago", r.s);
r = await B("POST", "/api/cash-movements/egreso", { categoria: "GASTO_OTROS", monto: 2000 }); check(r.s === 201, "Beta: egreso", r.s);
r = await B("POST", "/api/daily-closes", { fecha: todayAR(), notas: "Cierre QA" }); check(r.s === 201, "Beta: cierre de la caja de hoy", r.s);
r = await B("POST", "/api/cash-movements/egreso", { categoria: "GASTO_OTROS", monto: 100 }); check(r.s === 409, "Beta: movimiento en día cerrado -> 409", r.s);

section("Aislamiento entre talleres");
for (const [name, p] of [["cliente", `/api/clients/${ids.c1}`], ["vehículo", `/api/vehicles/${ids.v1}`], ["presupuesto", `/api/quotes/${ids.q1}`], ["orden", `/api/work-orders/${ids.w1}`]]) {
  r = await B("GET", p); check(r.s === 404, `Beta no puede leer ${name} de Alfa -> 404`, r.s);
}

const counts = {};
for (const [n, m] of [["clientes", "client"], ["vehículos", "vehicle"], ["presupuestos", "quote"], ["órdenes", "workOrder"], ["pagos", "payment"], ["movimientos de caja", "cashMovement"], ["cierres", "dailyClose"], ["auditorías", "auditLog"]]) counts[n] = await db[m].count();
console.log("\nDatos creados:", JSON.stringify(counts));
finish();
await db.$disconnect();
