import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("permite solicitudes dentro del límite", () => {
    const key = `test-${Math.random()}`;
    const r1 = rateLimit(key, 3, 60_000);
    const r2 = rateLimit(key, 3, 60_000);
    const r3 = rateLimit(key, 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  it("rechaza al superar el límite dentro de la ventana", () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    const r3 = rateLimit(key, 2, 60_000);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("mantiene contadores independientes por clave", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    rateLimit(keyA, 1, 60_000);
    const resultB = rateLimit(keyB, 1, 60_000);
    expect(resultB.allowed).toBe(true);
  });

  it("resetea el contador una vez expirada la ventana", async () => {
    const key = `expiring-${Math.random()}`;
    rateLimit(key, 1, 10);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = rateLimit(key, 1, 10);
    expect(result.allowed).toBe(true);
  });
});
