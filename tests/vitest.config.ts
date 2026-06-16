import { defineConfig } from "vitest/config";

// Unit/integration/security/RLS suites run under Vitest.
// e2e (Playwright) is excluded here and run via `pnpm --filter @ai-oss/tests test:e2e`.
export default defineConfig({
  test: {
    include: [
      "unit/**/*.test.ts",
      "integration/**/*.test.ts",
      "frontend/**/*.test.ts",
      "security/**/*.test.ts",
      "compliance/**/*.test.ts",
      "rls/**/*.test.ts",
      "performance/**/*.test.ts",
      "phase22/**/*.test.ts",
      "phase23/**/*.test.ts",
    ],
    environment: "node",
  },
});
