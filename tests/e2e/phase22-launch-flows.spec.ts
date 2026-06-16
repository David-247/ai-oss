import { expect, test, type Page } from "@playwright/test";

const pageFlows = [
  { name: "new-user onboarding", path: "/signup", heading: "Create your account" },
  { name: "create zone", path: "/z/new", heading: "Create zone" },
  { name: "search archive", path: "/search", heading: "Search archive" },
  { name: "submit paper", path: "/research/submit", heading: "Submit paper" },
  { name: "join chat", path: "/messages", heading: "Messages" },
  { name: "start voice room", path: "/z/test-zone/voice/test-room", heading: "Voice room" },
  { name: "moderator queue action", path: "/admin/moderation", heading: "Access unavailable" },
  { name: "admin role grant", path: "/admin/roles", heading: "Access unavailable" },
  { name: "account export", path: "/account/export", heading: "Data export" },
  { name: "account deletion", path: "/account/delete", heading: "Delete account" },
  { name: "donation", path: "/donate", heading: "Donate to AI-OSS.net" },
  { name: "report content", path: "/legal/online-safety", heading: "Online Safety" },
  { name: "appeal action", path: "/legal/dsa", heading: "DSA" },
] as const;

const routeFlows = [
  { name: "create post", method: "GET", path: "/api/posts?limit=1" },
  { name: "comment and vote", method: "GET", path: "/api/comments?targetType=post&targetId=test" },
  { name: "comment and vote", method: "POST", path: "/api/votes" },
  { name: "review paper", method: "GET", path: "/api/research/papers/test/reviews" },
  { name: "moderation queue action", method: "GET", path: "/api/moderation/queue" },
  { name: "appeal action", method: "POST", path: "/api/moderation/appeals" },
] as const;

test.describe("Phase 22 launch E2E flow smoke", () => {
  for (const flow of pageFlows) {
    test(`renders ${flow.name}`, async ({ page }) => {
      const response = await page.goto(flow.path);
      expect(response?.status(), flow.path).toBeLessThan(500);
      await expect(page.getByRole("heading", { name: flow.heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("registers API-backed contribution and moderation flows", async ({ request }) => {
    for (const flow of routeFlows) {
      const response =
        flow.method === "POST"
          ? await request.post(flow.path, { data: {} })
          : await request.get(flow.path);
      expect(response.status(), `${flow.name}: ${flow.path}`).not.toBe(404);
    }
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate<boolean>(
    "document.documentElement.scrollWidth > window.innerWidth + 1",
  );
  expect(hasOverflow).toBe(false);
}
