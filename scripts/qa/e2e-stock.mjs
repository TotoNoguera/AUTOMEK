// Pruebas HTTP de punta a punta del módulo de stock contra la base de QA, con la app que escuche en QA_APP_URL.
//   npm run qa:dev            (otra terminal; con QA_VIA_POOLER=1 la app usa el pooler, como producción)
//   npm run qa:e2e:stock
// Requiere los talleres de `npm run qa:seed`. Re-ejecutable: todos los nombres y SKU llevan un sufijo único por corrida.
import { BASE_URL, createChecker, createPrisma, loginAs, randomHex, target, viaPooler } from "./lib/common.mjs";

const { check, info, section, finish } = createChecker();
const db = createPrisma();
const SUF = randomHex(3);
console.log(`[QA] e2e-stock: endpoint=${target.endpoint} vía ${viaPooler ? "POOLER" : "conexión directa"}, app=${BASE_URL}`);

const A = await loginAs(db, "qa-alfa@example.invalid");
const B = await loginAs(db, "qa-beta@example.invalid");
const alfa = await db.userTaller.findFirst({ where: { user: { email: "qa-alfa@example.invalid" } } });
const cv = await db.client.findFirst({ where: { tallerId: alfa.tallerId, vehicles: { some: {} } }, include: { vehicles: true } });
if (!cv) throw new Error("Faltan los datos de siembra: ejecutá npm run qa:seed");
const stock = async (id) => Number((await db.product.findUniqueOrThrow({ where: { id } })).stockActual);
const movs = (wo) => db.stockMovement.findMany({ where: { workOrderId: wo }, orderBy: { createdAt: "asc" } });
const item = (productId, cantidad, descripcion = "Aceite") => ({ productId, descripcion, cantidad, precioUnitario: 6500 });
const newOrder = async (motivo, items) => (await A("POST", "/api/work-orders", { clientId: cv.id, vehicleId: cv.vehicles[0].id, motivoIngreso: motivo, items })).d?.id;
const editOrder = (id, items) => A("PUT", `/api/work-orders/${id}`, { clientId: cv.id, vehicleId: cv.vehicles[0].id, motivoIngreso: "Edición", items });
let r;

section("1) Productos: alta, validación, listado y detalle");
r = await A("POST", "/api/products", { nombre: `Aceite 5W30 ${SUF}`, sku: ` ace-${SUF} `, categoria: "Lubricantes", unidad: "LITRO", costo: 4000, precioVenta: 6500, stockMinimo: 5, stockInicial: 20 });
check(r.s === 201 && r.d.stockActual === 20 && r.d.sku === `ACE-${SUF.toUpperCase()}` && r.d.margen === 2500 && r.d.stockBajo === false, "alta con stock inicial: SKU normalizado, stock 20, margen 2.500, sin alerta", `${r.s} ${JSON.stringify(r.d).slice(0, 200)}`);
const pAceite = r.d?.id;
check(typeof r.d?.stockActual === "number", "el stock se serializa como número (no como texto)");
r = await A("POST", "/api/products", { nombre: `Filtro ${SUF}`, costo: 1500, precioVenta: 3000, stockMinimo: 2 }); check(r.s === 201 && r.d.stockActual === 0 && r.d.stockBajo === true, "alta sin stock: queda en 0 y con alerta de stock bajo", r.s); const pFiltro = r.d?.id;
r = await A("POST", "/api/products", { nombre: `Dup ${SUF}`, sku: `ace-${SUF}` }); check(r.s === 409 && /código \(SKU\)/.test(r.d?.error), "SKU repetido en el taller -> 409 con mensaje claro", `${r.s} ${r.d?.error}`);
r = await B("POST", "/api/products", { nombre: `Aceite Beta ${SUF}`, sku: `ace-${SUF}`, unidad: "LITRO" }); check(r.s === 201, "el mismo SKU en otro taller se permite", r.s); const pBeta = r.d?.id;
r = await A("POST", "/api/products", { nombre: "A", unidad: "GALON", costo: -5 }); check(r.s === 400 && !/Invalid|Required/.test(JSON.stringify(r.d)), "datos inválidos -> 400 en español", `${r.s} ${r.d?.error}`);
r = await A("POST", "/api/products", { nombre: "Directo", stockActual: 99 }); check(r.s === 400, "stockActual no se acepta en el alta (solo vía movimientos) -> 400", r.s);
r = await A("GET", "/api/products?q=aceite&limit=10"); check(r.s === 200 && r.d.products.some((p) => p.id === pAceite) && !r.d.products.some((p) => p.id === pBeta), "búsqueda: encuentra el propio y no el de otro taller", r.s);
r = await A("GET", "/api/products?bajoStock=1"); check(r.s === 200 && r.d.products.some((p) => p.id === pFiltro) && !r.d.products.some((p) => p.id === pAceite) && r.d.stockBajoCount >= 1, "filtro de stock bajo", `${r.s} ${r.d?.stockBajoCount}`);
r = await A("GET", `/api/products/${pAceite}`); check(r.s === 200 && r.d.unidad === "LITRO", "detalle", r.s);
const filtroBody = (extra = {}) => ({ nombre: `Filtro ${SUF}`, costo: 1600, precioVenta: 3200, stockMinimo: 2, ...extra });
r = await A("PUT", `/api/products/${pFiltro}`, filtroBody()); check(r.s === 200 && r.d.costo === 1600, "editar producto", r.s);
r = await A("PUT", `/api/products/${pFiltro}`, filtroBody({ activo: false })); check(r.s === 200 && r.d.activo === false, "desactivar producto", r.s);
r = await A("GET", "/api/products?estado=inactivos"); check(r.d?.products?.some((p) => p.id === pFiltro), "filtro de inactivos", r.s);
r = await A("PUT", `/api/products/${pFiltro}`, filtroBody({ activo: true })); check(r.s === 200, "reactivar", r.s);

section("2) Aislamiento entre talleres (HTTP)");
for (const [m, p, b] of [["GET", `/api/products/${pAceite}`], ["PUT", `/api/products/${pAceite}`, { nombre: "Intruso", costo: 1, precioVenta: 1 }], ["GET", `/api/products/${pAceite}/movements`], ["POST", "/api/stock/purchase", { productId: pAceite, cantidad: 1 }], ["POST", "/api/stock/adjust", { productId: pAceite, cantidad: 1, motivo: "intruso" }]]) {
  r = await B(m, p, b); check(r.s === 404, `Beta ${m} ${p.replace(pAceite, ":id")} -> 404`, r.s);
}
check((await stock(pAceite)) === 20, "el stock de Alfa no cambió por los intentos de Beta");

section("3) Compras, ajustes e historial");
r = await A("POST", "/api/stock/purchase", { productId: pAceite, cantidad: 5.5, costoUnitario: 4200, motivo: "Compra proveedor QA" }); check(r.s === 201 && r.d.stockResultante === 25.5, "compra de 5,5 L -> stock 25,5", `${r.s} ${r.d?.stockResultante}`);
r = await A("GET", `/api/products/${pAceite}`); check(r.d?.costo === 4200 && r.d.stockActual === 25.5, "el costo del producto sigue a la última compra");
r = await A("POST", "/api/stock/purchase", { productId: pAceite, cantidad: 0 }); check(r.s === 400, "compra de cantidad 0 -> 400", r.s);
r = await A("POST", "/api/stock/purchase", { productId: pAceite, cantidad: 1.2345 }); check(r.s === 400 && /3 decimales/.test(r.d?.error), "más de 3 decimales -> 400", r.d?.error);
r = await A("POST", "/api/stock/adjust", { productId: pAceite, cantidad: -0.5, motivo: "Derrame" }); check(r.s === 201 && r.d.stockResultante === 25, "ajuste -0,5 con motivo -> stock 25", r.s);
r = await A("POST", "/api/stock/adjust", { productId: pAceite, cantidad: -1 }); check(r.s === 400, "ajuste sin motivo -> 400", r.s);
r = await A("POST", "/api/stock/adjust", { productId: pAceite, cantidad: -999, motivo: "Prueba" }); check(r.s === 409 && /Stock insuficiente.*disponible 25 L/.test(r.d?.error), "ajuste que deja stock negativo -> 409 con detalle", `${r.s} ${r.d?.error}`);
r = await A("GET", `/api/products/${pAceite}/movements`); check(r.s === 200 && r.d.movements.length === 3 && r.d.movements[0].user?.email === "qa-alfa@example.invalid" && r.d.movements[0].tipo === "AJUSTE", "historial: 3 movimientos, el más reciente primero, con usuario", `${r.s} ${r.d?.movements?.length}`);

section("4) Ítems con producto en presupuestos y órdenes");
r = await A("POST", "/api/quotes", { clientId: cv.id, vehicleId: cv.vehicles[0].id, items: [item(pAceite, 3.5), { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 8000 }] });
check(r.s === 201 && r.d.items.find((i) => i.productId === pAceite)?.cantidad === 3.5 && r.d.total === 30750, "presupuesto con 3,5 L de un producto y mano de obra libre", `${r.s} ${r.d?.total}`);
const qid = r.d?.id;
r = await A("GET", `/api/quotes/${qid}`); check(r.s === 200 && typeof r.d.items[0].cantidad === "number", "el presupuesto se lee con cantidades numéricas", r.s);
r = await A("POST", "/api/quotes", { clientId: cv.id, vehicleId: cv.vehicles[0].id, items: [item(pBeta, 1)] }); check(r.s === 404, "presupuesto con producto de OTRO taller -> 404", `${r.s} ${r.d?.error}`);
await A("PUT", `/api/products/${pFiltro}`, filtroBody({ activo: false }));
r = await A("POST", "/api/quotes", { clientId: cv.id, vehicleId: cv.vehicles[0].id, items: [item(pFiltro, 1, "Filtro")] }); check(r.s === 409 && /inactivo/.test(r.d?.error), "presupuesto con producto inactivo -> 409", `${r.s} ${r.d?.error}`);
await A("PUT", `/api/products/${pFiltro}`, filtroBody({ activo: true }));
r = await A("POST", "/api/quotes", { clientId: cv.id, vehicleId: cv.vehicles[0].id, items: [{ descripcion: "x", cantidad: 0.0005, precioUnitario: 10 }] }); check(r.s === 400, "cantidad 0,0005 -> 400", r.s);
r = await A("PATCH", `/api/quotes/${qid}`, { status: "APROBADO" }); check(r.s === 200, "aprobar presupuesto", r.s);
r = await A("POST", "/api/work-orders", { clientId: cv.id, vehicleId: cv.vehicles[0].id, quoteId: qid, motivoIngreso: "Service con aceite", items: [item(pAceite, 3.5)] });
check(r.s === 201 && r.d.items.find((i) => i.productId === pAceite)?.cantidad === 3.5 && r.d.total === 30750, "la orden hereda productos, cantidades decimales y total del presupuesto", `${r.s} ${r.d?.total}`);
const wo1 = r.d?.id;
check((await stock(pAceite)) === 25 && (await movs(wo1)).length === 0, "crear la orden (APROBADA) NO descuenta stock todavía");

section("5) Cambio de estado: descuento al llegar a EN_PROCESO");
r = await A("PUT", `/api/work-orders/${wo1}/status`, { status: "EN_PROCESO" });
check(r.s === 200 && (await stock(pAceite)) === 21.5, "EN_PROCESO descuenta 3,5 L (25 -> 21,5)", `${r.s} stock=${await stock(pAceite)}`);
const m1 = await movs(wo1);
check(m1.length === 1 && m1[0].tipo === "SALIDA_ORDEN" && Number(m1[0].cantidad) === -3.5 && m1[0].userId === A.userId, "movimiento SALIDA_ORDEN de -3,5 con el usuario de la sesión", JSON.stringify(m1.map((m) => m.tipo)));
check((await db.auditLog.count({ where: { entityId: m1[0].id, accion: "STOCK_CONSUMED", userId: A.userId } })) === 1, "auditoría STOCK_CONSUMED con usuario");
r = await A("PUT", `/api/work-orders/${wo1}/status`, { status: "EN_PROCESO" }); check(r.s === 400, "repetir el mismo estado -> 400 (el estado solo avanza)", r.s);
check((await stock(pAceite)) === 21.5 && (await movs(wo1)).length === 1, "el reintento no descuenta de nuevo");
r = await A("PUT", `/api/work-orders/${wo1}/status`, { status: "APROBADA" }); check(r.s === 400, "retroceder de estado -> 400", r.s);
check((await stock(pAceite)) === 21.5 && (await movs(wo1)).length === 1, "retroceder NO genera devoluciones automáticas");
r = await A("PUT", `/api/work-orders/${wo1}/status`, { status: "TERMINADA" }); check(r.s === 200 && (await stock(pAceite)) === 21.5, "TERMINADA no vuelve a descontar", r.s);

section("6) Faltante de stock: 409, nada a medias");
const wo2 = await newOrder("Mucho aceite", [item(pAceite, 100)]);
r = await A("PUT", `/api/work-orders/${wo2}/status`, { status: "EN_PROCESO" });
check(r.s === 409 && /Stock insuficiente.*Aceite 5W30.*disponible 21,5 L.*necesario 100 L/.test(r.d?.error), "EN_PROCESO sin stock -> 409 con producto, disponible y necesario", `${r.s} ${r.d?.error}`);
r = await A("GET", `/api/work-orders/${wo2}`); check(r.d?.status === "APROBADA", "la orden sigue APROBADA (el cambio de estado se revirtió)", r.d?.status);
check((await movs(wo2)).length === 0 && (await stock(pAceite)) === 21.5, "sin movimientos ni cambio de stock");
r = await A("POST", "/api/stock/purchase", { productId: pAceite, cantidad: 80 }); check(r.s === 201, "se carga la compra faltante", r.s);
r = await A("PUT", `/api/work-orders/${wo2}/status`, { status: "EN_PROCESO" }); check(r.s === 200 && (await stock(pAceite)) === 1.5, "reintento tras la compra: descuenta 100 (101,5 -> 1,5)", `${r.s} ${await stock(pAceite)}`);

section("7) Dos pedidos simultáneos de cambio de estado sobre la misma orden");
const wo3 = await newOrder("Carrera", [item(pAceite, 1)]);
const race = await Promise.all([A("PUT", `/api/work-orders/${wo3}/status`, { status: "EN_PROCESO" }), A("PUT", `/api/work-orders/${wo3}/status`, { status: "EN_PROCESO" })]);
check(race.map((x) => x.s).sort().join() === "200,400", "uno avanza (200) y el otro recibe 400; ninguno da 500", race.map((x) => x.s).join());
check((await movs(wo3)).length === 1 && (await stock(pAceite)) === 0.5, "se descontó una sola vez (1,5 -> 0,5)", `${(await movs(wo3)).length} ${await stock(pAceite)}`);
const wo4 = await newOrder("Salto de estado", [item(pAceite, 0.5)]);
r = await A("PUT", `/api/work-orders/${wo4}/status`, { status: "TERMINADA" }); check(r.s === 200 && (await stock(pAceite)) === 0, "saltar de APROBADA a TERMINADA también descuenta (stock 0)", `${r.s} ${await stock(pAceite)}`);

section("8) Edición de ítems y devoluciones explícitas");
await A("POST", "/api/stock/purchase", { productId: pAceite, cantidad: 50 });
const stock0 = await stock(pAceite);
const wo5 = await newOrder("Edición", [item(pAceite, 2), { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 1000 }]);
await A("PUT", `/api/work-orders/${wo5}/status`, { status: "EN_PROCESO" });
check((await stock(pAceite)) === stock0 - 2, "EN_PROCESO descuenta 2");
r = await A("POST", `/api/work-orders/${wo5}/add-item`, item(pAceite, 1.5)); check(r.s === 201 && (await stock(pAceite)) === stock0 - 3.5, "add-item con producto en una orden en proceso descuenta 1,5", `${r.s} ${await stock(pAceite)}`);
r = await editOrder(wo5, [item(pAceite, 1), { descripcion: "Mano de obra", cantidad: 1, precioUnitario: 1000 }]);
check(r.s === 200 && (await stock(pAceite)) === stock0 - 3.5, "reducir el ítem a 1 NO repone stock (el repuesto pudo usarse)", `${r.s} ${await stock(pAceite)}`);
check((await movs(wo5)).filter((m) => m.tipo === "DEVOLUCION").length === 0, "no se creó ninguna devolución automática");
r = await A("GET", `/api/work-orders/${wo5}/stock`);
const linea = r.d?.productos?.find((p) => p.productId === pAceite);
check(r.s === 200 && linea && linea.solicitado === 1 && linea.consumido === 3.5 && linea.excedente === 2.5 && linea.devuelto === 0 && linea.nombre.startsWith("Aceite"), "resumen de stock de la orden: pedido 1, descontado 3,5, excedente devolvible 2,5", JSON.stringify(linea));
r = await A("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 3, motivo: "Repuesto sin usar" }); check(r.s === 409 && /hasta 2,5 L/.test(r.d?.error), "devolver más que el excedente -> 409 con el máximo", `${r.s} ${r.d?.error}`);
r = await A("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 1 }); check(r.s === 400, "devolución sin motivo -> 400", r.s);
r = await B("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 1, motivo: "Intruso" }); check(r.s === 404, "Beta no puede devolver en una orden de Alfa -> 404", r.s);
r = await A("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 2.5, motivo: "Cliente no usó el aceite; envases cerrados recuperados" });
check(r.s === 201 && r.d.tipo === "DEVOLUCION" && r.d.stockResultante === stock0 - 1, "devolución de 2,5 con motivo: el stock vuelve a stock0 - 1", `${r.s} ${r.d?.stockResultante}`);
const devId = r.d?.id;
check((await stock(pAceite)) === stock0 - 1 && (await db.auditLog.count({ where: { entityId: devId, accion: "STOCK_RETURNED", userId: A.userId } })) === 1, "queda auditada como STOCK_RETURNED con el usuario");
r = await A("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 0.5, motivo: "Otra vez" }); check(r.s === 409 && /todavía piden 1 L/.test(r.d?.error), "ya no hay excedente: lo que los ítems piden no se devuelve -> 409", `${r.s} ${r.d?.error}`);
r = await A("GET", `/api/work-orders/${wo5}`); const itemP = r.d.items.find((i) => i.productId === pAceite);
r = await A("DELETE", `/api/work-orders/${wo5}/items/${itemP.id}`); check(r.s === 200 && (await stock(pAceite)) === stock0 - 1, "quitar el ítem del producto tampoco repone stock", `${r.s} ${await stock(pAceite)}`);
r = await A("POST", "/api/stock/returns", { workOrderId: wo5, productId: pAceite, cantidad: 1, motivo: "Se recupera la unidad restante" }); check(r.s === 201 && (await stock(pAceite)) === stock0, "con el ítem quitado se puede devolver lo que quedaba (1)", `${r.s} ${await stock(pAceite)}`);
r = await editOrder(wo5, [item(pAceite, 1000), { descripcion: "x", cantidad: 1, precioUnitario: 1 }]);
check(r.s === 409 && /Stock insuficiente/.test(r.d?.error), "PUT que pide más de lo disponible -> 409", `${r.s} ${r.d?.error}`);
r = await A("GET", `/api/work-orders/${wo5}`); check(!r.d.items.some((i) => i.cantidad === 1000) && (await stock(pAceite)) === stock0, "y los ítems quedaron como estaban (transacción revertida)");
const wo6 = await newOrder("Sin consumo", [item(pAceite, 4)]);
r = await editOrder(wo6, [item(pAceite, 6)]); check(r.s === 200 && (await movs(wo6)).length === 0 && (await stock(pAceite)) === stock0, "editar una orden APROBADA no toca el stock", r.s);
r = await A("POST", "/api/stock/returns", { workOrderId: wo6, productId: pAceite, cantidad: 1, motivo: "Prueba" }); check(r.s === 409 && /no descontó/.test(r.d?.error), "una orden que no descontó el producto no admite devolución -> 409", `${r.s} ${r.d?.error}`);
r = await A("PUT", `/api/work-orders/${wo1}/status`, { status: "ENTREGADA" }); check(r.s === 200, "entregar", r.s);
r = await A("POST", `/api/work-orders/${wo1}/add-item`, item(pAceite, 1)); check(r.s === 409, "orden entregada no admite ítems -> 409", r.s);

section("9) Política de stock negativo (HTTP)");
r = await A("GET", "/api/stock/settings"); check(r.s === 200 && r.d.permitirStockNegativo === false, "por defecto no se permite", JSON.stringify(r.d));
r = await A("PUT", "/api/stock/settings", { permitirStockNegativo: "si" }); check(r.s === 400, "valor inválido -> 400", r.s);
const pEscaso = (await A("POST", "/api/products", { nombre: `Escaso ${SUF}`, stockInicial: 1 })).d?.id;
const wo7 = await newOrder("Negativo", [item(pEscaso, 3)]);
r = await A("PUT", `/api/work-orders/${wo7}/status`, { status: "EN_PROCESO" }); check(r.s === 409, "sin política: 409", r.s);
r = await A("PUT", "/api/stock/settings", { permitirStockNegativo: true }); check(r.s === 200 && r.d.permitirStockNegativo === true, "se habilita el stock negativo", r.s);
r = await A("PUT", `/api/work-orders/${wo7}/status`, { status: "EN_PROCESO" }); check(r.s === 200 && (await stock(pEscaso)) === -2, "con la política habilitada pasa y el stock queda en -2", `${r.s} ${await stock(pEscaso)}`);
r = await A("PUT", "/api/stock/settings", { permitirStockNegativo: false }); check(r.s === 200, "se deshabilita", r.s);
check((await db.auditLog.count({ where: { tallerId: alfa.tallerId, accion: "STOCK_POLICY_CHANGED", userId: A.userId, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } })) >= 2, "ambos cambios de política quedaron auditados");
r = await B("GET", "/api/stock/settings"); check(r.d?.permitirStockNegativo === false, "la política de Alfa no afecta a Beta");

section("10) Dashboard y estado final");
r = await A("GET", "/api/dashboard/stats");
const activos = await db.product.findMany({ where: { tallerId: alfa.tallerId, activo: true }, select: { stockActual: true, stockMinimo: true } });
const esperados = activos.filter((p) => Number(p.stockActual) <= Number(p.stockMinimo)).length;
const top = r.d?.stockBajo?.productos ?? [];
const brecha = (p) => p.stockActual - p.stockMinimo;
check(r.s === 200 && r.d.stockBajo?.total === esperados && esperados >= 1, "el dashboard informa la cantidad exacta de productos con stock bajo", `${r.s} total=${r.d?.stockBajo?.total} esperado=${esperados}`);
check(top.length === Math.min(5, esperados) && top.every((p, i) => i === 0 || brecha(top[i - 1]) <= brecha(p)) && typeof top[0]?.stockActual === "number", "y lista hasta 5, los más críticos primero, con stock numérico", JSON.stringify(top).slice(0, 160));
const prods = await db.product.findMany({ where: { tallerId: alfa.tallerId, id: { in: [pAceite, pFiltro, pEscaso] } } });
for (const p of prods) {
  const sum = Number((await db.stockMovement.aggregate({ where: { productId: p.id }, _sum: { cantidad: true } }))._sum.cantidad ?? 0);
  check(sum === Number(p.stockActual), `stockActual de "${p.nombre.slice(0, 18)}" (${p.stockActual}) = suma del libro (${sum})`);
}
const all = { ...A.statuses };
for (const [code, n] of Object.entries(B.statuses)) all[code] = (all[code] ?? 0) + n;
check(!Object.keys(all).some((s) => Number(s) >= 500), `ninguna respuesta 5xx (códigos: ${JSON.stringify(all)})`);
info("Los datos creados quedan en la base de QA (el libro de stock es inmutable): usar una branch descartable.");

finish();
await db.$disconnect();
