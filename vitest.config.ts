import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**", "tests/integration/**", "**/.claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.types.ts",
        "src/**/types/**",
        "src/test/**",
        "src/app/api/**",
        "src/lib/design-tokens.ts",
        "src/lib/navigation/**",
      ],
    },
  },
});
