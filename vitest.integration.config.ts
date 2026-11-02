import { defineConfig } from "vitest/config";
import path from "path";

// Pruebas de integración (base de datos real). Se ejecutan SOLO con: npm run qa:test:integration
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.integration.test.ts"],
    setupFiles: ["scripts/qa/vitest-qa-setup.mjs"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
