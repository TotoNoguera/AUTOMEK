import { z } from "zod";
import { isValidDateString } from "./dates";

// Mensajes por defecto de Zod en español, para que ningún error técnico llegue al usuario en inglés.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "Falta completar un dato obligatorio" };
      }
      if (issue.expected === "number") return { message: "Ingresá un número válido" };
      if (issue.expected === "string") return { message: "Ingresá un texto válido" };
      return { message: "El dato tiene un formato incorrecto" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "array") return { message: "Agregá al menos un ítem" };
      if (issue.type === "string") return { message: `Debe tener al menos ${issue.minimum} caracteres` };
      return { message: `El valor mínimo es ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `No puede superar los ${issue.maximum} caracteres` };
      return { message: `El valor máximo es ${issue.maximum}` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Email inválido" };
      return { message: "El formato ingresado no es válido" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "La opción elegida no es válida" };
    case z.ZodIssueCode.not_finite:
      return { message: "Ingresá un número válido" };
    default:
      return { message: ctx.defaultError === "Required" ? "Falta completar un dato obligatorio" : "El dato ingresado no es válido" };
  }
});

const MAX_MONEY = 1_000_000_000;
const MAX_KM = 2_000_000;

const hasAtMostTwoDecimals = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

const money = (label: string, min = 0) =>
  z
    .number({ invalid_type_error: `${label} debe ser un número`, required_error: `${label} es requerido` })
    .finite(`${label} debe ser un número`)
    .min(min, min > 0 ? `${label} debe ser mayor a 0` : `${label} no puede ser negativo`)
    .max(MAX_MONEY, `${label} es demasiado alto`)
    .refine(hasAtMostTwoDecimals, `${label} admite hasta 2 decimales`);

const optionalText = (label: string, max: number) =>
  z
    .string({ invalid_type_error: `${label} debe ser un texto` })
    .trim()
    .max(max, `${label} no puede superar los ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

const requiredText = (label: string, min: number, max: number, required = "requerido") =>
  z
    .string({ required_error: `${label} es ${required}`, invalid_type_error: `${label} debe ser un texto` })
    .trim()
    .min(min, min <= 1 ? `${label} es ${required}` : `${label} es ${required} (mínimo ${min} caracteres)`)
    .max(max, `${label} no puede superar los ${max} caracteres`);

const optionalPhone = z
  .string({ invalid_type_error: "Teléfono debe ser un texto" })
  .trim()
  .max(30, "Teléfono no puede superar los 30 caracteres")
  .refine(
    (v) => v === "" || (/^[0-9+\-().\s]+$/.test(v) && v.replace(/\D/g, "").length >= 6),
    "Teléfono inválido (usá solo números, con código de área)"
  )
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalEmail = z
  .string({ invalid_type_error: "Email debe ser un texto" })
  .trim()
  .toLowerCase()
  .max(254, "Email no puede superar los 254 caracteres")
  .refine((v) => v === "" || z.string().email().safeParse(v).success, "Email inválido")
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalKm = z
  .number({ invalid_type_error: "El kilometraje debe ser un número" })
  .int("El kilometraje debe ser un número entero")
  .min(0, "El kilometraje no puede ser negativo")
  .max(MAX_KM, "El kilometraje es demasiado alto")
  .nullable()
  .optional();

const dateString = z
  .string({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" })
  .refine((v) => isValidDateString(v), "Fecha inválida (formato AAAA-MM-DD)");

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres").max(200, "Contraseña demasiado larga"),
});

export const RegisterSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
  name: z.string().trim().min(2, "Nombre es requerido"),
  tallerName: z.string().trim().min(2, "Nombre del taller es requerido"),
});

// Client schemas
export const ClientSchema = z.object({
  nombre: requiredText("Nombre", 2, 100),
  telefono: optionalPhone,
  email: optionalEmail,
  direccion: optionalText("Dirección", 200),
});

// Vehicle schemas
export function normalizePatente(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export const PatenteSchema = z
  .string({ required_error: "Patente es requerida", invalid_type_error: "Patente inválida" })
  .transform(normalizePatente)
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{5,8}$/, "Patente inválida (5 a 8 letras o números, sin símbolos. Ej: AB123CD)")
  );

export const VehicleSchema = z.object({
  clientId: z.string({ required_error: "Cliente es requerido" }).cuid("Cliente inválido"),
  patente: PatenteSchema,
  marca: requiredText("Marca", 1, 50, "requerida"),
  modelo: requiredText("Modelo", 1, 50),
  anio: z
    .number({ required_error: "El año es requerido", invalid_type_error: "El año debe ser un número" })
    .int("El año debe ser un número entero")
    .min(1900, "El año debe ser 1900 o posterior")
    .refine((v) => v <= new Date().getFullYear() + 1, "El año no puede ser posterior al próximo año"),
  kilometraje: optionalKm,
});

// Quote schemas
export const QuoteItemSchema = z.object({
  descripcion: requiredText("Descripción", 1, 200, "requerida"),
  cantidad: z
    .number({ required_error: "Cantidad es requerida", invalid_type_error: "Cantidad debe ser un número" })
    .finite("Cantidad debe ser un número")
    .min(0.01, "Cantidad debe ser mayor a 0")
    .max(100_000, "Cantidad demasiado alta")
    .refine(hasAtMostTwoDecimals, "Cantidad admite hasta 2 decimales"),
  precioUnitario: money("Precio"),
});

export const QuoteSchema = z.object({
  clientId: z.string({ required_error: "Cliente es requerido" }).cuid("Cliente inválido"),
  vehicleId: z.string({ required_error: "Vehículo es requerido" }).cuid("Vehículo inválido"),
  items: z.array(QuoteItemSchema).min(1, "Al menos un ítem es requerido").max(100, "Demasiados ítems (máximo 100)"),
  observaciones: optionalText("Observaciones", 1000),
});

export const QuoteStatusSchema = z.object({
  status: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]),
});

// Work Order schemas
export const WorkOrderItemSchema = QuoteItemSchema;

export const WorkOrderSchema = z
  .object({
    clientId: z.string({ required_error: "Cliente es requerido" }).cuid("Cliente inválido"),
    vehicleId: z.string({ required_error: "Vehículo es requerido" }).cuid("Vehículo inválido"),
    quoteId: z.string().cuid().optional(),
    motivoIngreso: requiredText("Motivo de ingreso", 1, 500),
    diagnostico: optionalText("Diagnóstico", 2000),
    observaciones: optionalText("Observaciones", 2000),
    kmIngreso: optionalKm,
    kmEgreso: optionalKm,
    items: z.array(WorkOrderItemSchema).min(1, "Al menos un ítem es requerido").max(100, "Demasiados ítems (máximo 100)"),
  })
  .refine(
    (v) => v.kmIngreso == null || v.kmEgreso == null || v.kmEgreso >= v.kmIngreso,
    { message: "El km de egreso no puede ser menor al km de ingreso", path: ["kmEgreso"] }
  );

export const WorkOrderStatusSchema = z.object({
  status: z.enum(["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"]),
});

// Schedule schemas
export const ScheduleSchema = z.object({
  clientId: z.string({ required_error: "Cliente es requerido" }).cuid("Cliente inválido"),
  vehicleId: z.string({ required_error: "Vehículo es requerido" }).cuid("Vehículo inválido"),
  fecha: dateString,
  hora: z
    .string({ required_error: "La hora es requerida", invalid_type_error: "Hora inválida" })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (formato HH:MM, de 00:00 a 23:59)"),
  motivo: requiredText("Motivo", 1, 200),
});

export const ScheduleUpdateSchema = ScheduleSchema.extend({
  status: z.enum(["PENDIENTE", "CONFIRMADO", "EN_ESPERA", "CANCELADO", "COMPLETADO"]).optional(),
});

export const ScheduleToWorkOrderSchema = z.object({
  motivoIngreso: requiredText("Motivo de ingreso", 1, 500),
  diagnostico: optionalText("Diagnóstico", 2000),
  observaciones: optionalText("Observaciones", 2000),
  kmIngreso: optionalKm,
  items: z.array(WorkOrderItemSchema).min(1, "Al menos un ítem es requerido").max(100, "Demasiados ítems (máximo 100)"),
});

// Payment schemas
export const PaymentSchema = z.object({
  workOrderId: z.string().cuid("Orden de trabajo inválida"),
  methodId: z.string().cuid("Método de pago inválido"),
  monto: money("Monto", 0.01),
  numeroComprobante: optionalText("Comprobante", 50),
  observaciones: optionalText("Observaciones", 500),
});

// Cash movement schemas (Fase 6)
export const CashMovementIngresoSchema = z.object({
  workOrderId: z.string().cuid("Orden de trabajo inválida").optional(),
  methodId: z.string({ required_error: "Elegí un método de pago" }).cuid("Método de pago inválido"),
  monto: money("Monto", 0.01),
  descripcion: optionalText("Descripción", 200),
});

export const CashMovementEgresoSchema = z.object({
  categoria: z.enum([
    "COMPRA_REPUESTOS",
    "COMPRA_MATERIALES",
    "GASTO_SERVICIOS",
    "GASTO_MANTENIMIENTO",
    "GASTO_SUELDOS",
    "GASTO_ALQUILER",
    "GASTO_SERVICIOS_UTILES",
    "GASTO_IMPUESTOS",
    "GASTO_OTROS",
  ]),
  monto: money("Monto", 0.01),
  descripcion: optionalText("Descripción", 200),
});

export const DailyCloseSchema = z.object({
  fecha: dateString,
  notas: optionalText("Notas", 500),
});

export const ClientCreditPaymentSchema = z.object({
  monto: money("Monto", 0.01),
  observaciones: optionalText("Observaciones", 500),
});

// Technician schemas (Fase 7)
export const TechnicianSchema = z.object({
  nombre: requiredText("Nombre", 2, 100),
  email: optionalEmail,
  telefono: optionalPhone,
  especialidad: optionalText("Especialidad", 100),
});

export const TechnicianUpdateSchema = TechnicianSchema.extend({
  activo: z.boolean().optional(),
});

// Goal schemas (Fase 7)
export const GoalSchema = z.object({
  tipo: z.enum(["INGRESO_MENSUAL", "ORDENES_MENSUALES", "CLIENTES_NUEVOS"]),
  objetivo: money("Objetivo", 0.01),
  mes: z.number({ invalid_type_error: "El mes debe ser un número" }).int("El mes debe ser un número entero").min(1, "Mes inválido (1 a 12)").max(12, "Mes inválido (1 a 12)"),
  anio: z.number({ invalid_type_error: "El año debe ser un número" }).int("El año debe ser un número entero").min(2000, "Año inválido").max(2100, "Año inválido"),
  notas: optionalText("Notas", 500),
});

export const GoalUpdateSchema = z.object({
  objetivo: money("Objetivo", 0.01).optional(),
  notas: optionalText("Notas", 500),
  estado: z.enum(["EN_PROGRESO", "ALCANZADO", "NO_ALCANZADO", "CANCELADO"]).optional(),
});

// Cost schemas (Fase 8)
export const CostSchema = z.object({
  tipo: z.enum(["FIJO", "VARIABLE"]),
  categoria: requiredText("Categoría", 1, 100, "requerida"),
  descripcion: requiredText("Descripción", 1, 200, "requerida"),
  monto: money("Monto", 0.01),
  mes: z.number({ invalid_type_error: "El mes debe ser un número" }).int("El mes debe ser un número entero").min(1, "Mes inválido (1 a 12)").max(12, "Mes inválido (1 a 12)"),
  anio: z.number({ invalid_type_error: "El año debe ser un número" }).int("El año debe ser un número entero").min(2000, "Año inválido").max(2100, "Año inválido"),
  workOrderId: z.string().cuid().optional(),
});
