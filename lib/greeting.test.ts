import { describe, expect, it } from "vitest";
import { greetingFor } from "./greeting";

describe("greetingFor", () => {
  it("usa el nombre de pila, sin emojis y con signo de exclamación", () => {
    expect(greetingFor("María")).toBe("Hola, María!");
    expect(greetingFor("Nicolas alvarez")).toBe("Hola, Nicolas!");
    expect(greetingFor("  Ana   Pérez ")).toBe("Hola, Ana!");
  });
  it("cae a un saludo genérico sin nombre", () => {
    expect(greetingFor(undefined)).toBe("Hola!");
    expect(greetingFor(null)).toBe("Hola!");
    expect(greetingFor("   ")).toBe("Hola!");
  });
  it("no contiene emojis", () => {
    expect(greetingFor("María")).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
