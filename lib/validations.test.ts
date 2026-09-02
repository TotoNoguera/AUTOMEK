import { describe, expect, it } from "vitest";
import {
  LoginSchema,
  RegisterSchema,
  ClientSchema,
  VehicleSchema,
  QuoteItemSchema,
  QuoteSchema,
  QuoteStatusSchema,
  WorkOrderItemSchema,
  WorkOrderSchema,
  WorkOrderStatusSchema,
  ScheduleSchema,
  ScheduleUpdateSchema,
  CashMovementIngresoSchema,
  CashMovementEgresoSchema,
  DailyCloseSchema,
  ClientCreditPaymentSchema,
  TechnicianSchema,
  GoalSchema,
  CostSchema,
} from "./validations";

describe("LoginSchema", () => {
  it("acepta credenciales válidas", () => {
    const result = LoginSchema.safeParse({ email: "a@b.com", password: "123456" });
    expect(result.success).toBe(true);
  });

  it("rechaza email inválido", () => {
    const result = LoginSchema.safeParse({ email: "no-es-email", password: "123456" });
    expect(result.success).toBe(false);
  });

  it("rechaza contraseña corta", () => {
    const result = LoginSchema.safeParse({ email: "a@b.com", password: "123" });
    expect(result.success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  it("acepta datos válidos", () => {
    const result = RegisterSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      name: "Juan",
      tallerName: "Taller X",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza nombre demasiado corto", () => {
    const result = RegisterSchema.safeParse({
      email: "a@b.com",
      password: "123456",
      name: "J",
      tallerName: "Taller X",
    });
    expect(result.success).toBe(false);
  });
});

describe("ClientSchema", () => {
  it("acepta cliente con solo el nombre requerido", () => {
    const result = ClientSchema.safeParse({ nombre: "Juan Pérez" });
    expect(result.success).toBe(true);
  });

  it("rechaza nombre vacío/corto", () => {
    const result = ClientSchema.safeParse({ nombre: "J" });
    expect(result.success).toBe(false);
  });

  it("rechaza email con formato inválido si se provee", () => {
    const result = ClientSchema.safeParse({ nombre: "Juan Pérez", email: "invalido" });
    expect(result.success).toBe(false);
  });

  it("acepta email vacío (opcional)", () => {
    const result = ClientSchema.safeParse({ nombre: "Juan Pérez", email: "" });
    expect(result.success).toBe(true);
  });
});

describe("VehicleSchema", () => {
  const validClientId = "clh1234567890123456789";

  it("acepta vehículo válido", () => {
    const result = VehicleSchema.safeParse({
      clientId: validClientId,
      patente: "ABC123",
      marca: "Ford",
      modelo: "Fiesta",
      anio: 2020,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza año fuera de rango", () => {
    const result = VehicleSchema.safeParse({
      clientId: validClientId,
      patente: "ABC123",
      marca: "Ford",
      modelo: "Fiesta",
      anio: 1800,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza clientId que no es cuid", () => {
    const result = VehicleSchema.safeParse({
      clientId: "not-a-cuid",
      patente: "ABC123",
      marca: "Ford",
      modelo: "Fiesta",
      anio: 2020,
    });
    expect(result.success).toBe(false);
  });
});

describe("QuoteItemSchema / QuoteSchema", () => {
  const validId = "clh1234567890123456789";

  it("rechaza cantidad menor a 1", () => {
    const result = QuoteItemSchema.safeParse({
      descripcion: "Cambio de aceite",
      cantidad: 0,
      precioUnitario: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza precio negativo", () => {
    const result = QuoteItemSchema.safeParse({
      descripcion: "Cambio de aceite",
      cantidad: 1,
      precioUnitario: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza presupuesto sin ítems", () => {
    const result = QuoteSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("acepta presupuesto con al menos un ítem válido", () => {
    const result = QuoteSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      items: [{ descripcion: "Service", cantidad: 1, precioUnitario: 500 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("QuoteStatusSchema", () => {
  it("acepta los tres estados válidos", () => {
    for (const status of ["PENDIENTE", "APROBADO", "RECHAZADO"]) {
      expect(QuoteStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rechaza un estado inválido", () => {
    expect(QuoteStatusSchema.safeParse({ status: "INVALIDO" }).success).toBe(false);
  });
});

describe("WorkOrderSchema / WorkOrderStatusSchema", () => {
  const validId = "clh1234567890123456789";

  it("rechaza orden sin motivo de ingreso", () => {
    const result = WorkOrderSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      motivoIngreso: "",
      items: [{ descripcion: "Service", cantidad: 1, precioUnitario: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("acepta orden válida completa", () => {
    const result = WorkOrderSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      motivoIngreso: "Ruido en motor",
      items: [{ descripcion: "Diagnóstico", cantidad: 1, precioUnitario: 500 }],
    });
    expect(result.success).toBe(true);
  });

  it("valida las 5 transiciones de estado permitidas", () => {
    for (const status of ["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"]) {
      expect(WorkOrderStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rechaza estado inválido", () => {
    expect(WorkOrderStatusSchema.safeParse({ status: "CANCELADA" }).success).toBe(false);
  });
});

describe("ScheduleSchema / ScheduleUpdateSchema", () => {
  const validId = "clh1234567890123456789";

  it("rechaza fecha con formato incorrecto", () => {
    const result = ScheduleSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      fecha: "01-09-2026",
      hora: "10:00",
      motivo: "Service",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza hora con formato incorrecto", () => {
    const result = ScheduleSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      fecha: "2026-09-01",
      hora: "10hs",
      motivo: "Service",
    });
    expect(result.success).toBe(false);
  });

  it("acepta turno válido", () => {
    const result = ScheduleSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      fecha: "2026-09-01",
      hora: "10:00",
      motivo: "Service",
    });
    expect(result.success).toBe(true);
  });

  it("ScheduleUpdateSchema acepta status opcional válido", () => {
    const result = ScheduleUpdateSchema.safeParse({
      clientId: validId,
      vehicleId: validId,
      fecha: "2026-09-01",
      hora: "10:00",
      motivo: "Service",
      status: "CONFIRMADO",
    });
    expect(result.success).toBe(true);
  });
});

describe("CashMovementIngresoSchema / CashMovementEgresoSchema", () => {
  const validId = "clh1234567890123456789";

  it("ingreso: workOrderId es opcional", () => {
    const result = CashMovementIngresoSchema.safeParse({
      methodId: validId,
      monto: 100,
    });
    expect(result.success).toBe(true);
  });

  it("ingreso: rechaza monto cero", () => {
    const result = CashMovementIngresoSchema.safeParse({
      methodId: validId,
      monto: 0,
    });
    expect(result.success).toBe(false);
  });

  it("egreso: rechaza categoría fuera del enum permitido", () => {
    const result = CashMovementEgresoSchema.safeParse({
      categoria: "CATEGORIA_INVENTADA",
      monto: 100,
    });
    expect(result.success).toBe(false);
  });

  it("egreso: acepta categoría válida", () => {
    const result = CashMovementEgresoSchema.safeParse({
      categoria: "GASTO_SUELDOS",
      monto: 1000,
    });
    expect(result.success).toBe(true);
  });
});

describe("DailyCloseSchema", () => {
  it("rechaza fecha malformada", () => {
    expect(DailyCloseSchema.safeParse({ fecha: "2026/09/01" }).success).toBe(false);
  });

  it("acepta fecha válida sin notas", () => {
    expect(DailyCloseSchema.safeParse({ fecha: "2026-09-01" }).success).toBe(true);
  });
});

describe("ClientCreditPaymentSchema", () => {
  it("rechaza monto negativo", () => {
    expect(ClientCreditPaymentSchema.safeParse({ monto: -5 }).success).toBe(false);
  });

  it("acepta pago válido", () => {
    expect(ClientCreditPaymentSchema.safeParse({ monto: 500 }).success).toBe(true);
  });
});

describe("TechnicianSchema", () => {
  it("requiere solo el nombre", () => {
    expect(TechnicianSchema.safeParse({ nombre: "Juan Pérez" }).success).toBe(true);
  });

  it("rechaza email inválido si se provee", () => {
    expect(
      TechnicianSchema.safeParse({ nombre: "Juan Pérez", email: "no-valido" }).success
    ).toBe(false);
  });
});

describe("GoalSchema", () => {
  it("valida los 3 tipos de meta permitidos", () => {
    for (const tipo of ["INGRESO_MENSUAL", "ORDENES_MENSUALES", "CLIENTES_NUEVOS"]) {
      const result = GoalSchema.safeParse({ tipo, objetivo: 100, mes: 9, anio: 2026 });
      expect(result.success).toBe(true);
    }
  });

  it("rechaza mes fuera de rango 1-12", () => {
    const result = GoalSchema.safeParse({
      tipo: "INGRESO_MENSUAL",
      objetivo: 100,
      mes: 13,
      anio: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza objetivo cero o negativo", () => {
    const result = GoalSchema.safeParse({
      tipo: "INGRESO_MENSUAL",
      objetivo: 0,
      mes: 9,
      anio: 2026,
    });
    expect(result.success).toBe(false);
  });
});

describe("CostSchema", () => {
  it("acepta costo fijo válido", () => {
    const result = CostSchema.safeParse({
      tipo: "FIJO",
      categoria: "Alquiler",
      descripcion: "Alquiler del local",
      monto: 50000,
      mes: 9,
      anio: 2026,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza tipo fuera del enum FIJO/VARIABLE", () => {
    const result = CostSchema.safeParse({
      tipo: "MIXTO",
      categoria: "Alquiler",
      descripcion: "Alquiler del local",
      monto: 50000,
      mes: 9,
      anio: 2026,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza sin descripción", () => {
    const result = CostSchema.safeParse({
      tipo: "VARIABLE",
      categoria: "Repuestos",
      descripcion: "",
      monto: 100,
      mes: 9,
      anio: 2026,
    });
    expect(result.success).toBe(false);
  });
});
