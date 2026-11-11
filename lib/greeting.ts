/** Saludo del dashboard: nombre de pila de la PERSONA autenticada (nunca el nombre comercial del taller). */
export function greetingFor(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? `Hola, ${first}!` : "Hola!";
}
