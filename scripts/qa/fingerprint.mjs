// Huella por tabla (solo lectura) para comprobar que una migración conserva exactamente los datos existentes.
//
//   npm run qa:fingerprint -- antes.json                       guarda la huella actual (antes de migrar)
//   npm run qa:fingerprint -- --compare antes.json             compara el estado actual contra esa huella (después de migrar)
//
// Las columnas que cambian con la migración de Stock (cantidad, productId, permitirStockNegativo) se comparan por valor,
// de modo que "2" (entero) y "2.000" (decimal) cuentan como iguales.
import fs from "node:fs";
import { connectPg, target } from "./lib/common.mjs";

const args = process.argv.slice(2);
const compareIdx = args.indexOf("--compare");
const cmpFile = compareIdx === -1 ? null : args[compareIdx + 1];
const outFile = compareIdx === -1 ? args[0] : null;
if (!cmpFile && !outFile) throw new Error("Indicá el archivo de salida o --compare <archivo>.");

const db = await connectPg({ appName: "qa-fingerprint" });
await db.query("BEGIN READ ONLY");
const q = async (sql) => (await db.query(sql)).rows;

const plain = ["users", "user_tallers", "clients", "vehicles", "quotes", "work_orders", "payments", "payment_methods", "cash_movements", "daily_closes", "client_credits", "technicians", "costs", "goals", "schedules", "audit_logs", "revoked_sessions"];
const fp = {};
for (const t of plain) {
  const [r] = await q(`SELECT count(*)::int n, md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) h FROM "${t}" x`);
  fp[t] = r;
}
fp.tallers = (await q(`SELECT count(*)::int n, md5(coalesce(string_agg(concat_ws('|',id,nombre,telefono,email,direccion,logo,"createdAt","updatedAt"), '#' ORDER BY id), '')) h FROM tallers`))[0];
fp.quote_items = (await q(`SELECT count(*)::int n, md5(coalesce(string_agg(concat_ws('|',id,"quoteId",descripcion,cantidad::float8,"precioUnitario",subtotal,"createdAt","updatedAt"), '#' ORDER BY id), '')) h FROM quote_items`))[0];
fp.work_order_items = (await q(`SELECT count(*)::int n, md5(coalesce(string_agg(concat_ws('|',id,"workOrderId",descripcion,cantidad::float8,"precioUnitario",subtotal,"createdAt","updatedAt"), '#' ORDER BY id), '')) h FROM work_order_items`))[0];

const inv = {};
inv.ordenes_total_igual_suma_items = (await q(`SELECT count(*)::int n FROM work_orders w WHERE round(w.total::numeric,2) <> round(coalesce((SELECT sum(subtotal) FROM work_order_items i WHERE i."workOrderId"=w.id),0)::numeric,2)`))[0].n === 0;
inv.presupuestos_total_igual_suma_items = (await q(`SELECT count(*)::int n FROM quotes w WHERE round(w.total::numeric,2) <> round(coalesce((SELECT sum(subtotal) FROM quote_items i WHERE i."quoteId"=w.id),0)::numeric,2)`))[0].n === 0;
inv.auditoria_sin_usuario = (await q(`SELECT count(*)::int n FROM audit_logs WHERE "userId" IS NULL`))[0].n;
inv.huerfanos_items_orden = (await q(`SELECT count(*)::int n FROM work_order_items i LEFT JOIN work_orders w ON w.id=i."workOrderId" WHERE w.id IS NULL`))[0].n;
inv.huerfanos_items_presupuesto = (await q(`SELECT count(*)::int n FROM quote_items i LEFT JOIN quotes w ON w.id=i."quoteId" WHERE w.id IS NULL`))[0].n;
inv.patentes_duplicadas_por_taller = (await q(`SELECT count(*)::int n FROM (SELECT "tallerId", patente FROM vehicles GROUP BY 1,2 HAVING count(*)>1) z`))[0].n;
await db.query("ROLLBACK");

if (cmpFile) {
  const before = JSON.parse(fs.readFileSync(cmpFile, "utf8"));
  let bad = 0;
  for (const t of Object.keys(before.fp)) {
    const same = before.fp[t].n === fp[t].n && before.fp[t].h === fp[t].h;
    if (!same) bad++;
    console.log(`  ${same ? "OK   " : "FALLA"} ${t}: ${before.fp[t].n} -> ${fp[t].n} filas, huella ${same ? "idéntica" : "DISTINTA"}`);
  }
  console.log(bad ? `RESULTADO: ${bad} tablas con diferencias` : "RESULTADO: todas las tablas conservan exactamente sus datos");
  process.exitCode = bad ? 1 : 0;
} else {
  fs.writeFileSync(outFile, JSON.stringify({ endpoint: target.endpoint, fp, inv }, null, 1));
  console.log(`[QA] huella guardada en ${outFile} (${Object.keys(fp).length} tablas)`);
  console.log("filas:", Object.entries(fp).map(([k, v]) => `${k}=${v.n}`).join(" "));
  console.log("invariantes:", JSON.stringify(inv));
}
await db.end();
