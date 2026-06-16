import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPdfViewerDescriptor,
  GLOBAL_NAV_ITEMS,
  MOBILE_NAV_ITEMS,
  renderSafeMarkdown,
  ROUTE_SHELLS,
  SHELL_PAGE_SPECS,
  THEME_TOKENS,
} from "@ai-oss/design-system";

const requiredRoutes = [
  "/",
  "/z",
  "/z/new",
  "/z/[zoneSlug]/rules",
  "/z/[zoneSlug]/wiki",
  "/z/[zoneSlug]/chat",
  "/z/[zoneSlug]/voice",
  "/z/[zoneSlug]/moderation",
  "/z/[zoneSlug]/modmail",
  "/z/[zoneSlug]/settings",
  "/z/[zoneSlug]/governance",
  "/research",
  "/research/submit",
  "/research/[paperId]/v/[version]",
  "/research/[paperId]/comments",
  "/research/[paperId]/reviews",
  "/research/[paperId]/replications",
  "/research/[paperId]/edit",
  "/research/[paperId]/withdraw",
  "/research/tags",
  "/research/authors",
  "/search",
  "/notifications",
  "/messages",
  "/donate",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/legal/dmca",
  "/legal/community-guidelines",
  "/legal/research-policy",
  "/legal/moderator-code",
  "/legal/transparency",
  "/legal/dsa",
  "/legal/online-safety",
  "/admin/users",
  "/admin/roles",
  "/admin/zones",
  "/admin/content",
  "/admin/research",
  "/admin/moderation",
  "/admin/legal",
  "/admin/privacy",
  "/admin/security",
  "/admin/finance",
  "/admin/audit",
  "/admin/settings",
  "/admin/feature-flags",
  "/admin/system",
] as const;

describe("Phase 05 design system and frontend shell contract", () => {
  it("registers the required route skeletons and navigation targets", () => {
    expect(ROUTE_SHELLS).toEqual(expect.arrayContaining(Array.from(requiredRoutes)));
    expect(new Set(ROUTE_SHELLS).size).toBe(ROUTE_SHELLS.length);

    expect(GLOBAL_NAV_ITEMS.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/", "/search", "/research", "/z", "/admin"]),
    );
    expect(MOBILE_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/search",
      "/research",
      "/z",
      "/account",
    ]);
  });

  it("has concrete Next.js files for explicit and dynamic route groups", () => {
    const root = resolve("..");
    const expectedFiles = [
      "apps/web/src/app/page.tsx",
      "apps/web/src/app/z/page.tsx",
      "apps/web/src/app/z/new/page.tsx",
      "apps/web/src/app/z/[zoneSlug]/[[...section]]/page.tsx",
      "apps/web/src/app/research/page.tsx",
      "apps/web/src/app/research/submit/page.tsx",
      "apps/web/src/app/research/[paperId]/[[...section]]/page.tsx",
      "apps/web/src/app/research/tags/page.tsx",
      "apps/web/src/app/research/tags/[tag]/page.tsx",
      "apps/web/src/app/research/authors/page.tsx",
      "apps/web/src/app/research/authors/[authorId]/page.tsx",
      "apps/web/src/app/search/page.tsx",
      "apps/web/src/app/notifications/page.tsx",
      "apps/web/src/app/messages/page.tsx",
      "apps/web/src/app/donate/page.tsx",
      "apps/web/src/app/legal/page.tsx",
      "apps/web/src/app/legal/[slug]/page.tsx",
      "apps/web/src/app/admin/[[...section]]/page.tsx",
    ];

    for (const file of expectedFiles) {
      expect(existsSync(resolve(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it("defines theme tokens, shell specs, and accessibility CSS primitives", () => {
    expect(THEME_TOKENS.color.focus).toBe("var(--color-focus)");
    expect(SHELL_PAGE_SPECS.home.sections.length).toBeGreaterThanOrEqual(3);
    expect(SHELL_PAGE_SPECS.admin.sections.some((section) => section.status === "guarded")).toBe(
      true,
    );

    const css = readFileSync(resolve("..", "apps/web/src/app/globals.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/\.dark/);
    expect(css).toMatch(/\.safe-markdown/);
  });

  it("escapes raw HTML while preserving safe markdown links and highlighted code", () => {
    const rendered = renderSafeMarkdown(
      [
        "## Review",
        "",
        "Read [policy](/legal/research-policy) and block <script>alert(1)</script>.",
        "",
        "```ts",
        "export const answer = await run();",
        "```",
      ].join("\n"),
    );

    expect(rendered.html).toContain("<h2>Review</h2>");
    expect(rendered.html).toContain('href="/legal/research-policy"');
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain('class="language-ts"');
    expect(rendered.html).toContain('class="token keyword"');
    expect(rendered.strippedTags).toContain("script");
  });

  it("describes PDF rendering with an accessible title and restricted sandbox", () => {
    expect(
      buildPdfViewerDescriptor({
        src: "/papers/example.pdf",
        title: "Example paper PDF",
      }),
    ).toEqual({
      src: "/papers/example.pdf",
      title: "Example paper PDF",
      downloadLabel: "Download PDF",
      sandbox: "allow-downloads",
    });
  });
});
