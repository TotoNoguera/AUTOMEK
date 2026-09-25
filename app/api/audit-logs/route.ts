import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const accion = searchParams.get("accion");
    if (accion && !Object.values(AuditAction).includes(accion as AuditAction)) {
      return NextResponse.json({ error: "Los filtros indicados no son válidos." }, { status: 400 });
    }

    const logs = await db.auditLog.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(entityType ? { entityType } : {}),
        ...(accion
          ? {
              accion: accion as
                | "QUOTE_CREATED"
                | "QUOTE_APPROVED"
                | "QUOTE_REJECTED"
                | "QUOTE_CONVERTED_TO_WORK_ORDER"
                | "WORK_ORDER_CREATED"
                | "WORK_ORDER_STATUS_CHANGED"
                | "WORK_ORDER_COMPLETED"
                | "WORK_ORDER_DELIVERED"
                | "PAYMENT_RECORDED"
                | "PAYMENT_ANNULLED"
                | "PAYMENT_UPDATED"
                | "CASH_MOVEMENT_RECORDED"
                | "DAILY_CLOSE_CLOSED"
                | "DAILY_CLOSE_REOPENED"
                | "CLIENT_CREDIT_UPDATED"
                | "SCHEDULE_STATUS_CHANGED",
            }
          : {}),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("AuditLogs GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
