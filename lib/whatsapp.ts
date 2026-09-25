/**
 * Convierte un teléfono cargado por el usuario al formato que exige wa.me
 * (solo dígitos, con código de país). Para Argentina el celular es 54 + 9 + área + número.
 * Devuelve null si no se puede resolver con certeza (nunca se inventa ni se adivina un número).
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let digits = text.replace(/\D/g, "");
  if (digits.length < 6) return null;

  const explicitInternational = text.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  const arNational = argentineNational(digits, explicitInternational);
  if (arNational !== undefined) return arNational ? `549${arNational}` : null;

  // Número internacional (+XX ...) que no es argentino
  if (explicitInternational && digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

/** undefined = no parece argentino; null = argentino pero inválido; string = área + número (10 dígitos). */
function argentineNational(digits: string, explicitInternational: boolean): string | null | undefined {
  let national: string;

  if (digits.startsWith("54") && (explicitInternational || digits.length >= 12)) {
    national = digits.slice(2);
    if (national.startsWith("9")) national = national.slice(1);
  } else if (explicitInternational) {
    return undefined;
  } else {
    national = digits;
  }

  if (national.startsWith("0")) national = national.slice(1); // prefijo troncal

  if (national.length === 12) {
    // área (2 a 4 dígitos) + "15" + número: el 15 no va en el formato internacional
    for (const areaLength of [2, 3, 4]) {
      if (national.slice(areaLength, areaLength + 2) === "15") {
        national = national.slice(0, areaLength) + national.slice(areaLength + 2);
        break;
      }
    }
  }

  return national.length === 10 ? national : null;
}

export function buildWhatsAppLink(telefono: string | null | undefined, message: string): string | null {
  const number = normalizePhoneForWhatsApp(telefono);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function whatsAppConfirmTurno(clientName: string, fecha: string, hora: string, motivo: string): string {
  return `Hola ${clientName}, te escribimos del taller para confirmar tu turno del ${fecha} a las ${hora} (${motivo}). ¿Nos confirmás asistencia?`;
}

export function whatsAppVehiculoListo(clientName: string, patente: string): string {
  return `Hola ${clientName}, te contamos que tu vehículo (${patente}) ya está listo para retirar.`;
}

export function whatsAppRecordatorioPago(clientName: string, monto: number, referencia?: string): string {
  const ref = referencia ? ` (${referencia})` : "";
  return `Hola ${clientName}, te recordamos que tenés un saldo pendiente de $${monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${ref} en el taller. ¡Gracias!`;
}
