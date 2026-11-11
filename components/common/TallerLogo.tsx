"use client";

import { cn } from "@/lib/utils";
import { safeLogoSrc, useTaller } from "@/lib/useTaller";

/** Logo de un taller con su proporción original (no se recorta ni se deforma). No muestra nada si no tiene logo. */
export function TallerLogo({ nombre, logo, className }: { nombre: string; logo?: string | null; className?: string }) {
  const src = safeLogoSrc(logo);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={nombre} className={cn("h-16 w-auto max-w-[240px] object-contain", className)} />;
}

/** Logo del taller de la sesión, solo en la impresión (encabezado de reportes y cierres). */
export function PrintTallerLogo() {
  const taller = useTaller();
  if (!taller || !safeLogoSrc(taller.logo)) return null;
  return (
    <div className="mb-4 hidden print:block">
      <TallerLogo nombre={taller.nombre} logo={taller.logo} />
    </div>
  );
}
