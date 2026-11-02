import { NextResponse } from "next/server";
import { BusinessError } from "@/lib/cash";
import type { ZodError } from "zod";

// Mensajes visibles para el usuario final. Los detalles técnicos van solo a console.error.
export const MSG = {
  unauthorized: "Tu sesión no es válida o expiró. Iniciá sesión nuevamente.",
  noTaller: "Tu usuario no está asociado a ningún taller.",
  clientNotFound: "Cliente no encontrado.",
  vehicleNotFound: "Vehículo no encontrado.",
  quoteNotFound: "Presupuesto no encontrado.",
  workOrderNotFound: "Orden de trabajo no encontrada.",
  scheduleNotFound: "Turno no encontrado.",
  technicianNotFound: "Técnico no encontrado.",
  costNotFound: "Costo no encontrado.",
  goalNotFound: "Meta no encontrada.",
  itemNotFound: "Trabajo no encontrado.",
  paymentMethodNotFound: "Método de pago no encontrado.",
} as const;

export function unauthorizedResponse() {
  return NextResponse.json({ error: MSG.unauthorized }, { status: 401 });
}

export function noTallerResponse() {
  return NextResponse.json({ error: MSG.noTaller }, { status: 400 });
}

/** Mensaje legible a partir de un error de Zod (ya localizado en español). */
export function validationMessage(error: ZodError): string {
  const messages = Array.from(new Set(error.errors.map((e) => e.message).filter(Boolean)));
  return messages.length ? messages.join(". ") : "Los datos ingresados no son válidos.";
}

export function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: validationMessage(error), details: error.errors },
    { status: 400 }
  );
}

/** Tipo de error de Prisma por clave única / clave foránea, sin depender del import de la clase. */
export function prismaCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Traduce los errores controlados de un servicio a una respuesta HTTP: BusinessError (con su estado) y los
 * cierres de transacción por contención (P2028/P2034 -> 409). Devuelve null si el error no es de esos tipos.
 */
export function serviceErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof BusinessError) return NextResponse.json({ error: error.message }, { status: error.status });
  const code = prismaCode(error);
  if (code === "P2028" || code === "P2034") {
    return NextResponse.json(
      { error: "Hay otra operación en curso sobre estos datos. Esperá unos segundos y reintentá." },
      { status: 409 }
    );
  }
  return null;
}
