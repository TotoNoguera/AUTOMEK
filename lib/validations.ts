import { z } from "zod";

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
});

export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Contraseña debe tener al menos 6 caracteres"),
  name: z.string().min(2, "Nombre es requerido"),
  tallerName: z.string().min(2, "Nombre del taller es requerido"),
});

// Client schemas
export const ClientSchema = z.object({
  nombre: z.string().min(2, "Nombre es requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
});

// Vehicle schemas
export const VehicleSchema = z.object({
  clientId: z.string().cuid("Cliente inválido"),
  patente: z.string().min(1, "Patente es requerida"),
  marca: z.string().min(1, "Marca es requerida"),
  modelo: z.string().min(1, "Modelo es requerido"),
  anio: z.number().min(1900).max(new Date().getFullYear() + 1),
  kilometraje: z.number().optional(),
});

// Quote schemas
export const QuoteItemSchema = z.object({
  descripcion: z.string().min(1, "Descripción es requerida"),
  cantidad: z.number().min(1, "Cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "Precio debe ser positivo"),
});

export const QuoteSchema = z.object({
  clientId: z.string().cuid("Cliente inválido"),
  vehicleId: z.string().cuid("Vehículo inválido"),
  items: z.array(QuoteItemSchema).min(1, "Al menos un ítem es requerido"),
  observaciones: z.string().optional(),
});

export const QuoteStatusSchema = z.object({
  status: z.enum(["PENDIENTE", "APROBADO", "RECHAZADO"]),
});

// Work Order schemas
export const WorkOrderItemSchema = z.object({
  descripcion: z.string().min(1, "Descripción es requerida"),
  cantidad: z.number().min(1, "Cantidad debe ser mayor a 0"),
  precioUnitario: z.number().min(0, "Precio debe ser positivo"),
});

export const WorkOrderSchema = z.object({
  clientId: z.string().cuid("Cliente inválido"),
  vehicleId: z.string().cuid("Vehículo inválido"),
  quoteId: z.string().cuid().optional(),
  motivoIngreso: z.string().min(1, "Motivo de ingreso es requerido"),
  diagnostico: z.string().optional(),
  observaciones: z.string().optional(),
  kmIngreso: z.number().optional(),
  kmEgreso: z.number().optional(),
  items: z.array(WorkOrderItemSchema).min(1, "Al menos un ítem es requerido"),
});

export const WorkOrderStatusSchema = z.object({
  status: z.enum(["PRESUPUESTA", "APROBADA", "EN_PROCESO", "TERMINADA", "ENTREGADA"]),
});

// Schedule schemas
export const ScheduleSchema = z.object({
  clientId: z.string().cuid("Cliente inválido"),
  vehicleId: z.string().cuid("Vehículo inválido"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  motivo: z.string().min(1, "Motivo es requerido"),
});

export const ScheduleUpdateSchema = ScheduleSchema.extend({
  status: z.enum(["PENDIENTE", "CONFIRMADO", "EN_ESPERA", "CANCELADO", "COMPLETADO"]).optional(),
});

export const ScheduleToWorkOrderSchema = z.object({
  motivoIngreso: z.string().min(1, "Motivo de ingreso es requerido"),
  diagnostico: z.string().optional(),
  observaciones: z.string().optional(),
  kmIngreso: z.number().optional(),
  items: z.array(WorkOrderItemSchema).min(1, "Al menos un ítem es requerido"),
});

// Payment schemas
export const PaymentSchema = z.object({
  workOrderId: z.string().cuid("Orden de trabajo inválida"),
  methodId: z.string().cuid("Método de pago inválido"),
  monto: z.number().min(0.01, "Monto debe ser mayor a 0"),
  numeroComprobante: z.string().optional(),
  observaciones: z.string().optional(),
});

// Cash movement schemas (Fase 6)
export const CashMovementIngresoSchema = z.object({
  workOrderId: z.string().cuid("Orden de trabajo inválida").optional(),
  methodId: z.string().cuid("Método de pago inválido"),
  monto: z.number().min(0.01, "Monto debe ser mayor a 0"),
  descripcion: z.string().optional(),
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
  monto: z.number().min(0.01, "Monto debe ser mayor a 0"),
  descripcion: z.string().optional(),
});

export const DailyCloseSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  notas: z.string().optional(),
});

export const ClientCreditPaymentSchema = z.object({
  monto: z.number().min(0.01, "Monto debe ser mayor a 0"),
  observaciones: z.string().optional(),
});

// Technician schemas (Fase 7)
export const TechnicianSchema = z.object({
  nombre: z.string().min(2, "Nombre es requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional(),
  especialidad: z.string().optional(),
});

export const TechnicianUpdateSchema = TechnicianSchema.extend({
  activo: z.boolean().optional(),
});

// Goal schemas (Fase 7)
export const GoalSchema = z.object({
  tipo: z.enum(["INGRESO_MENSUAL", "ORDENES_MENSUALES", "CLIENTES_NUEVOS"]),
  objetivo: z.number().min(0.01, "Objetivo debe ser mayor a 0"),
  mes: z.number().min(1).max(12),
  anio: z.number().min(2000).max(2100),
  notas: z.string().optional(),
});

export const GoalUpdateSchema = z.object({
  objetivo: z.number().min(0.01, "Objetivo debe ser mayor a 0").optional(),
  notas: z.string().optional(),
  estado: z.enum(["EN_PROGRESO", "ALCANZADO", "NO_ALCANZADO", "CANCELADO"]).optional(),
});

// Cost schemas (Fase 8)
export const CostSchema = z.object({
  tipo: z.enum(["FIJO", "VARIABLE"]),
  categoria: z.string().min(1, "Categoría es requerida"),
  descripcion: z.string().min(1, "Descripción es requerida"),
  monto: z.number().min(0.01, "Monto debe ser mayor a 0"),
  mes: z.number().min(1).max(12),
  anio: z.number().min(2000).max(2100),
  workOrderId: z.string().cuid().optional(),
});
