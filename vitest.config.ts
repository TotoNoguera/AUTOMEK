import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.mjs"],
    // Las pruebas de integración necesitan una base de QA: se ejecutan con npm run qa:test:integration
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
