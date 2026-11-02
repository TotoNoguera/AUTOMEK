// Verificaciones a nivel base de datos de la migración de Stock (triggers, CHECK, claves compuestas, concurrencia real con
// conexiones independientes y fuga de estado de sesión con pooler). No depende del código de la aplicación.
//
//   npm run qa:db:checks                       (conexión directa)
//   QA_VIA_POOLER=1 npm run qa:db:checks       (por el pooler, como producción)
//
// Crea sus propios talleres en cada corrida y deja datos (el libro de movimientos es inmutable): usar una branch de QA descartable.
import { connectPg, createChecker, randomHex, race, sleep, target, viaPooler } from "./lib/common.mjs";

const { check, section, finish } = createChecker();
const RUN = randomHex(3);
const admin = await connectPg({ appName: "qa-db-checks" });
const q = async (c, sql, p = []) => (await c.query(sql, p)).rows;
const one = async (c, sql, p = []) => (await q(c, sql, p))[0];
console.log(`[QA] db-checks: endpoint=${target.endpoint} vía ${viaPooler ? "POOLER" : "conexión directa"} | corrida ${RUN}`);

// ---------- talleres propios de la corrida ----------
async function tenant(label) {
  const user = await one(admin, `INSERT INTO users(id,email,password,name,"updatedAt") VALUES (gen_random_uuid()::text,$1,'no-se-usa',$2,now()) RETURNING id`, [`dbchk-${label}-${RUN}@example.invalid`, `DB ${label}`]);
  const taller = await one(admin, `INSERT INTO tallers(id,nombre,"updatedAt") VALUES (gen_random_uuid()::text,$1,now()) RETURNING id`, [`QA db-checks ${label} ${RUN}`]);
  await admin.query(`INSERT INTO user_tallers(id,"userId","tallerId","updatedAt") VALUES (gen_random_uuid()::text,$1,$2,now())`, [user.id, taller.id]);
  const client = await one(admin, `INSERT INTO clients(id,"tallerId",nombre,"updatedAt") VALUES (gen_random_uuid()::text,$1,'Cliente',now()) RETURNING id`, [taller.id]);
  const vehicle = await one(admin, `INSERT INTO vehicles(id,"clientId","tallerId",patente,marca,modelo,anio,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,'Ford','Ka',2020,now()) RETURNING id`, [client.id, taller.id, `D${RUN.toUpperCase()}${label}`]);
  const orders = [];
  for (let i = 0; i < 4; i++) {
    orders.push((await one(admin, `INSERT INTO work_orders(id,"tallerId","clientId","vehicleId","motivoIngreso",total,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,'Prueba',0,now()) RETURNING id`, [taller.id, client.id, vehicle.id])).id);
  }
  const quote = await one(admin, `INSERT INTO quotes(id,"tallerId","clientId","vehicleId",total,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,0,now()) RETURNING id`, [taller.id, client.id, vehicle.id]);
  return { tallerId: taller.id, userId: user.id, orders, quoteId: quote.id };
}
const A = await tenant("A");
const B = await tenant("B");

const newProduct = (t, nombre, { sku = null, minimo = 0 } = {}) =>
  one(admin, `INSERT INTO products(id,"tallerId",nombre,sku,unidad,costo,"precioVenta","stockMinimo","updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,'UNIDAD',10,20,$4,now()) RETURNING id`, [t.tallerId, `${nombre} ${RUN}`, sku, minimo]).then((r) => r.id);
const move = (c, t, { productId, wo = null, tipo, cantidad, motivo = null }) =>
  c.query(`INSERT INTO stock_movements(id,"tallerId","productId","workOrderId",tipo,cantidad,motivo,"userId") VALUES (gen_random_uuid()::text,$1,$2,$3,$4::"StockMovementType",$5,$6,$7) RETURNING "stockResultante"::text sr`, [t.tallerId, productId, wo, tipo, cantidad, motivo, t.userId]);
const stockOf = async (id) => Number((await one(admin, `SELECT "stockActual"::text s FROM products WHERE id=$1`, [id])).s);
const rejects = async (fn, name, re) => {
  try { await fn(); check(false, `${name} (no falló)`); } catch (e) { check(!re || re.test(e.message), `${name} -> [${e.code}] ${e.message.slice(0, 70)}`); }
};
const tx = async (c, fn) => { await c.query("BEGIN"); try { const v = await fn(); await c.query("COMMIT"); return v; } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } };
const newConn = (i) => connectPg({ appName: `qa-race-${i}` });

section("1) Integridad funcional");
const p1 = await newProduct(A, "Aceite", { sku: `ACE-${RUN}`, minimo: 2 });
check((await stockOf(p1)) === 0, "producto nuevo empieza con stock 0");
await move(admin, A, { productId: p1, tipo: "ENTRADA_COMPRA", cantidad: 10 });
await move(admin, A, { productId: p1, wo: A.orders[0], tipo: "SALIDA_ORDEN", cantidad: -3.5 });
check((await stockOf(p1)) === 6.5, "entrada 10 y salida -3,5 (fracción) -> stock 6,5");
check(Number((await one(admin, `SELECT "stockResultante"::text s FROM stock_movements WHERE "productId"=$1 ORDER BY "stockResultante" LIMIT 1`, [p1])).s) === 6.5, "stockResultante lo completa el trigger");
await rejects(() => move(admin, A, { productId: p1, wo: A.orders[0], tipo: "SALIDA_ORDEN", cantidad: -7 }), "salida que deja stock negativo (política por defecto)", /Stock insuficiente/);
check((await stockOf(p1)) === 6.5, "el stock no cambió tras el rechazo");
await admin.query(`UPDATE tallers SET "permitirStockNegativo"=true WHERE id=$1`, [A.tallerId]);
await move(admin, A, { productId: p1, wo: A.orders[0], tipo: "SALIDA_ORDEN", cantidad: -7 });
check((await stockOf(p1)) === -0.5, "con permitirStockNegativo=true se permite (stock -0,5)");
await admin.query(`UPDATE tallers SET "permitirStockNegativo"=false WHERE id=$1`, [A.tallerId]);
await move(admin, A, { productId: p1, wo: A.orders[0], tipo: "DEVOLUCION", cantidad: 1, motivo: "Devolución explícita del cliente" });
await move(admin, A, { productId: p1, tipo: "AJUSTE", cantidad: -0.5, motivo: "Conteo físico" });
check((await stockOf(p1)) === 0, "devolución explícita y ajuste -> stock 0");
await rejects(() => admin.query(`UPDATE products SET "stockActual"=99 WHERE id=$1`, [p1]), "UPDATE directo de stockActual", /movimientos de stock/);
await rejects(() => admin.query(`UPDATE products SET "tallerId"=$2 WHERE id=$1`, [p1, B.tallerId]), "cambiar un producto de taller", /cambiar de taller/);
await rejects(() => admin.query(`INSERT INTO products(id,"tallerId",nombre,"stockActual","updatedAt") VALUES (gen_random_uuid()::text,$1,'n',5,now())`, [A.tallerId]), "producto nuevo con stock != 0", /stock 0/);
await rejects(() => admin.query(`UPDATE stock_movements SET motivo='x' WHERE "productId"=$1`, [p1]), "UPDATE de un movimiento", /inmutables/);
await rejects(() => admin.query(`DELETE FROM stock_movements WHERE "productId"=$1`, [p1]), "DELETE de un movimiento", /inmutables/);
await rejects(() => admin.query(`TRUNCATE stock_movements`), "TRUNCATE del libro", /inmutables/);
await rejects(() => admin.query(`DELETE FROM products WHERE id=$1`, [p1]), "borrar producto con movimientos", /foreign key|RESTRICT/);
await rejects(() => newProduct(A, "Dup", { sku: `ACE-${RUN}` }), "SKU repetido en el mismo taller", /unique|duplicate/);
await newProduct(B, "Aceite Beta", { sku: `ACE-${RUN}` });
check(true, "el mismo SKU en otro taller se permite");
const pChk = await newProduct(A, "Chequeos");
await move(admin, A, { productId: pChk, tipo: "ENTRADA_COMPRA", cantidad: 5 }); // con stock, para que los CHECK se evalúen antes que la política
await rejects(() => move(admin, A, { productId: pChk, tipo: "ENTRADA_COMPRA", cantidad: -1 }), "entrada negativa", /signo_por_tipo/);
await rejects(() => move(admin, A, { productId: pChk, tipo: "SALIDA_ORDEN", cantidad: -1 }), "salida sin orden", /orden_requerida/);
await rejects(() => move(admin, A, { productId: pChk, tipo: "AJUSTE", cantidad: 1 }), "ajuste sin motivo", /motivo_requerido/);
await rejects(() => move(admin, A, { productId: pChk, tipo: "DEVOLUCION", cantidad: 1, wo: A.orders[0] }), "devolución sin motivo", /motivo_requerido/);
await rejects(() => move(admin, A, { productId: pChk, tipo: "AJUSTE", cantidad: 0, motivo: "x" }), "cantidad 0", /no_cero/);
await rejects(() => move(admin, B, { productId: p1, tipo: "ENTRADA_COMPRA", cantidad: 1 }), "movimiento del taller B sobre un producto del taller A", /no existe en este taller|foreign key/);
await rejects(() => move(admin, A, { productId: p1, wo: B.orders[0], tipo: "SALIDA_ORDEN", cantidad: -1 }), "movimiento con una orden de otro taller", /no pertenece al taller/);
const ajeno1 = await newProduct(B, "Ajeno 1");
const ajeno2 = await newProduct(B, "Ajeno 2");
await rejects(() => admin.query(`INSERT INTO quote_items(id,"quoteId","productId",descripcion,cantidad,"precioUnitario",subtotal,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,'x',1,1,1,now())`, [A.quoteId, ajeno1]), "ítem de presupuesto con producto de otro taller", /no pertenece al taller del presupuesto/);
await rejects(() => admin.query(`INSERT INTO work_order_items(id,"workOrderId","productId",descripcion,cantidad,"precioUnitario",subtotal,"updatedAt") VALUES (gen_random_uuid()::text,$1,$2,'x',1,1,1,now())`, [A.orders[0], ajeno2]), "ítem de orden con producto de otro taller", /no pertenece al taller de la orden/);

section("2) Diez movimientos simultáneos sobre un mismo producto (10 conexiones independientes)");
const p2 = await newProduct(A, "Concurrente");
let r = await race(10, newConn, (c) => tx(c, () => move(c, A, { productId: p2, tipo: "ENTRADA_COMPRA", cantidad: 1 })));
check(r.results.every((x) => x.ok), `10 entradas simultáneas confirmadas (${r.ms} ms)`, r.results.filter((x) => !x.ok).map((x) => x.error.message).join("; "));
check((await stockOf(p2)) === 10, "stockActual = 10");
const chain = (await q(admin, `SELECT "stockResultante"::text s FROM stock_movements WHERE "productId"=$1 ORDER BY "stockResultante"`, [p2])).map((x) => Number(x.s));
check(JSON.stringify(chain) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), "stockResultante forma la cadena 1..10 sin repetidos", chain.join(","));
const p2b = await newProduct(A, "Mixto");
await move(admin, A, { productId: p2b, tipo: "ENTRADA_COMPRA", cantidad: 20 });
r = await race(10, newConn, (c, i) => tx(c, () => (i % 2 ? move(c, A, { productId: p2b, wo: A.orders[0], tipo: "SALIDA_ORDEN", cantidad: -1.25 }) : move(c, A, { productId: p2b, tipo: "ENTRADA_COMPRA", cantidad: 2.5 }))));
check(r.results.every((x) => x.ok) && (await stockOf(p2b)) === 26.25, "5 entradas de 2,5 y 5 salidas de 1,25 simultáneas -> 26,25", String(await stockOf(p2b)));

section("3) Competencia por stock limitado");
const p3 = await newProduct(A, "Escaso");
await move(admin, A, { productId: p3, tipo: "ENTRADA_COMPRA", cantidad: 5 });
r = await race(10, newConn, (c) => tx(c, () => move(c, A, { productId: p3, wo: A.orders[0], tipo: "SALIDA_ORDEN", cantidad: -1 })));
const okN = r.results.filter((x) => x.ok).length;
const bad = r.results.filter((x) => !x.ok);
check(okN === 5 && bad.length === 5, "10 salidas de 1 con stock 5 -> exactamente 5 aceptadas y 5 rechazadas", `${okN}/${bad.length}`);
check(bad.every((x) => x.error.code === "23514" && /^Stock insuficiente/.test(x.error.message)), "todos los rechazos son SQLSTATE 23514 'Stock insuficiente…' (mapeables a HTTP 409)");
check((await stockOf(p3)) === 0, "stock final 0, nunca negativo");

section("4) Deadlocks: control positivo y orden uniforme");
const p4a = await newProduct(A, "Orden A");
const p4b = await newProduct(A, "Orden B");
await move(admin, A, { productId: p4a, tipo: "ENTRADA_COMPRA", cantidad: 100 });
await move(admin, A, { productId: p4b, tipo: "ENTRADA_COMPRA", cantidad: 100 });
const [lo, hi] = [p4a, p4b].sort();
const crossed = await race(2, newConn, (c, i) => tx(c, async () => {
  const [x, y] = i === 0 ? [lo, hi] : [hi, lo];
  await move(c, A, { productId: x, tipo: "AJUSTE", cantidad: 1, motivo: "cruce" });
  await sleep(400);
  await move(c, A, { productId: y, tipo: "AJUSTE", cantidad: 1, motivo: "cruce" });
}));
check(crossed.results.filter((x) => !x.ok && x.error.code === "40P01").length === 1, "SIN orden fijo PostgreSQL detecta un deadlock (40P01): la prueba es sensible al problema", crossed.results.map((x) => (x.ok ? "ok" : x.error.code)).join());
let deadlocks = 0;
for (let k = 0; k < 6; k++) {
  const rr = await race(6, newConn, (c, i) => tx(c, async () => {
    await c.query(`SELECT id FROM work_orders WHERE id=$1 FOR UPDATE`, [A.orders[i % 2]]); // primero la orden
    for (const pid of [lo, hi]) await move(c, A, { productId: pid, wo: A.orders[i % 2], tipo: "SALIDA_ORDEN", cantidad: -0.001 }); // luego los productos por id
  }));
  deadlocks += rr.results.filter((x) => !x.ok && x.error.code === "40P01").length;
}
check(deadlocks === 0, "CON orden fijo (orden y luego productos por id): 0 deadlocks en 6 rondas x 6 transacciones", String(deadlocks));

section("5) Fuga de estado de sesión (relevante con pooler)");
const pLeak = await newProduct(A, "Fuga");
const leaks = await race(6, newConn, async (c) => {
  let rejected = 0;
  let leaked = 0;
  for (let i = 0; i < 15; i++) {
    await tx(c, () => move(c, A, { productId: pLeak, tipo: "ENTRADA_COMPRA", cantidad: 1 }));
    if ((await c.query("SELECT current_setting('automek.stock_writer', true) v")).rows[0].v === "1") leaked++;
    try { await c.query('UPDATE products SET "stockActual" = 999 WHERE id = $1', [pLeak]); } catch (e) { if (/movimientos de stock/.test(e.message)) rejected++; }
  }
  return { rejected, leaked };
});
check(leaks.results.every((x) => x.ok), "6 conexiones x 15 iteraciones sin errores inesperados", leaks.results.filter((x) => !x.ok).map((x) => x.error.message).join(";"));
check(leaks.results.every((x) => x.ok && x.value.leaked === 0), "el indicador interno nunca queda en '1' fuera de la transacción");
check(leaks.results.every((x) => x.ok && x.value.rejected === 15), "todos los UPDATE directos de stockActual fueron rechazados (90 de 90)");
check((await stockOf(pLeak)) === 90, "stock final 90 = 90 entradas");

section("6) Conciliación global (productos de esta corrida)");
const mismatches = await one(admin, `SELECT count(*)::int n FROM products p WHERE p."tallerId" = ANY($1) AND p."stockActual" <> coalesce((SELECT sum(cantidad) FROM stock_movements m WHERE m."productId"=p.id),0)`, [[A.tallerId, B.tallerId]]);
const negatives = await one(admin, `SELECT count(*)::int n FROM products WHERE "tallerId" = ANY($1) AND "stockActual" < 0`, [[A.tallerId, B.tallerId]]);
check(mismatches.n === 0, "stockActual coincide con la suma del libro en todos los productos", String(mismatches.n));
check(negatives.n === 0, "ningún producto con stock negativo (política por defecto)");

finish();
await admin.end();
