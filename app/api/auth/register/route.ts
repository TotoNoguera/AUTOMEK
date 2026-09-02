import { db } from "@/lib/db";
import { RegisterSchema } from "@/lib/validations";
import { getClientKey, rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const clientKey = getClientKey(request);
    const { allowed } = rateLimit(`register:${clientKey}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de registro. Intentá nuevamente en unos minutos." },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validar entrada
    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email, password, name, tallerName } = validation.data;

    // Verificar si el email ya existe
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario y taller en una transacción
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        userTallers: {
          create: {
            taller: {
              create: {
                nombre: tallerName,
              },
            },
            role: "admin",
          },
        },
      },
      include: {
        userTallers: {
          include: {
            taller: true,
          },
        },
      },
    });

    // No retornar la contraseña
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        status: "success",
        message: "Usuario creado correctamente",
        data: userWithoutPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}
