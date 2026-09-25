import type { AuditAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

interface AuditEntry {
  tallerId: string;
  /** Usuario autenticado que ejecuta la acción. Siempre proviene de la sesión del servidor, nunca del cliente. */
  userId: string;
  accion: AuditAction;
  entityType: string;
  entityId: string;
  descripcion?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/** Registra un evento de auditoría. Pasar el `tx` de una transacción para que sea atómico con el cambio. */
export function logAudit(client: Client, entry: AuditEntry) {
  return client.auditLog.create({
    data: {
      tallerId: entry.tallerId,
      userId: entry.userId,
      accion: entry.accion,
      entityType: entry.entityType,
      entityId: entry.entityId,
      descripcion: entry.descripcion,
      oldValue: entry.oldValue === undefined ? undefined : JSON.stringify(entry.oldValue),
      newValue: entry.newValue === undefined ? undefined : JSON.stringify(entry.newValue),
    },
  });
}
