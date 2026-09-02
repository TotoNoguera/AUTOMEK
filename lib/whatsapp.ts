/**
 * Genera un link de WhatsApp con mensaje precargado a partir del teléfono
 * ya cargado en la ficha del cliente. Devuelve null si no hay teléfono
 * (nunca se inventa un número).
 */
export function buildWhatsAppLink(telefono: string | null | undefined, message: string): string | null {
  if (!telefono) return null;
  const digits = telefono.replace(/[^0-9]/g, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function whatsAppConfirmTurno(clientName: string, fecha: string, hora: string, motivo: string): string {
  return `Hola ${clientName}, te escribimos del taller para confirmar tu turno del ${fecha} a las ${hora} (${motivo}). ¿Nos confirmás asistencia?`;
}

export function whatsAppVehiculoListo(clientName: string, patente: string): string {
  return `Hola ${clientName}, te contamos que tu vehículo (${patente}) ya está listo para retirar.`;
}

export function whatsAppRecordatorioPago(clientName: string, monto: number, referencia?: string): string {
  const ref = referencia ? ` (${referencia})` : "";
  return `Hola ${clientName}, te recordamos que tenés un saldo pendiente de $${monto.toFixed(2)}${ref} en el taller. ¡Gracias!`;
}
