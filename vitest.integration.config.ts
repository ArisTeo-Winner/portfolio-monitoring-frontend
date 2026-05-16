import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    name: "integration",
    environment: "jsdom",
    globals: true,
    environmentOptions: {
      jsdom: {
        // Ensure relative fetch URLs (e.g. "/api/auth/login") resolve to
        // http://localhost/* so MSW handlers can intercept them.
        url: "http://localhost",
      },
    },
    setupFiles: [
      "./src/test/setup.ts",
      "./tests/mocks/integration.setup.ts",
    ],
    include: ["tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});
