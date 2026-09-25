import { describe, expect, it } from "vitest";
import { addDays, dayRangeAR, isValidDateString, monthRangeAR, shiftMonth, startOfDayAR } from "./dates";
import { pendingAmount, round2 } from "./money";
import { normalizeText, phoneDigits } from "./text";
import { buildWhatsAppLink, normalizePhoneForWhatsApp } from "./whatsapp";
import { ClientSchema, DailyCloseSchema, GoalSchema, QuoteItemSchema, ScheduleSchema, VehicleSchema, normalizePatente } from "./validations";

describe("fechas en hora argentina", () => {
  it("el día argentino empieza a las 03:00 UTC (sin DST)", () => {
    expect(startOfDayAR("2026-09-25").toISOString()).toBe("2026-09-25T03:00:00.000Z");
    expect(dayRangeAR("2026-09-25").end.toISOString()).toBe("2026-09-26T03:00:00.000Z");
  });

  it("un movimiento a las 20:59, 21:00 y 23:59 argentinas cae en el mismo día", () => {
    const { start, end } = dayRangeAR("2026-09-25");
    const at = (iso: string) => new Date(iso).getTime();
    for (const local of ["2026-09-25T20:59:00-03:00", "2026-09-25T21:00:00-03:00", "2026-09-25T23:59:59-03:00", "2026-09-25T00:00:00-03:00"]) {
      expect(at(local)).toBeGreaterThanOrEqual(start.getTime());
      expect(at(local)).toBeLessThan(end.getTime());
    }
    // 00:00 argentina del día siguiente ya es otro día
    expect(at("2026-09-26T00:00:00-03:00")).toBeGreaterThanOrEqual(end.getTime());
  });

  it("rango mensual y cambio de mes/año", () => {
    expect(monthRangeAR(2026, 12).end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 9, -5)).toEqual({ year: 2026, month: 4 });
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("valida fechas de calendario reales", () => {
    expect(isValidDateString("2026-02-31")).toBe(false);
    expect(isValidDateString("2026-13-45")).toBe(false);
    expect(isValidDateString("2026-09-25")).toBe(true);
    expect(isValidDateString("2028-02-29")).toBe(true);
  });
});

describe("dinero", () => {
  it("redondea a centavos", () => {
    expect(round2(9000.970000000001)).toBe(9000.97);
    expect(round2(3 * 0.1)).toBe(0.3);
    expect(round2(33 * 1.1)).toBe(36.3);
  });

  it("pendiente = total - pagos cobrados", () => {
    expect(pendingAmount(9000.970000000001, [{ monto: 9000.97, status: "PAGADO" }])).toBe(0);
    expect(pendingAmount(5000, [{ monto: 2000, status: "PAGADO" }, { monto: 1000, status: "ANULADO" }])).toBe(3000);
  });
});

describe("texto", () => {
  it("normaliza tildes, mayúsculas y teléfonos", () => {
    expect(normalizeText("  Pérez ÑANDÚ ")).toBe("perez nandu");
    expect(phoneDigits("+54 9 11 5555-1234")).toBe("5491155551234");
  });
});

describe("WhatsApp: normalización de teléfonos argentinos", () => {
  it.each([
    ["+54 9 11 5555-1234", "5491155551234"],
    ["11 5555-1234", "5491155551234"],
    ["011 15 5555-1234", "5491155551234"],
    ["0221 15 456-7890", "5492214567890"],
    ["5491155551234", "5491155551234"],
    ["541155551234", "5491155551234"],
    ["+1 415 555 2671", "14155552671"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhoneForWhatsApp(input)).toBe(expected);
  });

  it.each(["", null, undefined, "abc", "12345", "1234567", "555-1234"])("no genera link para %s", (input) => {
    expect(normalizePhoneForWhatsApp(input as string | null | undefined)).toBeNull();
    expect(buildWhatsAppLink(input as string | null | undefined, "hola")).toBeNull();
  });

  it("arma el link con el mensaje codificado", () => {
    expect(buildWhatsAppLink("11 5555-1234", "Hola Juan")).toBe("https://wa.me/5491155551234?text=Hola%20Juan");
  });
});

describe("validaciones de clientes", () => {
  it("recorta espacios y rechaza nombre vacío o de solo espacios", () => {
    expect(ClientSchema.safeParse({ nombre: "   " }).success).toBe(false);
    expect(ClientSchema.safeParse({ nombre: "A" }).success).toBe(false);
    const ok = ClientSchema.safeParse({ nombre: "  Juan Pérez  ", email: "", telefono: "" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.nombre).toBe("Juan Pérez");
      expect(ok.data.email).toBeUndefined();
      expect(ok.data.telefono).toBeUndefined();
    }
  });

  it("limita longitudes y valida email y teléfono", () => {
    expect(ClientSchema.safeParse({ nombre: "x".repeat(101) }).success).toBe(false);
    expect(ClientSchema.safeParse({ nombre: "Juan", email: "no-es-mail" }).success).toBe(false);
    expect(ClientSchema.safeParse({ nombre: "Juan", telefono: "abc" }).success).toBe(false);
    expect(ClientSchema.safeParse({ nombre: "Juan", telefono: "+54 9 11 5555-1234" }).success).toBe(true);
  });

  it("normaliza el email a minúsculas", () => {
    const r = ClientSchema.safeParse({ nombre: "Juan", email: " Juan@Example.COM " });
    expect(r.success && r.data.email).toBe("juan@example.com");
  });
});

describe("validaciones de vehículos", () => {
  const base = { clientId: "cmu7a30ld0001i604fl83lkr6", marca: "Ford", modelo: "Focus", anio: 2019 };

  it("normaliza la patente", () => {
    expect(normalizePatente(" ab 123-cd ")).toBe("AB123CD");
    const r = VehicleSchema.safeParse({ ...base, patente: "ta 2001" });
    expect(r.success && r.data.patente).toBe("TA2001");
  });

  it("rechaza patentes inválidas", () => {
    expect(VehicleSchema.safeParse({ ...base, patente: "   " }).success).toBe(false);
    expect(VehicleSchema.safeParse({ ...base, patente: "<b>%$#" }).success).toBe(false);
    expect(VehicleSchema.safeParse({ ...base, patente: "AB1" }).success).toBe(false);
  });

  it("kilometraje y año: rangos controlados, sin errores 500", () => {
    const v = (o: object) => VehicleSchema.safeParse({ ...base, patente: "AB123CD", ...o }).success;
    expect(v({ kilometraje: -5 })).toBe(false);
    expect(v({ kilometraje: 99999999999 })).toBe(false);
    expect(v({ kilometraje: 150.75 })).toBe(false);
    expect(v({ kilometraje: 0 })).toBe(true);
    expect(v({ anio: 2019.5 })).toBe(false);
    expect(v({ anio: 1899 })).toBe(false);
  });
});

describe("validaciones de importes, fechas y horas", () => {
  it("cantidad admite decimales positivos (0.5) pero no 0", () => {
    expect(QuoteItemSchema.safeParse({ descripcion: "Mano de obra", cantidad: 0.5, precioUnitario: 4000 }).success).toBe(true);
    expect(QuoteItemSchema.safeParse({ descripcion: "x", cantidad: 0, precioUnitario: 1 }).success).toBe(false);
  });

  it("precio: máximo 2 decimales y tope", () => {
    expect(QuoteItemSchema.safeParse({ descripcion: "x", cantidad: 1, precioUnitario: 10.999 }).success).toBe(false);
    expect(QuoteItemSchema.safeParse({ descripcion: "x", cantidad: 1, precioUnitario: 1e15 }).success).toBe(false);
    expect(QuoteItemSchema.safeParse({ descripcion: "x", cantidad: 1, precioUnitario: 19.99 }).success).toBe(true);
  });

  it("turnos: hora y fecha reales", () => {
    const base = { clientId: "cmu7a30ld0001i604fl83lkr6", vehicleId: "cmu7a35ja0005i604os06qpu5", motivo: "Service" };
    expect(ScheduleSchema.safeParse({ ...base, fecha: "2026-10-05", hora: "25:99" }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ ...base, fecha: "2026-02-31", hora: "10:00" }).success).toBe(false);
    expect(ScheduleSchema.safeParse({ ...base, fecha: "2026-10-05", hora: "00:00" }).success).toBe(true);
    expect(ScheduleSchema.safeParse({ ...base, fecha: "2026-10-05", hora: "23:59" }).success).toBe(true);
  });

  it("cierre de caja y metas: fechas y enteros", () => {
    expect(DailyCloseSchema.safeParse({ fecha: "2026-13-45" }).success).toBe(false);
    expect(GoalSchema.safeParse({ tipo: "INGRESO_MENSUAL", objetivo: 100, mes: 1.5, anio: 2026 }).success).toBe(false);
  });

  it("los mensajes de validación salen en español", () => {
    const r = ClientSchema.safeParse({ nombre: 5 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.errors[0].message).toMatch(/texto|válido/i);
    const r2 = VehicleSchema.safeParse({});
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.error.errors.every((e) => !/Required|Expected|received/.test(e.message))).toBe(true);
  });
});
