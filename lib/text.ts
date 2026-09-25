/** Minúsculas y sin tildes, para búsquedas que no distinguen "Pérez" de "perez". */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Solo los dígitos de un teléfono, para comparar "11 5555-1234" con "1155551234". */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}
