import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return NextResponse.json(
        { error: "User not associated with a taller" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const accion = searchParams.get("accion");

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
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("AuditLogs GET error:", error);
    return NextResponse.json(
      { error: "Error fetching audit logs" },
      { status: 500 }
    );
  }
}
