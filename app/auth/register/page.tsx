"use client";

import { RegisterSchema } from "@/lib/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof RegisterSchema>>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (values: z.infer<typeof RegisterSchema>) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Error al registrarse");
        setIsLoading(false);
        return;
      }

      router.push("/auth/login?registered=true");
    } catch (err) {
      setError("Error de conexión");
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout title="Crear Cuenta" subtitle="Registrá tu taller mecánico">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input {...register("name")} id="name" type="text" placeholder="Tu nombre completo" />
          <FieldError>{errors.name?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input {...register("email")} id="email" type="email" placeholder="tu@email.com" />
          <FieldError>{errors.email?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="tallerName">Nombre del Taller</Label>
          <Input {...register("tallerName")} id="tallerName" type="text" placeholder="Nombre de tu taller" />
          <FieldError>{errors.tallerName?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input {...register("password")} id="password" type="password" placeholder="Contraseña" />
          <FieldError>{errors.password?.message}</FieldError>
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isLoading}>
          {isLoading ? "Creando cuenta..." : "Registrarse"}
        </Button>

        <p className="text-center text-sm text-carbon-400">
          <a href="/auth/login" className="font-medium text-brand-400 hover:text-brand-300">
            ¿Ya tienes cuenta? Inicia sesión
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
