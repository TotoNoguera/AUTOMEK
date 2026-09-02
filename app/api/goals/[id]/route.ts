import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GoalUpdateSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const body = await request.json();
    const validation = GoalUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const goal = await db.goal.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json(goal, { status: 200 });
  } catch (error) {
    console.error("Goal PUT error:", error);
    return NextResponse.json(
      { error: "Error updating goal" },
      { status: 500 }
    );
  }
}
