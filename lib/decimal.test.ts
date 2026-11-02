import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { D, MAX_SAFE_DIGITS } from "./decimal";
import { round2 } from "./money";

const roundTrip = (d: Prisma.Decimal) => JSON.parse(JSON.stringify({ v: d })).v as number | string;

describe("serializador JSON de Decimal", () => {
  it("entrega números (no texto) para los valores de DECIMAL(12,3)", () => {
    expect(roundTrip(D("2"))).toBe(2);
    expect(roundTrip(D("0.001"))).toBe(0.001);
    expect(roundTrip(D("25.500"))).toBe(25.5);
    expect(roundTrip(D("-3.125"))).toBe(-3.125);
    expect(roundTrip(D("999999999.999"))).toBe(999999999.999);
  });

  it("no pierde precisión: 20.000 valores aleatorios de 12 dígitos vuelven idénticos", () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 20_000; i++) {
      const units = Math.floor(rnd() * 1e12); // 12 dígitos = unidades de milésimas
      const d = D(units).div(1000);
      const back = roundTrip(d);
      expect(typeof back).toBe("number");
      expect(D(back as number).equals(d), `valor ${d.toString()}`).toBe(true);
    }
  });

  it("anidado en objetos y arreglos (como en las respuestas de la API)", () => {
    const payload = { id: "x", items: [{ cantidad: D("1.250"), precioUnitario: 100.5 }], producto: { stockActual: D("0.5") } };
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ id: "x", items: [{ cantidad: 1.25, precioUnitario: 100.5 }], producto: { stockActual: 0.5 } });
  });

  it("si un valor excediera los dígitos seguros, se entrega como TEXTO (nunca se redondea)", () => {
    const grande = D("12345678901234567.89");
    expect(grande.sd(true)).toBeGreaterThan(MAX_SAFE_DIGITS);
    expect(roundTrip(grande)).toBe("12345678901234567.89");
  });

  it("no altera la serialización de valores que no son Decimal", () => {
    const sample = { n: 1.5, s: "texto", b: true, nul: null, f: new Date("2026-01-02T03:04:05.000Z"), arr: [1, 2, 3], money: 0.1 + 0.2 };
    expect(JSON.stringify(sample)).toBe('{"n":1.5,"s":"texto","b":true,"nul":null,"f":"2026-01-02T03:04:05.000Z","arr":[1,2,3],"money":0.30000000000000004}');
  });
});

describe("alcance: solo las columnas de cantidad y stock son Decimal", () => {
  it("el schema no tiene otras columnas Decimal (dinero, caja y pagos siguen siendo Float)", () => {
    const schema = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
    const found: string[] = [];
    let model = "";
    for (const line of schema.split(/\r?\n/)) {
      const m = line.match(/^model\s+(\w+)\s*\{/);
      if (m) model = m[1];
      if (/^\}/.test(line)) model = "";
      const f = line.match(/^\s+(\w+)\s+Decimal\b/);
      if (model && f) found.push(`${model}.${f[1]}`);
    }
    expect(found.sort()).toEqual(
      ["Product.stockActual", "Product.stockMinimo", "QuoteItem.cantidad", "StockMovement.cantidad", "StockMovement.stockResultante", "WorkOrderItem.cantidad"].sort()
    );
  });
});

describe("dinero como Float con round2 (decisión: se mantiene en los campos nuevos de productos y movimientos)", () => {
  it("cualquier importe de 2 decimales hasta 1.000.000.000 se conserva exacto tras round2 y JSON", () => {
    let seed = 987654;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 50_000; i++) {
      const cents = Math.floor(rnd() * 1e11);
      const amount = cents / 100;
      expect(round2(amount)).toBe(amount);
      expect(JSON.parse(JSON.stringify(amount))).toBe(amount);
      expect(Math.round(Number(amount.toFixed(2)) * 100)).toBe(cents);
    }
  });

  it("el margen (precio − costo) y el subtotal se redondean a centavos sin residuos", () => {
    expect(round2(6500 - 4199.95)).toBe(2300.05);
    expect(round2(0.1 * 3)).toBe(0.3);
    expect(round2(2.5 * 1234.56)).toBe(3086.4);
  });
});
