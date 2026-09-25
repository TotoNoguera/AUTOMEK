import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { duplicateClientMessage, findDuplicateClient } from "@/lib/clients";
import { db } from "@/lib/db";
import { ClientSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const client = await db.client.findUnique({
      where: { id },
      include: { vehicles: true },
    });

    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    return NextResponse.json(client, { status: 200 });
  } catch (error) {
    console.error("Client GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Check ownership
    const existing = await db.client.findUnique({
      where: { id: id },
    });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const body = await request.json();
    const validation = ClientSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    const duplicate = await findDuplicateClient(userTaller.tallerId, validation.data, id);
    if (duplicate) {
      return NextResponse.json({ error: duplicateClientMessage(duplicate) }, { status: 409 });
    }

    try {
      const client = await db.client.update({
        where: { id: id },
        // email/teléfono vacíos se guardan como null (no como texto vacío)
        data: {
          nombre: validation.data.nombre,
          telefono: validation.data.telefono ?? null,
          email: validation.data.email ?? null,
          direccion: validation.data.direccion ?? null,
        },
        include: { vehicles: true },
      });
      return NextResponse.json(client, { status: 200 });
    } catch (err) {
      if (prismaCode(err) === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un cliente con ese email en tu taller." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Client PUT error:", error);
    return NextResponse.json(
      { error: "No se pudieron guardar los cambios. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const existing = await db.client.findUnique({
      where: { id: id },
    });
    if (!existing || existing.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const [quotes, workOrders, schedules, credit] = await Promise.all([
      db.quote.count({ where: { clientId: id } }),
      db.workOrder.count({ where: { clientId: id } }),
      db.schedule.count({ where: { clientId: id } }),
      db.clientCredit.findUnique({
        where: { tallerId_clientId: { tallerId: userTaller.tallerId, clientId: id } },
      }),
    ]);
    if (quotes + workOrders + schedules > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el cliente porque tiene historial (${quotes} presupuesto(s), ${workOrders} orden(es), ${schedules} turno(s)). Se conserva para no perder el registro de trabajos.`,
        },
        { status: 409 }
      );
    }
    if (credit && Math.abs(credit.saldo) > 0.004) {
      return NextResponse.json(
        { error: "No se puede eliminar el cliente porque tiene saldo de cuenta corriente distinto de cero." },
        { status: 409 }
      );
    }

    try {
      await db.client.delete({
        where: { id: id },
      });
    } catch (err) {
      if (prismaCode(err) === "P2003" || prismaCode(err) === "P2014") {
        return NextResponse.json(
          { error: "No se puede eliminar el cliente porque tiene historial asociado." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Client DELETE error:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
