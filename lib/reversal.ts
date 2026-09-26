import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { BusinessError, CASH_CLOSED_MESSAGE, isTodayClosed, lockCashMovement, lockClient, lockWorkOrder } from "@/lib/cash";
import { round2 } from "@/lib/money";

type Tx = Prisma.TransactionClient;

interface Actor {
  tallerId: string;
  userId: string;
  motivo: string;
}

const fmt = (n: number) => n.toFixed(2);

/**
 * Anula un movimiento de caja SIN borrarlo ni editarlo: crea un movimiento compensatorio de monto negativo
 * que referencia al original. Así Caja, Cierres, Dashboard y Reportes se compensan solos y la trazabilidad se conserva.
 */
export async function reverseCashMovement(tx: Tx, movementId: string, actor: Actor) {
  await lockCashMovement(tx, movementId);
  const original = await tx.cashMovement.findUnique({ where: { id: movementId } });
  if (!original || original.tallerId !== actor.tallerId) {
    throw new BusinessError("Movimiento no encontrado.", 404);
  }
  if (original.reversalOfId || original.categoria === "REVERSION") {
    throw new BusinessError("Este movimiento es una anulación y no puede anularse.", 400);
  }
  const already = await tx.cashMovement.findFirst({ where: { reversalOfId: original.id }, select: { id: true } });
  if (already) {
    throw new BusinessError("Este movimiento ya fue anulado.", 409);
  }
  // La anulación se registra en la caja de HOY: no puede caer en un día ya cerrado
  if (await isTodayClosed(tx, actor.tallerId)) {
    throw new BusinessError(CASH_CLOSED_MESSAGE, 409);
  }

  if (original.paymentId) {
    const payment = await tx.payment.findUnique({ where: { id: original.paymentId } });
    if (!payment || payment.tallerId !== actor.tallerId) {
      throw new BusinessError("El pago asociado a este movimiento no existe.", 404);
    }
    if (payment.status !== "PAGADO") {
      throw new BusinessError("El pago asociado ya no está vigente.", 409);
    }
    await lockWorkOrder(tx, payment.workOrderId);
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "ANULADO", anuladoAt: new Date(), anuladoMotivo: actor.motivo },
    });
    await logAudit(tx, {
      tallerId: actor.tallerId,
      userId: actor.userId,
      accion: "PAYMENT_ANNULLED",
      entityType: "PAYMENT",
      entityId: payment.id,
      descripcion: `Pago de $${fmt(payment.monto)} anulado. Motivo: ${actor.motivo}`,
      oldValue: { status: "PAGADO" },
      newValue: { status: "ANULADO", monto: payment.monto, motivo: actor.motivo, movimientoOriginalId: original.id },
    });
  }

  // Pago de deuda de cuenta corriente: la deuda del cliente vuelve a su valor anterior
  if (original.clientId && original.tipo === "INGRESO") {
    await lockClient(tx, original.clientId);
    const credit = await tx.clientCredit.findUnique({
      where: { tallerId_clientId: { tallerId: actor.tallerId, clientId: original.clientId } },
    });
    if (credit) {
      const updated = await tx.clientCredit.update({
        where: { id: credit.id },
        data: { saldo: round2(credit.saldo - original.monto) },
      });
      await logAudit(tx, {
        tallerId: actor.tallerId,
        userId: actor.userId,
        accion: "CLIENT_CREDIT_UPDATED",
        entityType: "CLIENT_CREDIT",
        entityId: credit.id,
        descripcion: `Anulación de pago en cuenta corriente. Motivo: ${actor.motivo}`,
        oldValue: { saldo: credit.saldo },
        newValue: { saldo: updated.saldo },
      });
    }
  }

  const reversal = await tx.cashMovement.create({
    data: {
      tallerId: actor.tallerId,
      tipo: original.tipo,
      categoria: "REVERSION",
      monto: round2(-original.monto),
      descripcion: `Anulación: ${actor.motivo}`,
      motivo: actor.motivo,
      workOrderId: original.workOrderId,
      clientId: original.clientId,
      reversalOfId: original.id,
    },
  });
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "CASH_MOVEMENT_RECORDED",
    entityType: "CASH_MOVEMENT",
    entityId: reversal.id,
    descripcion: `Anulación del movimiento ${original.id}. Motivo: ${actor.motivo}`,
    newValue: { tipo: original.tipo, monto: reversal.monto, categoria: "REVERSION", reversalOfId: original.id, motivo: actor.motivo },
  });
  return reversal;
}

/** Anula un cargo a cuenta corriente (no mueve caja): el pago pasa a ANULADO y la deuda del cliente disminuye. */
export async function annulCreditCharge(tx: Tx, paymentId: string, actor: Actor) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { workOrder: true } });
  if (!payment || payment.tallerId !== actor.tallerId) {
    throw new BusinessError("Pago no encontrado.", 404);
  }
  await lockWorkOrder(tx, payment.workOrderId);
  await lockClient(tx, payment.workOrder.clientId);
  const fresh = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (fresh.status !== "PAGADO") {
    throw new BusinessError("Este pago ya fue anulado.", 409);
  }
  const credit = await tx.clientCredit.findUnique({
    where: { tallerId_clientId: { tallerId: actor.tallerId, clientId: payment.workOrder.clientId } },
  });
  await tx.payment.update({
    where: { id: paymentId },
    data: { status: "ANULADO", anuladoAt: new Date(), anuladoMotivo: actor.motivo },
  });
  await logAudit(tx, {
    tallerId: actor.tallerId,
    userId: actor.userId,
    accion: "PAYMENT_ANNULLED",
    entityType: "PAYMENT",
    entityId: paymentId,
    descripcion: `Cargo a cuenta corriente de $${fmt(payment.monto)} anulado. Motivo: ${actor.motivo}`,
    oldValue: { status: "PAGADO" },
    newValue: { status: "ANULADO", monto: payment.monto, motivo: actor.motivo },
  });
  if (credit) {
    const updated = await tx.clientCredit.update({
      where: { id: credit.id },
      data: { saldo: round2(credit.saldo + payment.monto) },
    });
    await logAudit(tx, {
      tallerId: actor.tallerId,
      userId: actor.userId,
      accion: "CLIENT_CREDIT_UPDATED",
      entityType: "CLIENT_CREDIT",
      entityId: credit.id,
      descripcion: `Anulación de cargo a cuenta corriente. Motivo: ${actor.motivo}`,
      oldValue: { saldo: credit.saldo },
      newValue: { saldo: updated.saldo },
    });
  }
  return { paymentId, saldo: credit ? round2(credit.saldo + payment.monto) : null };
}
