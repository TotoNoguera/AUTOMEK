import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-carbon-950 px-4">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold text-white">404</h1>
        <p className="mt-2 text-sm text-carbon-400">Página no encontrada</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-400"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
