"use client";

import { useEffect, useState } from "react";

export interface TallerIdentity {
  id: string;
  nombre: string;
  logo: string | null;
}

// Se consulta una sola vez por carga de la aplicación
let cached: Promise<TallerIdentity | null> | null = null;

/** Identidad (nombre y logo) del taller de la sesión. null mientras carga o si no se pudo obtener. */
export function useTaller(): TallerIdentity | null {
  const [taller, setTaller] = useState<TallerIdentity | null>(null);
  useEffect(() => {
    cached ??= fetch("/api/taller")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    let alive = true;
    cached.then((t) => alive && setTaller(t));
    return () => {
      alive = false;
    };
  }, []);
  return taller;
}

/** Solo se aceptan logos propios (/logos/…) o https: nunca esquemas como javascript: ni data:. */
export function safeLogoSrc(logo?: string | null): string | null {
  return logo && /^(\/logos\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(logo) ? logo : null;
}
