"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useToast } from "@/components/common/ToastProvider";

const TOAST_COOLDOWN_MS = 5000;

function requestInfo(input: RequestInfo | URL, init?: RequestInit): { path: string; method: string } {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let path = raw;
  try {
    path = new URL(raw, window.location.origin).pathname;
  } catch {
    // ruta relativa rara: se usa tal cual
  }
  const method = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET") || "GET").toUpperCase();
  return { path, method };
}

/**
 * Red de seguridad global para las llamadas a /api:
 *  - 401 (sesión inválida/expirada): cierra la sesión local y vuelve al login, en vez de mostrar pantallas vacías.
 *  - Error de servidor o de red al CARGAR datos (GET): avisa con un mensaje, en vez de mostrar "no hay datos".
 * Los errores de acciones (crear, guardar, borrar) los sigue mostrando cada pantalla con el mensaje de la API.
 */
export function ApiErrorWatcher() {
  const { showToast } = useToast();

  useEffect(() => {
    const originalFetch = window.fetch;
    let lastToastAt = 0;
    let redirecting = false;

    const notifyLoadError = (message: string) => {
      const now = Date.now();
      if (now - lastToastAt < TOAST_COOLDOWN_MS) return;
      lastToastAt = now;
      showToast(message, "error");
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const { path, method } = requestInfo(input, init);
      const isAppApi = path.startsWith("/api/") && !path.startsWith("/api/auth");

      let response: Response;
      try {
        response = await originalFetch(input, init);
      } catch (error) {
        if (isAppApi && method === "GET") {
          notifyLoadError("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
        }
        throw error;
      }

      if (isAppApi) {
        if (response.status === 401 && !redirecting) {
          redirecting = true;
          showToast("Tu sesión expiró. Volvé a iniciar sesión.", "info");
          signOut({ redirect: false })
            .catch(() => undefined)
            .finally(() => {
              window.location.href = "/auth/login";
            });
        } else if (response.status >= 500 && method === "GET") {
          notifyLoadError("No pudimos cargar los datos. Reintentá en unos segundos.");
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [showToast]);

  return null;
}
