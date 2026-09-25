import { auth } from "@/lib/auth";
import { unauthorizedResponse, noTallerResponse, validationErrorResponse, prismaCode } from "@/lib/api";
import { duplicateClientMessage, findDuplicateClient } from "@/lib/clients";
import { db } from "@/lib/db";
import { normalizeText, phoneDigits } from "@/lib/text";
import { ClientSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const search = normalizeText(searchParams.get("search"));

    // Get user's taller (never trust a client-supplied tallerId)
    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const clients = await db.client.findMany({
      where: { tallerId: userTaller.tallerId },
      include: {
        vehicles: true,
      },
      orderBy: { nombre: "asc" },
    });

    const digits = phoneDigits(search);
    const filtered = search
      ? clients.filter(
          (c) =>
            normalizeText(c.nombre).includes(search) ||
            normalizeText(c.email).includes(search) ||
            normalizeText(c.telefono).includes(search) ||
            (digits.length >= 3 && phoneDigits(c.telefono).includes(digits))
        )
      : clients;

    return NextResponse.json(filtered, { status: 200 });
  } catch (error) {
    console.error("Clients GET error:", error);
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

    const body = await request.json();

    const validation = ClientSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error);
    }

    // Get user's taller
    const userTaller = await db.userTaller.findFirst({
      where: { userId: session.user.id },
    });
    if (!userTaller) {
      return noTallerResponse();
    }

    const duplicate = await findDuplicateClient(userTaller.tallerId, validation.data);
    if (duplicate) {
      return NextResponse.json({ error: duplicateClientMessage(duplicate) }, { status: 409 });
    }

    try {
      const client = await db.client.create({
        data: {
          ...validation.data,
          tallerId: userTaller.tallerId,
        },
        include: { vehicles: true },
      });
      return NextResponse.json(client, { status: 201 });
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
    console.error("Clients POST error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el registro. Reintentá en unos segundos." },
      { status: 500 }
    );
  }
}
