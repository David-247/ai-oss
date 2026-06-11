import { defineConfig } from "vitest/config";

// Unit/integration/security/RLS suites run under Vitest.
// e2e (Playwright) is excluded here and run via `pnpm --filter @ai-oss/tests test:e2e`.
export default defineConfig({
  test: {
    include: [
      "integration/**/*.test.ts",
      "security/**/*.test.ts",
      "rls/**/*.test.ts",
    ],
    environment: "node",
  },
});
