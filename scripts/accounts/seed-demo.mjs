// Datos ficticios y realistas para la cuenta DEMO ("Taller"): clientes, vehículos, productos con stock, presupuestos,
// órdenes de trabajo con historial, pagos, deudas, cuenta corriente, caja con cierres diarios, turnos, técnicos,
// objetivos, costos y auditoría. Todo relativo a la fecha de hoy (hora argentina), así que la demo siempre se ve "viva".
//
//   DEMO_EMAIL=... DATABASE_URL=... ACCOUNTS_EXPECT_ENDPOINT=ep-... node scripts/accounts/seed-demo.mjs [--apply] [--reset]
//
// Seguridad:
//  - Solo escribe en el taller vinculado a DEMO_EMAIL y SOLO si se llama "Taller" (nunca en un taller real).
//  - Sin --apply solo simula. Si el taller ya tiene datos no hace nada (idempotente), salvo --reset.
//  - --reset borra únicamente los datos de ESE taller (incluido el libro de stock, deshabilitando el trigger de
//    inmutabilidad dentro de la transacción) y vuelve a sembrar. Pensado para restaurar la demo tras una visita.
import { at, addDays, closeDate, cid, connect, dayOfWeek, isEmail, isProtectedTaller, normalizeEmail, round2, todayAR } from "./lib.mjs";

const apply = process.argv.includes("--apply");
const reset = process.argv.includes("--reset");
const DEMO_NOMBRE = "Taller";
const email = normalizeEmail(process.env.DEMO_EMAIL);
if (!isEmail(email)) throw new Error("DEMO_EMAIL ausente o inválido.");

const { db, endpoint, database } = connect();
console.log(`[demo] destino: endpoint=${endpoint} base=${database} | modo=${apply ? "APLICAR" : "simulación"}${reset ? " + RESET" : ""}`);

const user = await db.user.findUnique({ where: { email }, include: { userTallers: { include: { taller: true } } } });
if (!user || user.userTallers.length !== 1) throw new Error("El usuario DEMO no existe o no tiene exactamente un taller. Creálo primero con provision.mjs.");
const taller = user.userTallers[0].taller;
if (taller.nombre !== DEMO_NOMBRE || isProtectedTaller(taller.nombre)) throw new Error(`El taller vinculado se llama "${taller.nombre}", no "${DEMO_NOMBRE}": se detiene para no tocar un taller real.`);
const tallerId = taller.id;
const userId = user.id;

const existing = await db.client.count({ where: { tallerId } });
if (existing > 0 && !reset) {
  console.log(`[demo] el taller "${taller.nombre}" ya tiene datos (${existing} clientes): no se hace nada. Usá --reset para restaurarlos.`);
  await db.$disconnect();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------------------------------------------------
const TODAY = todayAR();
const day = (off) => addDays(TODAY, off);
/** Día hábil: los domingos el taller no trabaja (se corre al lunes, o al sábado si el lunes sería futuro). */
function wd(off) {
  let ymd = day(off);
  if (dayOfWeek(ymd) === 0) ymd = day(off) < TODAY ? addDays(ymd, 1) : addDays(ymd, -1);
  if (ymd > TODAY) ymd = addDays(ymd, -2);
  return ymd;
}
const monthOf = (ymd) => Number(ymd.slice(5, 7));
const yearOf = (ymd) => Number(ymd.slice(0, 4));

// ---------------------------------------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------------------------------------
const CLIENTES = {
  roberto: ["Roberto Giménez", "roberto.gimenez", "5550-0101", "Av. San Martín 1250"],
  lucia: ["Lucía Fernández", "lucia.fernandez", "5550-0102", "Belgrano 480"],
  martin: ["Martín Acosta", "martin.acosta", "5550-0103", "Mitre 2210"],
  carolina: ["Carolina Ríos", "carolina.rios", "5550-0104", "Sarmiento 765"],
  diego: ["Diego Sosa", "diego.sosa", "5550-0105", "Lavalle 1890"],
  valeria: ["Valeria Molina", "valeria.molina", "5550-0106", "Rivadavia 3320"],
  gustavo: ["Gustavo Peralta", "gustavo.peralta", "5550-0107", "Moreno 915"],
  natalia: ["Natalia Cabrera", "natalia.cabrera", "5550-0108", "Alsina 640"],
  sebastian: ["Sebastián Ortiz", "sebastian.ortiz", "5550-0109", "Independencia 1475"],
  florencia: ["Florencia Vega", "florencia.vega", "5550-0110", "Urquiza 388"],
  javier: ["Javier Domínguez", "javier.dominguez", "5550-0111", "9 de Julio 2050"],
  mariana: ["Mariana Luna", "mariana.luna", "5550-0112", "Italia 1130"],
  transportes: ["Transportes del Sur SRL", "administracion@transportesdelsur", "5550-0113", "Ruta 3 km 28 (Parque Industrial)"],
  andina: ["Distribuidora Andina SA", "compras@distribuidoraandina", "5550-0114", "Av. Libertador 4500"],
};
// [cliente, patente, marca, modelo, año, km]
const VEHICULOS = {
  gol: ["roberto", "AC421ZD", "Volkswagen", "Gol Trend", 2016, 118400],
  ranger: ["roberto", "AF903KM", "Ford", "Ranger XLT", 2019, 92300],
  cronos: ["lucia", "AG115PL", "Fiat", "Cronos Drive", 2021, 41200],
  hilux: ["martin", "AE782TR", "Toyota", "Hilux SRV", 2018, 134900],
  sandero: ["carolina", "AB336WQ", "Renault", "Sandero Stepway", 2017, 99800],
  civic: ["carolina", "AD540JH", "Honda", "Civic EXL", 2015, 142600],
  cruze: ["diego", "AA218NB", "Chevrolet", "Cruze LT", 2018, 87500],
  p208: ["valeria", "AH067CX", "Peugeot", "208 Allure", 2020, 55700],
  focus: ["gustavo", "OVY294", "Ford", "Focus Titanium", 2014, 161200],
  c3: ["natalia", "AF672LS", "Citroën", "C3 Feel", 2019, 63400],
  frontier: ["sebastian", "AE011DM", "Nissan", "Frontier XE", 2016, 148000],
  corolla: ["florencia", "AG889RE", "Toyota", "Corolla XEi", 2019, 72100],
  amarok: ["javier", "AF455HP", "Volkswagen", "Amarok V6", 2020, 79800],
  toro: ["mariana", "AH203YU", "Fiat", "Toro Freedom", 2021, 38900],
  kangoo: ["transportes", "AD117BK", "Renault", "Kangoo Furgón", 2015, 201500],
  sprinter: ["andina", "AC700FG", "Mercedes-Benz", "Sprinter 415", 2017, 233100],
};
const TECNICOS = [
  ["Marcos Ledesma", "Mecánica general", "5550-0201"],
  ["Julián Paredes", "Electricidad e inyección", "5550-0202"],
  ["Carla Benítez", "Frenos y suspensión", "5550-0203"],
];
// clave: [nombre, unidad, costo, precio, mínimo, stock final deseado, categoría]
const PRODUCTOS = {
  aceite5w30: ["Aceite 5W30 sintético", "LITRO", 6800, 9900, 12, 18, "Lubricantes"],
  aceite10w40: ["Aceite 10W40 semisintético", "LITRO", 5200, 7600, 12, 9, "Lubricantes"],
  filtroAceite: ["Filtro de aceite", "UNIDAD", 3200, 5400, 8, 14, "Filtros"],
  filtroAire: ["Filtro de aire", "UNIDAD", 4100, 6900, 6, 5, "Filtros"],
  filtroComb: ["Filtro de combustible", "UNIDAD", 5600, 8900, 5, 7, "Filtros"],
  pastillas: ["Pastillas de freno delanteras", "JUEGO", 18500, 29900, 4, 6, "Frenos"],
  discos: ["Discos de freno", "PAR", 42000, 68000, 2, 1, "Frenos"],
  bujias: ["Bujías", "UNIDAD", 2900, 4800, 12, 30, "Encendido"],
  correa: ["Kit de distribución", "JUEGO", 58000, 92000, 2, 3, "Motor"],
  liquidoFrenos: ["Líquido de frenos DOT4", "LITRO", 4800, 7900, 3, 8, "Fluidos"],
  refrigerante: ["Refrigerante orgánico", "LITRO", 3100, 5200, 10, 22, "Fluidos"],
  bateria: ["Batería 12V 65Ah", "UNIDAD", 98000, 149000, 2, 2, "Eléctrico"],
  amortiguador: ["Amortiguador delantero", "PAR", 76000, 118000, 2, 3, "Suspensión"],
  escobillas: ["Escobillas limpiaparabrisas", "PAR", 6500, 10900, 4, 6, "Accesorios"],
  lampara: ["Lámpara H7", "UNIDAD", 2100, 3800, 6, 0, "Eléctrico"],
};
const SKU = (k) => "DEMO-" + k.replace(/[A-Z]/g, (c) => "-" + c).toUpperCase().replace(/^-/, "");
const it = (d, q, k) => ({ d, q, k });
const mo = (d, p) => ({ d, q: 1, p });

// Órdenes: off = día de ingreso (relativo a hoy). pays = [off, método, monto|null (null = el resto)]
const ORDENES = [
  { off: -40, cli: "roberto", veh: "gol", st: "ENTREGADA", quote: true, motivo: "Service de 120.000 km", items: [it("Aceite 5W30 sintético", 4, "aceite5w30"), it("Filtro de aceite", 1, "filtroAceite"), it("Filtro de aire", 1, "filtroAire"), mo("Mano de obra - service completo", 38000)], pays: [[-38, "EF", null]] },
  { off: -37, cli: "lucia", veh: "cronos", st: "ENTREGADA", quote: false, motivo: "Ruido al frenar", items: [it("Pastillas de freno delanteras", 1, "pastillas"), it("Líquido de frenos DOT4", 1, "liquidoFrenos"), mo("Mano de obra - frenos delanteros", 32000)], pays: [[-36, "TR", null]] },
  { off: -33, cli: "martin", veh: "hilux", st: "ENTREGADA", quote: true, motivo: "Cambio de correa de distribución", items: [it("Kit de distribución", 1, "correa"), it("Refrigerante orgánico", 6, "refrigerante"), mo("Mano de obra - distribución", 85000)], pays: [[-31, "TA", null]] },
  { off: -30, cli: "carolina", veh: "sandero", st: "ENTREGADA", quote: false, motivo: "Afinación de motor", items: [it("Bujías", 4, "bujias"), mo("Mano de obra - afinación", 28000)], pays: [[-29, "EF", null]] },
  { off: -27, cli: "diego", veh: "cruze", st: "ENTREGADA", quote: false, motivo: "Service de 90.000 km", items: [it("Aceite 10W40 semisintético", 4, "aceite10w40"), it("Filtro de aceite", 1, "filtroAceite"), it("Filtro de aire", 1, "filtroAire"), mo("Mano de obra - service", 36000)], pays: [[-26, "TR", null], [-26, "ANULADO", 15000]] },
  { off: -24, cli: "valeria", veh: "p208", st: "ENTREGADA", quote: false, motivo: "No arranca: batería descargada", items: [it("Batería 12V 65Ah", 1, "bateria"), mo("Mano de obra - instalación y prueba de carga", 8000)], pays: [[-24, "TA", null]] },
  { off: -21, cli: "gustavo", veh: "focus", st: "ENTREGADA", quote: true, motivo: "Amortiguadores delanteros", items: [it("Amortiguador delantero", 1, "amortiguador"), mo("Mano de obra - suspensión", 60000)], pays: [[-20, "EF", 100000], [-18, "TR", null]], costo: ["Alineación tercerizada", 18000] },
  { off: -18, cli: "natalia", veh: "c3", st: "ENTREGADA", quote: false, motivo: "Revisión previa a la VTV", items: [it("Escobillas limpiaparabrisas", 1, "escobillas"), it("Lámpara H7", 2, "lampara"), mo("Mano de obra - revisión general", 24000), { ...it("Líquido de frenos DOT4", 1, "liquidoFrenos"), devolver: 1 }], pays: [[-17, "EF", null]] },
  { off: -15, cli: "sebastian", veh: "frontier", st: "ENTREGADA", quote: true, motivo: "Frenos delanteros completos", items: [it("Discos de freno", 1, "discos"), it("Pastillas de freno delanteras", 1, "pastillas"), mo("Mano de obra - frenos", 45000)], pays: [[-14, "TR", null]] },
  { off: -12, cli: "florencia", veh: "corolla", st: "ENTREGADA", quote: false, motivo: "Service de 70.000 km", items: [it("Aceite 5W30 sintético", 4, "aceite5w30"), it("Filtro de aceite", 1, "filtroAceite"), it("Filtro de aire", 1, "filtroAire"), mo("Mano de obra - service", 36000)], pays: [[-11, "TA", null]] },
  { off: -10, cli: "transportes", veh: "kangoo", st: "ENTREGADA", quote: false, motivo: "Service de flota", items: [it("Aceite 10W40 semisintético", 5, "aceite10w40"), it("Filtro de aceite", 1, "filtroAceite"), it("Filtro de aire", 1, "filtroAire"), mo("Mano de obra - service de flota", 42000)], pays: [[-9, "CC", null]] },
  { off: -9, cli: "andina", veh: "sprinter", st: "ENTREGADA", quote: false, motivo: "Frenos traseros y delanteros", items: [it("Pastillas de freno delanteras", 2, "pastillas"), it("Líquido de frenos DOT4", 1, "liquidoFrenos"), mo("Mano de obra - frenos", 55000)], pays: [[-8, "EF", 60000]] },
  { off: -6, cli: "javier", veh: "amarok", st: "TERMINADA", quote: true, motivo: "Distribución y refrigeración", items: [it("Kit de distribución", 1, "correa"), it("Refrigerante orgánico", 5, "refrigerante"), mo("Mano de obra - distribución", 95000)], pays: [[-5, "EF", 80000]] },
  { off: -5, cli: "diego", veh: "cruze", st: "ENTREGADA", quote: false, motivo: "Cambio de batería", items: [it("Batería 12V 65Ah", 1, "bateria"), mo("Mano de obra - instalación", 8000)], pays: [[-4, "EF", null]] },
  { off: -4, cli: "mariana", veh: "toro", st: "EN_PROCESO", quote: false, motivo: "Service de 40.000 km", items: [it("Aceite 5W30 sintético", 4, "aceite5w30"), it("Filtro de aceite", 1, "filtroAceite"), it("Filtro de aire", 1, "filtroAire"), it("Filtro de combustible", 1, "filtroComb"), mo("Mano de obra - service", 40000)], pays: [[-4, "TR", 30000]] },
  { off: -3, cli: "roberto", veh: "ranger", st: "EN_PROCESO", quote: false, motivo: "Golpes en el tren delantero", items: [it("Amortiguador delantero", 1, "amortiguador"), mo("Mano de obra - suspensión", 60000)], pays: [] },
  { off: -2, cli: "martin", veh: "hilux", st: "EN_PROCESO", quote: false, motivo: "Batería y limpiaparabrisas", items: [it("Batería 12V 65Ah", 1, "bateria"), it("Escobillas limpiaparabrisas", 1, "escobillas"), mo("Mano de obra", 9000)], pays: [] },
  { off: -1, cli: "carolina", veh: "civic", st: "APROBADA", quote: true, motivo: "Diagnóstico electrónico y bujías", items: [mo("Diagnóstico con scanner", 25000), it("Bujías", 4, "bujias")], pays: [] },
  { off: 0, cli: "valeria", veh: "p208", st: "APROBADA", quote: false, motivo: "Cambio de aceite y filtro", items: [it("Aceite 5W30 sintético", 3.5, "aceite5w30"), it("Filtro de aceite", 1, "filtroAceite"), mo("Mano de obra", 18000)], pays: [[0, "EF", 5000]] },
];
// Presupuestos que no se convirtieron en orden: [off, cli, veh, estado, items]
const PRESUPUESTOS_EXTRA = [
  [-3, "natalia", "c3", "PENDIENTE", [it("Amortiguador delantero", 1, "amortiguador"), mo("Mano de obra - suspensión", 60000)]],
  [-2, "gustavo", "focus", "PENDIENTE", [it("Discos de freno", 1, "discos"), it("Pastillas de freno delanteras", 1, "pastillas"), mo("Mano de obra - frenos", 45000)]],
  [-1, "florencia", "corolla", "PENDIENTE", [mo("Alineación y balanceo", 24000), it("Refrigerante orgánico", 4, "refrigerante")]],
  [-8, "sebastian", "frontier", "RECHAZADO", [it("Kit de distribución", 1, "correa"), mo("Mano de obra - distribución", 90000)]],
  [-1, "lucia", "cronos", "APROBADO", [it("Aceite 5W30 sintético", 4, "aceite5w30"), it("Filtro de aceite", 1, "filtroAceite"), mo("Mano de obra - service", 36000)]],
];
// Reposiciones de stock: [producto, off, cantidad]
const REPOSICIONES = [["aceite5w30", -45, 20], ["filtroAceite", -44, 12], ["bujias", -43, 16], ["refrigerante", -42, 14]];
const EGRESOS = [
  [-36, "GASTO_ALQUILER", 120000, "Alquiler del local"],
  [-35, "GASTO_SERVICIOS_UTILES", 32500, "Luz y agua"],
  [-33, "COMPRA_REPUESTOS", 98000, "Repuestos a proveedor mayorista"],
  [-30, "GASTO_SUELDOS", 150000, "Adelanto de sueldos"],
  [-26, "GASTO_MANTENIMIENTO", 18000, "Mantenimiento del elevador"],
  [-22, "COMPRA_MATERIALES", 26000, "Insumos de taller (guantes, trapos, desengrasante)"],
  [-19, "GASTO_IMPUESTOS", 42000, "Ingresos Brutos"],
  [-14, "COMPRA_REPUESTOS", 76000, "Reposición de filtros y lubricantes"],
  [-12, "GASTO_SERVICIOS", 14900, "Internet y telefonía"],
  [-7, "GASTO_SUELDOS", 150000, "Sueldos"],
  [-6, "GASTO_ALQUILER", 120000, "Alquiler del local"],
  [-3, "GASTO_OTROS", 9500, "Limpieza y artículos de oficina"],
  [-1, "COMPRA_MATERIALES", 21000, "Insumos varios"],
];
const TURNOS = [
  [0, "09:00", "roberto", "ranger", "Service de 90.000 km", "CONFIRMADO"],
  [0, "11:30", "natalia", "c3", "Ruido en el tren delantero", "PENDIENTE"],
  [0, "15:00", "florencia", "corolla", "Cambio de batería", "CONFIRMADO"],
  [1, "10:00", "gustavo", "focus", "Revisión previa a la VTV", "PENDIENTE"],
  [1, "14:30", "sebastian", "frontier", "Cambio de pastillas", "CONFIRMADO"],
  [2, "09:30", "mariana", "toro", "Alineación y balanceo", "PENDIENTE"],
  [3, "16:00", "lucia", "cronos", "Service de 45.000 km", "CONFIRMADO"],
  [4, "11:00", "diego", "cruze", "Luz de motor encendida", "EN_ESPERA"],
  [5, "10:30", "andina", "sprinter", "Control de frenos de la flota", "CONFIRMADO"],
  [6, "09:00", "carolina", "sandero", "Pérdida de aceite", "CANCELADO"],
];

// ---------------------------------------------------------------------------------------------------------------------
// Construcción de las filas (todo en memoria; recién después se escribe en una transacción)
// ---------------------------------------------------------------------------------------------------------------------
const ids = { cli: {}, veh: {}, prod: {}, metodo: {} };
for (const k of Object.keys(CLIENTES)) ids.cli[k] = cid();
for (const k of Object.keys(VEHICULOS)) ids.veh[k] = cid();
for (const k of Object.keys(PRODUCTOS)) ids.prod[k] = cid();
for (const t of ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CUENTA_CORRIENTE"]) ids.metodo[t] = cid();
const METODO = { EF: "EFECTIVO", TR: "TRANSFERENCIA", TA: "TARJETA", CC: "CUENTA_CORRIENTE" };

const rows = { clients: [], vehicles: [], technicians: [], methods: [], products: [], quotes: [], quoteItems: [], orders: [], orderItems: [], payments: [], cash: [], credits: [], closes: [], schedules: [], goals: [], costs: [], audit: [], stock: [] };
const audit = (accion, entityType, entityId, when, descripcion, newValue) =>
  rows.audit.push({ id: cid(), tallerId, userId, accion, entityType, entityId, descripcion, newValue: newValue ? JSON.stringify(newValue) : undefined, timestamp: when, createdAt: when });

const firstOffByClient = {};
for (const o of ORDENES) firstOffByClient[o.cli] = Math.min(firstOffByClient[o.cli] ?? 0, o.off);
for (const [k, [nombre, mail, tel, dir]] of Object.entries(CLIENTES)) {
  const creado = at(wd((firstOffByClient[k] ?? -1) - 1), 9);
  rows.clients.push({ id: ids.cli[k], tallerId, nombre, email: mail.includes("@") ? `${mail}.example.com` : `${mail}@example.com`, telefono: `+54 9 11 ${tel}`, direccion: dir, createdAt: creado, updatedAt: creado });
}
for (const [k, [cli, patente, marca, modelo, anio, km]] of Object.entries(VEHICULOS)) {
  rows.vehicles.push({ id: ids.veh[k], tallerId, clientId: ids.cli[cli], patente, marca, modelo, anio, kilometraje: km });
}
for (const [nombre, especialidad, tel] of TECNICOS) rows.technicians.push({ id: cid(), tallerId, nombre, especialidad, telefono: `+54 9 11 ${tel}`, activo: true });
for (const [tipo, id] of Object.entries(ids.metodo)) rows.methods.push({ id, tallerId, tipo, nombre: { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CUENTA_CORRIENTE: "Cuenta Corriente" }[tipo] });

// Productos (el stock inicial se registra como una entrada en el libro: nunca se escribe stockActual directamente)
const consumo = {}; // neto consumido por producto (salidas - devoluciones)
const reposTotal = {};
for (const [k, off, qty] of REPOSICIONES) reposTotal[k] = (reposTotal[k] ?? 0) + qty;
const stockRows = []; // { when, ...fila }
const stockMov = (when, k, tipo, cantidad, extra = {}) => stockRows.push({ when, productId: ids.prod[k], tipo, cantidad, ...extra });

const orders = ORDENES.map((o, i) => {
  const id = cid();
  const items = o.items.map((x) => {
    const prod = x.k ? PRODUCTOS[x.k] : null;
    const precio = prod ? prod[3] : x.p;
    return { ...x, precio, subtotal: round2(x.q * precio) };
  });
  // Un ítem con `devolver` se quitó de la orden y su stock se recuperó: no figura en los ítems ni en el total
  const removidos = items.filter((x) => x.devolver);
  const vigentes = items.filter((x) => !x.devolver);
  const total = round2(vigentes.reduce((s, x) => s + x.subtotal, 0));
  return { ...o, id, i, items: vigentes, removidos, total, fechaIng: at(wd(o.off), 9 + (i % 4), (i * 7) % 60), numero: id.slice(-6) };
});

// Presupuestos
const quotes = [];
for (const o of orders.filter((o) => o.quote)) {
  const qid = cid();
  o.quoteId = qid;
  quotes.push({ id: qid, off: o.off - 2, cli: o.cli, veh: o.veh, status: "APROBADO", items: o.items, total: o.total, orderId: o.id });
}
for (const [off, cli, veh, status, items] of PRESUPUESTOS_EXTRA) {
  const its = items.map((x) => {
    const prod = x.k ? PRODUCTOS[x.k] : null;
    const precio = prod ? prod[3] : x.p;
    return { ...x, precio, subtotal: round2(x.q * precio) };
  });
  quotes.push({ id: cid(), off, cli, veh, status, items: its, total: round2(its.reduce((s, x) => s + x.subtotal, 0)) });
}
for (const q of quotes) {
  const when = at(wd(q.off), 10);
  rows.quotes.push({ id: q.id, tallerId, clientId: ids.cli[q.cli], vehicleId: ids.veh[q.veh], status: q.status, total: q.total, observaciones: "Presupuesto sin cargo, válido por 15 días.", fecha: when, createdAt: when, updatedAt: when });
  for (const x of q.items) rows.quoteItems.push({ id: cid(), quoteId: q.id, productId: x.k ? ids.prod[x.k] : undefined, descripcion: x.d, cantidad: x.q, precioUnitario: x.precio, subtotal: x.subtotal, createdAt: when, updatedAt: when });
  audit("QUOTE_CREATED", "QUOTE", q.id, when, undefined, { total: q.total, items: q.items.length });
  if (q.status === "APROBADO") audit("QUOTE_APPROVED", "QUOTE", q.id, new Date(when.getTime() + 3 * 3600e3), undefined, { status: "APROBADO" });
  if (q.status === "RECHAZADO") audit("QUOTE_REJECTED", "QUOTE", q.id, new Date(when.getTime() + 5 * 3600e3), undefined, { status: "RECHAZADO" });
}

// Órdenes, pagos, caja y stock
const saldoCC = {};
let seq = 0;
const cashRow = (o) => { rows.cash.push({ id: cid(), tallerId, ...o }); return rows.cash[rows.cash.length - 1]; };
for (const o of orders) {
  rows.orders.push({ id: o.id, tallerId, clientId: ids.cli[o.cli], vehicleId: ids.veh[o.veh], quoteId: o.quoteId, status: o.st, total: o.total, motivoIngreso: o.motivo, diagnostico: o.st === "APROBADA" ? undefined : "Se realizó el trabajo indicado y se verificó el funcionamiento.", kmIngreso: VEHICULOS[o.veh][5] - 300 + o.i * 11, fecha: o.fechaIng, createdAt: o.fechaIng, updatedAt: o.fechaIng });
  for (const x of o.items) rows.orderItems.push({ id: cid(), workOrderId: o.id, productId: x.k ? ids.prod[x.k] : undefined, descripcion: x.d, cantidad: x.q, precioUnitario: x.precio, subtotal: x.subtotal, createdAt: o.fechaIng, updatedAt: o.fechaIng });
  audit("WORK_ORDER_CREATED", "WORK_ORDER", o.id, o.fechaIng, o.quoteId ? "Orden creada desde presupuesto" : "Orden creada", { total: o.total });
  if (o.quoteId) {
    audit("QUOTE_CONVERTED_TO_WORK_ORDER", "QUOTE", o.quoteId, o.fechaIng, undefined, { workOrderId: o.id, total: o.total });
  }
  // Consumo de stock al pasar a EN_PROCESO (o posterior)
  const enProceso = new Date(o.fechaIng.getTime() + 3 * 3600e3);
  if (["EN_PROCESO", "TERMINADA", "ENTREGADA"].includes(o.st)) {
    audit("WORK_ORDER_STATUS_CHANGED", "WORK_ORDER", o.id, enProceso, undefined, { status: "EN_PROCESO", total: o.total });
    for (const x of [...o.items, ...o.removidos].filter((x) => x.k)) {
      stockMov(enProceso, x.k, "SALIDA_ORDEN", -x.q, { workOrderId: o.id, costoUnitario: PRODUCTOS[x.k][2], motivo: "Consumo por orden de trabajo" });
      consumo[x.k] = (consumo[x.k] ?? 0) + x.q;
      if (x.devolver) {
        stockMov(new Date(enProceso.getTime() + 20 * 3600e3), x.k, "DEVOLUCION", x.devolver, { workOrderId: o.id, costoUnitario: PRODUCTOS[x.k][2], motivo: "El cliente no aceptó el cambio de líquido; envase cerrado recuperado" });
        consumo[x.k] -= x.devolver;
      }
    }
  }
  if (["TERMINADA", "ENTREGADA"].includes(o.st)) audit("WORK_ORDER_COMPLETED", "WORK_ORDER", o.id, new Date(enProceso.getTime() + 24 * 3600e3), undefined, { status: "TERMINADA", total: o.total });
  // Pagos
  let cobrado = 0;
  let ultimoPago = enProceso;
  for (const [offP, met, monto] of o.pays) {
    const anulado = met === "ANULADO";
    const metodo = anulado ? "TR" : met;
    const resto = round2(o.total - o.pays.filter((p) => p[1] !== "ANULADO" && p[2] !== null).reduce((s, p) => s + p[2], 0));
    const importe = monto ?? resto;
    const cuando = at(wd(offP), 13 + (seq++ % 4), (seq * 13) % 60);
    const pid = cid();
    rows.payments.push({ id: pid, tallerId, workOrderId: o.id, methodId: ids.metodo[METODO[metodo]], monto: importe, status: anulado ? "ANULADO" : "PAGADO", numeroComprobante: metodo === "TR" ? `TR-${100000 + seq * 37}` : undefined, observaciones: anulado ? "Transferencia duplicada por error del cliente" : undefined, anuladoAt: anulado ? new Date(cuando.getTime() + 3600e3) : undefined, anuladoMotivo: anulado ? "Cobro duplicado: se acreditó dos veces" : undefined, fecha: cuando, createdAt: cuando, updatedAt: cuando });
    audit("PAYMENT_RECORDED", "PAYMENT", pid, cuando, `Cobro de $${importe} - ${METODO[metodo]}`, { monto: importe, metodo: METODO[metodo] });
    if (metodo === "CC") {
      saldoCC[o.cli] = round2((saldoCC[o.cli] ?? 0) - importe);
      audit("CLIENT_CREDIT_UPDATED", "CLIENT_CREDIT", ids.cli[o.cli], cuando, "Cargo a cuenta corriente", { saldo: saldoCC[o.cli] });
    } else {
      const mov = cashRow({ tipo: "INGRESO", categoria: "PAGO_ORDEN", monto: importe, descripcion: `Cobro orden #${o.numero} - ${CLIENTES[o.cli][0]}`, workOrderId: o.id, paymentId: pid, fecha: cuando, createdAt: cuando, updatedAt: cuando });
      audit("CASH_MOVEMENT_RECORDED", "CASH_MOVEMENT", mov.id, cuando, undefined, { tipo: "INGRESO", monto: importe, categoria: "PAGO_ORDEN" });
      if (anulado) {
        const rev = cashRow({ tipo: "INGRESO", categoria: "REVERSION", monto: -importe, descripcion: `Anulación del movimiento ${mov.id}`, workOrderId: o.id, reversalOfId: mov.id, motivo: "Cobro duplicado: se acreditó dos veces", fecha: new Date(cuando.getTime() + 3600e3), createdAt: new Date(cuando.getTime() + 3600e3), updatedAt: new Date(cuando.getTime() + 3600e3) });
        audit("PAYMENT_ANNULLED", "PAYMENT", pid, rev.fecha, `Pago de $${importe} anulado. Motivo: Cobro duplicado`, { status: "ANULADO", monto: importe });
        audit("CASH_MOVEMENT_RECORDED", "CASH_MOVEMENT", rev.id, rev.fecha, undefined, { tipo: "INGRESO", monto: -importe, categoria: "REVERSION" });
      }
    }
    if (!anulado) cobrado = round2(cobrado + importe);
    ultimoPago = cuando;
  }
  o.cobrado = cobrado;
  if (o.st === "ENTREGADA") audit("WORK_ORDER_DELIVERED", "WORK_ORDER", o.id, new Date(Math.max(ultimoPago.getTime(), enProceso.getTime()) + 3600e3), undefined, { status: "ENTREGADA", total: o.total });
  if (o.costo) rows.costs.push({ id: cid(), tallerId, tipo: "VARIABLE", categoria: "SERVICIOS", descripcion: o.costo[0], monto: o.costo[1], mes: monthOf(wd(o.off)), anio: yearOf(wd(o.off)), workOrderId: o.id });
}
// Cuenta corriente: Transportes del Sur paga una parte de su deuda (anticipo a cuenta)
{
  const cuando = at(wd(-3), 12, 20);
  const importe = 50000;
  saldoCC.transportes = round2((saldoCC.transportes ?? 0) + importe);
  const mov = cashRow({ tipo: "INGRESO", categoria: "ANTICIPO", monto: importe, descripcion: "Pago a cuenta - Transportes del Sur SRL", clientId: ids.cli.transportes, fecha: cuando, createdAt: cuando, updatedAt: cuando });
  audit("CLIENT_CREDIT_UPDATED", "CLIENT_CREDIT", ids.cli.transportes, cuando, "Pago de cuenta corriente", { saldo: saldoCC.transportes });
  audit("CASH_MOVEMENT_RECORDED", "CASH_MOVEMENT", mov.id, cuando, undefined, { tipo: "INGRESO", monto: importe, categoria: "ANTICIPO" });
}
for (const [k, saldo] of Object.entries(saldoCC)) rows.credits.push({ id: cid(), tallerId, clientId: ids.cli[k], saldo, creditLimit: k === "transportes" ? 500000 : undefined });
// Egresos
for (const [off, categoria, monto, descripcion] of EGRESOS) {
  const cuando = at(wd(off), 17, 10);
  const mov = cashRow({ tipo: "EGRESO", categoria, monto, descripcion, fecha: cuando, createdAt: cuando, updatedAt: cuando });
  audit("CASH_MOVEMENT_RECORDED", "CASH_MOVEMENT", mov.id, cuando, undefined, { tipo: "EGRESO", monto, categoria });
}

// Stock: reposiciones, ajuste de inventario y compra inicial calculada para que el stock final sea el deseado
const AJUSTE_LAMPARA = -8;
for (const [k, off, qty] of REPOSICIONES) stockMov(at(wd(off), 11), k, "ENTRADA_COMPRA", qty, { costoUnitario: PRODUCTOS[k][2], motivo: "Reposición de stock" });
stockMov(at(wd(-8), 18), "lampara", "AJUSTE", AJUSTE_LAMPARA, { motivo: "Inventario físico: faltante de lámparas" });
for (const [k, [nombre, unidad, costo, precio, minimo, objetivo, categoria]] of Object.entries(PRODUCTOS)) {
  const inicial = objetivo + (consumo[k] ?? 0) - (reposTotal[k] ?? 0) - (k === "lampara" ? AJUSTE_LAMPARA : 0);
  if (inicial <= 0) throw new Error(`Compra inicial inválida para ${k}: ${inicial}`);
  const alta = at(wd(-50), 10);
  rows.products.push({ id: ids.prod[k], tallerId, nombre, sku: SKU(k), categoria, unidad, costo, precioVenta: precio, stockMinimo: minimo, activo: true, createdAt: alta, updatedAt: alta });
  audit("PRODUCT_CREATED", "PRODUCT", ids.prod[k], alta, undefined, { nombre, unidad, costo, precioVenta: precio });
  stockMov(alta, k, "ENTRADA_COMPRA", inicial, { costoUnitario: costo, motivo: "Stock inicial" });
}
stockRows.sort((a, b) => a.when - b.when);
for (const s of stockRows) {
  const { when, ...r } = s;
  rows.stock.push({ id: cid(), tallerId, userId, createdAt: when, ...r });
  const prod = Object.entries(ids.prod).find(([, v]) => v === s.productId)[0];
  const nombre = PRODUCTOS[prod][0];
  const accion = { ENTRADA_COMPRA: "STOCK_PURCHASED", SALIDA_ORDEN: "STOCK_CONSUMED", AJUSTE: "STOCK_ADJUSTED", DEVOLUCION: "STOCK_RETURNED" }[s.tipo];
  audit(accion, "STOCK_MOVEMENT", rows.stock[rows.stock.length - 1].id, when, `${nombre}: ${s.cantidad > 0 ? "+" : ""}${s.cantidad}`, { productId: s.productId, cantidad: s.cantidad });
}

// Cierres de caja diarios (días hábiles, desde el primer movimiento hasta ayer; hoy queda abierto)
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
const porDia = {};
for (const m of rows.cash) (porDia[dayKey(m.fecha)] ??= []).push(m);
const diasConMov = Object.keys(porDia).sort();
let saldo = 400000; // caja inicial del período
let minSaldo = saldo;
for (let d = diasConMov[0]; d < TODAY; d = addDays(d, 1)) {
  if (dayOfWeek(d) === 0) continue;
  const movs = porDia[d] ?? [];
  const ing = round2(movs.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0));
  const egr = round2(movs.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0));
  const final = round2(saldo + ing - egr);
  const cerrado = at(d, 20, 5);
  const closeId = cid();
  rows.closes.push({ id: closeId, tallerId, fecha: closeDate(d), estado: "CERRADO", saldoInicial: saldo, totalIngresos: ing, totalEgresos: egr, saldoFinal: final, closedAt: cerrado, createdAt: cerrado, updatedAt: cerrado });
  audit("DAILY_CLOSE_CLOSED", "DAILY_CLOSE", closeId, cerrado, undefined, { saldoInicial: saldo, totalIngresos: ing, totalEgresos: egr, saldoFinal: final });
  saldo = final;
  minSaldo = Math.min(minSaldo, saldo);
}

// Turnos
for (const [off, hora, cli, veh, motivo, status] of TURNOS) {
  const ymd = day(off);
  rows.schedules.push({ id: cid(), tallerId, clientId: ids.cli[cli], vehicleId: ids.veh[veh], fecha: closeDate(ymd), hora, motivo, status });
}
// Objetivos y costos del mes
const mes = monthOf(TODAY), anio = yearOf(TODAY);
const prev = mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
rows.goals.push({ id: cid(), tallerId, tipo: "INGRESO_MENSUAL", objetivo: 1800000, mes, anio, estado: "EN_PROGRESO", notas: "Meta del mes" });
rows.goals.push({ id: cid(), tallerId, tipo: "ORDENES_MENSUALES", objetivo: 22, mes, anio, estado: "EN_PROGRESO" });
rows.goals.push({ id: cid(), tallerId, tipo: "CLIENTES_NUEVOS", objetivo: 8, mes, anio, estado: "EN_PROGRESO" });
rows.goals.push({ id: cid(), tallerId, tipo: "INGRESO_MENSUAL", objetivo: 1500000, mes: prev.mes, anio: prev.anio, estado: "ALCANZADO" });
for (const [m, a] of [[mes, anio], [prev.mes, prev.anio]]) {
  rows.costs.push({ id: cid(), tallerId, tipo: "FIJO", categoria: "SERVICIOS", descripcion: "Alquiler del local", monto: 120000, mes: m, anio: a });
  rows.costs.push({ id: cid(), tallerId, tipo: "FIJO", categoria: "MANO_OBRA", descripcion: "Sueldos del personal", monto: 300000, mes: m, anio: a });
  rows.costs.push({ id: cid(), tallerId, tipo: "FIJO", categoria: "SERVICIOS", descripcion: "Luz, agua, internet y telefonía", monto: 47400, mes: m, anio: a });
  rows.costs.push({ id: cid(), tallerId, tipo: "VARIABLE", categoria: "MATERIA_PRIMA", descripcion: "Repuestos e insumos", monto: 174000, mes: m, anio: a });
}
// Turnos convertidos en orden: los de hoy ya con orden (la de Valeria llegó por turno)
const ordenHoy = orders.find((o) => o.off === 0);
rows.schedules.push({ id: cid(), tallerId, clientId: ids.cli.valeria, vehicleId: ids.veh.p208, fecha: closeDate(TODAY), hora: "08:00", motivo: "Cambio de aceite y filtro", status: "COMPLETADO", workOrderId: ordenHoy.id });

// ---------------------------------------------------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------------------------------------------------
const resumen = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length]));
const deudas = orders.filter((o) => o.cobrado + 0.005 < o.total && o.pays.length >= 0).map((o) => ({ orden: o.numero, cliente: CLIENTES[o.cli][0], pendiente: round2(o.total - o.cobrado) })).filter((d) => d.pendiente > 0.004);
console.log("[demo] filas a crear:", JSON.stringify(resumen));
const totIng = round2(rows.cash.filter((m) => m.tipo === "INGRESO").reduce((a, m) => a + m.monto, 0));
const totEgr = round2(rows.cash.filter((m) => m.tipo === "EGRESO").reduce((a, m) => a + m.monto, 0));
console.log(`[demo] ingresos $${totIng} / egresos $${totEgr}`);
console.log(`[demo] caja: saldo final al cierre de ayer $${saldo} (mínimo durante el período $${minSaldo}); cuentas corrientes: ${JSON.stringify(saldoCC)}`);
console.log(`[demo] órdenes con saldo pendiente: ${deudas.length} (${deudas.map((d) => `${d.cliente} $${d.pendiente}`).join("; ")})`);
console.log(`[demo] productos con stock bajo o sin stock: ${Object.entries(PRODUCTOS).filter(([, p]) => p[5] <= p[4]).map(([k]) => k).join(", ")}`);
if (!apply) {
  console.log("[demo] simulación: no se escribió nada. Agregá --apply para ejecutar.");
  await db.$disconnect();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Escritura (una sola transacción: o queda todo o no queda nada)
// ---------------------------------------------------------------------------------------------------------------------
await db.$transaction(
  async (tx) => {
    if (reset) {
      // Solo los datos de ESTE taller. Los movimientos de stock son inmutables: se deshabilita el trigger únicamente
      // dentro de esta transacción (si algo falla, se revierte con todo lo demás).
      await tx.$executeRawUnsafe(`ALTER TABLE "stock_movements" DISABLE TRIGGER "stock_movements_inmutable_row_trg"`);
      await tx.auditLog.deleteMany({ where: { tallerId } });
      await tx.stockMovement.deleteMany({ where: { tallerId } });
      await tx.$executeRawUnsafe(`ALTER TABLE "stock_movements" ENABLE TRIGGER "stock_movements_inmutable_row_trg"`);
      await tx.cashMovement.deleteMany({ where: { tallerId, reversalOfId: { not: null } } });
      await tx.cashMovement.deleteMany({ where: { tallerId } });
      await tx.payment.deleteMany({ where: { tallerId } });
      await tx.dailyClose.deleteMany({ where: { tallerId } });
      await tx.schedule.deleteMany({ where: { tallerId } });
      await tx.clientCredit.deleteMany({ where: { tallerId } });
      await tx.cost.deleteMany({ where: { tallerId } });
      await tx.goal.deleteMany({ where: { tallerId } });
      await tx.workOrder.deleteMany({ where: { tallerId } }); // los ítems caen en cascada
      await tx.quote.deleteMany({ where: { tallerId } });
      await tx.vehicle.deleteMany({ where: { tallerId } });
      await tx.client.deleteMany({ where: { tallerId } });
      await tx.product.deleteMany({ where: { tallerId } });
      await tx.technician.deleteMany({ where: { tallerId } });
      await tx.paymentMethod.deleteMany({ where: { tallerId } });
    }
    await tx.taller.update({ where: { id: tallerId }, data: { telefono: "+54 9 11 5550-0000", direccion: "Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires", logo: "/logos/taller-demo.svg" } });
    await tx.paymentMethod.createMany({ data: rows.methods });
    await tx.technician.createMany({ data: rows.technicians });
    await tx.client.createMany({ data: rows.clients });
    await tx.vehicle.createMany({ data: rows.vehicles });
    await tx.product.createMany({ data: rows.products });
    await tx.quote.createMany({ data: rows.quotes });
    await tx.workOrder.createMany({ data: rows.orders });
    await tx.quoteItem.createMany({ data: rows.quoteItems });
    await tx.workOrderItem.createMany({ data: rows.orderItems });
    await tx.payment.createMany({ data: rows.payments });
    const originales = rows.cash.filter((m) => !m.reversalOfId);
    await tx.cashMovement.createMany({ data: originales });
    await tx.cashMovement.createMany({ data: rows.cash.filter((m) => m.reversalOfId) });
    await tx.clientCredit.createMany({ data: rows.credits });
    await tx.dailyClose.createMany({ data: rows.closes });
    await tx.schedule.createMany({ data: rows.schedules });
    await tx.goal.createMany({ data: rows.goals });
    await tx.cost.createMany({ data: rows.costs });
    // El libro de stock va ordenado cronológicamente: el trigger calcula el stock resultante en ese orden
    await tx.stockMovement.createMany({ data: rows.stock });
    await tx.auditLog.createMany({ data: rows.audit });
  },
  { timeout: 120000, maxWait: 30000 }
);
console.log("[demo] datos de la demo creados.");
await db.$disconnect();
