import { db } from "@/lib/db";
import { normalizeText, phoneDigits } from "@/lib/text";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";

/** Forma canónica de un teléfono: "11 5555-1234" y "+54 9 11 5555-1234" son el mismo número. */
function canonicalPhone(value: string | null | undefined): string {
  return normalizePhoneForWhatsApp(value) ?? phoneDigits(value);
}

interface ClientIdentity {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
}

/**
 * Regla de duplicado (por taller):
 *  - mismo email, o
 *  - mismo nombre (sin tildes ni mayúsculas) Y mismo teléfono (solo dígitos).
 * Dos personas con el mismo nombre pero distinto teléfono NO son duplicado.
 */
export async function findDuplicateClient(
  tallerId: string,
  candidate: ClientIdentity,
  excludeId?: string
): Promise<{ id: string; nombre: string; reason: "email" | "nombre_telefono" } | null> {
  const existing = await db.client.findMany({
    where: { tallerId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, nombre: true, telefono: true, email: true },
  });

  const candidateEmail = candidate.email ? candidate.email.trim().toLowerCase() : "";
  const candidateName = normalizeText(candidate.nombre);
  const candidatePhone = canonicalPhone(candidate.telefono);

  for (const c of existing) {
    if (candidateEmail && c.email && c.email.trim().toLowerCase() === candidateEmail) {
      return { id: c.id, nombre: c.nombre, reason: "email" };
    }
    if (candidatePhone && normalizeText(c.nombre) === candidateName && canonicalPhone(c.telefono) === candidatePhone) {
      return { id: c.id, nombre: c.nombre, reason: "nombre_telefono" };
    }
  }
  return null;
}

export function duplicateClientMessage(dup: { nombre: string; reason: "email" | "nombre_telefono" }): string {
  return dup.reason === "email"
    ? `Ya existe un cliente con ese email en tu taller (${dup.nombre}).`
    : `Ya existe un cliente con el mismo nombre y teléfono (${dup.nombre}). Buscalo en la lista antes de crear otro.`;
}
