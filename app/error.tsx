"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-carbon-950 px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-white">Ocurrió un error inesperado</h1>
        <p className="mt-2 text-sm text-carbon-400">
          Por favor intentá nuevamente. Si el problema persiste, contactá al soporte.
        </p>
        <Button onClick={reset} className="mt-6">
          Reintentar
        </Button>
      </div>
    </div>
  );
}
