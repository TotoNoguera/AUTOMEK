import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
