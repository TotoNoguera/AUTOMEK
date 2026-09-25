import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { noTallerResponse, unauthorizedResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { normalizeText } from "@/lib/text";
import { VehicleSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));
    const clientId = searchParams.get("clientId");

    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const vehicles = await db.vehicle.findMany({
      where: {
        tallerId: userTaller.tallerId,
        ...(clientId && { clientId }),
      },
      include: {
        client: true,
      },
      orderBy: { patente: "asc" },
    });

    const compact = search.replace(/[\s-]+/g, "");
    const filtered = search
      ? vehicles.filter((v) =>
          [v.patente, v.marca, v.modelo].some((field) => {
            const f = normalizeText(field);
            return f.includes(search) || f.includes(compact);
          })
        )
      : vehicles;

    return NextResponse.json(filtered, { status: 200 });
  } catch (error) {
    console.error("Vehicles GET error:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la información. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = VehicleSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    // Verify client ownership
    const client = await db.client.findUnique({
      where: { id: validation.data.clientId },
    });
    if (!client || client.tallerId !== userTaller.tallerId) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    // La patente es única por taller (dos talleres pueden tener el mismo auto)
    const existing = await db.vehicle.findUnique({
      where: {
        tallerId_patente: { tallerId: userTaller.tallerId, patente: validation.data.patente },
      },
      include: { client: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un vehículo con la patente ${existing.patente} en tu taller (cliente: ${existing.client.nombre}).` },
        { status: 409 }
      );
    }

    try {
      const vehicle = await db.vehicle.create({
        data: { ...validation.data, tallerId: userTaller.tallerId },
        include: { client: true },
      });
      return NextResponse.json(vehicle, { status: 201 });
    } catch (err) {
      // Condición de carrera: otra solicitud creó la misma patente entre la verificación y el alta
      if (prismaCode(err) === "P2002") {
        return NextResponse.json(
          { error: "Ya existe un vehículo con esa patente en tu taller." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Vehicles POST error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
