import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Verificar sesión via cookies (Auth.js v5 usa "authjs.session-token")
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");
  const hasSession = !!sessionCookie;

  const pathname = request.nextUrl.pathname;

  // Rutas protegidas
  const protectedPrefixes = [
    "/dashboard",
    "/clients",
    "/vehicles",
    "/quotes",
    "/work-orders",
    "/schedules",
    "/cash-movements",
    "/daily-closes",
    "/debts",
    "/technicians",
    "/goals",
    "/audit-logs",
    "/reports",
    "/costs",
  ];
  if (protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    if (!hasSession) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  // Si está autenticado y va a login/register, redirigir a dashboard
  if (
    (pathname === "/auth/login" || pathname === "/auth/register") &&
    hasSession
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Home redirige según sesión
  if (pathname === "/") {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/vehicles/:path*",
    "/quotes/:path*",
    "/work-orders/:path*",
    "/schedules/:path*",
    "/cash-movements/:path*",
    "/daily-closes/:path*",
    "/debts/:path*",
    "/technicians/:path*",
    "/goals/:path*",
    "/audit-logs/:path*",
    "/reports/:path*",
    "/costs/:path*",
    "/auth/:path*",
    "/",
  ],
};
