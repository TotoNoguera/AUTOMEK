import { Wrench } from "lucide-react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-carbon-950 px-4 py-12">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(14,165,233,0.12), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 ring-1 ring-inset ring-brand-500/30">
            <Wrench className="h-5 w-5" />
          </div>
          <p className="text-lg font-bold tracking-tight text-white">AUTOMEK</p>
          <h1 className="mt-4 text-xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-carbon-400">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-carbon-700 bg-carbon-850 p-6 shadow-elevated">
          {children}
        </div>
      </div>
    </div>
  );
}
