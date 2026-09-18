"use client";

import { LoginSchema } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRef, useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

// Backstop: signIn("credentials", { redirect: false }) puede no resolver la
// promesa en el camino de error con la versión de next-auth en uso. Sin este
// timeout, el botón quedaría en "Iniciando..." para siempre.
const SIGNIN_TIMEOUT_MS = 10000;

function LoginContent() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const timedOutRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (values: z.infer<typeof LoginSchema>) => {
    setIsLoading(true);
    setError("");
    timedOutRef.current = false;

    const timeoutId = setTimeout(() => {
      timedOutRef.current = true;
      setError("El inicio de sesión está tardando demasiado. Intentá nuevamente.");
      setIsLoading(false);
    }, SIGNIN_TIMEOUT_MS);

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      clearTimeout(timeoutId);
      if (timedOutRef.current) return; // ya se mostró el error de timeout, ignorar resolución tardía

      // No confiar solo en result.ok: con credenciales inválidas, next-auth
      // puede devolver result.error poblado ("CredentialsSignin") junto con
      // ok:true, lo que dejaba pasar el flujo hacia router.push("/dashboard")
      // sin sesión real, y el botón quedaba colgado en "Iniciando...".
      if (result?.error || !result?.ok) {
        setError("Email o contraseña incorrectos");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOutRef.current) return;
      setError("Error de conexión");
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Iniciar Sesión" subtitle="Accedé a la gestión de tu taller">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input {...register("email")} id="email" type="email" placeholder="tu@email.com" />
          <FieldError>{errors.email?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              {...register("password")}
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-carbon-400 hover:text-carbon-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError>{errors.password?.message}</FieldError>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          {isLoading ? "Iniciando..." : "Iniciar Sesión"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-carbon-950 text-sm text-carbon-400">
          Cargando...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
