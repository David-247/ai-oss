export const PACKAGE_NAME = "@ai-oss/design-system" as const;

export const THEME_TOKENS = {
  color: {
    canvas: "var(--color-canvas)",
    panel: "var(--color-panel)",
    panelStrong: "var(--color-panel-strong)",
    text: "var(--color-text)",
    textMuted: "var(--color-text-muted)",
    border: "var(--color-border)",
    focus: "var(--color-focus)",
    accent: "var(--color-accent)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
  },
  shadow: {
    panel: "0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)",
  },
} as const;

export const GLOBAL_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home", section: "core" },
  { href: "/search", label: "Search", icon: "search", section: "core" },
  { href: "/research", label: "Research", icon: "bookOpen", section: "core" },
  { href: "/z", label: "Zones", icon: "layers", section: "core" },
  { href: "/notifications", label: "Notifications", icon: "bell", section: "member" },
  { href: "/messages", label: "Messages", icon: "messageSquare", section: "member" },
  { href: "/donate", label: "Donate", icon: "heartHandshake", section: "support" },
  { href: "/admin", label: "Admin", icon: "shieldCheck", section: "admin" },
] as const;

export const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/research", label: "Research", icon: "bookOpen" },
  { href: "/z", label: "Zones", icon: "layers" },
  { href: "/account", label: "Account", icon: "userRound" },
] as const;

export const ROUTE_SHELLS = [
  "/",
  "/account",
  "/account/profile",
  "/account/security",
  "/account/privacy",
  "/account/notifications",
  "/account/export",
  "/account/delete",
  "/z",
  "/z/new",
  "/z/[zoneSlug]",
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
  "/research/[paperId]",
  "/research/[paperId]/v/[version]",
  "/research/[paperId]/comments",
  "/research/[paperId]/reviews",
  "/research/[paperId]/replications",
  "/research/[paperId]/edit",
  "/research/[paperId]/withdraw",
  "/research/tags",
  "/research/tags/[tag]",
  "/research/authors",
  "/research/authors/[authorId]",
  "/search",
  "/notifications",
  "/messages",
  "/donate",
  "/legal",
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
  "/admin",
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

export type RouteShell = (typeof ROUTE_SHELLS)[number];

export interface ShellPageSpec {
  title: string;
  eyebrow: string;
  summary: string;
  primaryAction?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
  sections: readonly {
    title: string;
    body: string;
    status?: "ready" | "planned" | "guarded";
  }[];
  sidebar: readonly string[];
}

export const SHELL_PAGE_SPECS = {
  home: {
    eyebrow: "Research coordination",
    title: "AI-OSS.net",
    summary:
      "A working hub for open AI research, forum discussion, paper review, realtime rooms, governance, moderation, and funding.",
    primaryAction: { href: "/research", label: "Browse research" },
    secondaryAction: { href: "/z", label: "Explore zones" },
    sections: [
      {
        title: "Research queue",
        body: "Latest papers, replication requests, reviews, and implementation notes are grouped for fast review.",
        status: "planned",
      },
      {
        title: "Community feed",
        body: "Forum-style posts, comments, votes, and moderation controls share the same reading surface.",
        status: "planned",
      },
      {
        title: "Live rooms",
        body: "Text chat and voice rooms keep the same shell so mobile and desktop controls stay predictable.",
        status: "planned",
      },
    ],
    sidebar: ["Rules", "Active rooms", "Related papers", "Moderator notices"],
  },
  zones: {
    eyebrow: "Zones",
    title: "Community zones",
    summary:
      "Dedicated workspaces for projects, research areas, model families, evaluation efforts, and governance groups.",
    primaryAction: { href: "/z/new", label: "Create zone" },
    sections: [
      {
        title: "Zone directory",
        body: "Zone search, membership status, rules, and pinned active threads sit in one browsable list.",
        status: "planned",
      },
      {
        title: "Scoped moderation",
        body: "Zone roles and moderator tools use server-side permission checks before any mutation.",
        status: "guarded",
      },
    ],
    sidebar: ["Suggested tags", "New zones", "Governance queue"],
  },
  research: {
    eyebrow: "Research",
    title: "Research archive",
    summary:
      "An arXiv-style archive for papers, versions, comments, reviews, replication reports, tags, and author pages.",
    primaryAction: { href: "/research/submit", label: "Submit paper" },
    secondaryAction: { href: "/research/tags", label: "Browse tags" },
    sections: [
      {
        title: "Paper list",
        body: "Dense metadata, abstracts, version history, review state, and replication links render in a scan-friendly table.",
        status: "planned",
      },
      {
        title: "Safe Markdown",
        body: "Markdown is rendered through a sanitizer that escapes raw HTML and highlights code snippets.",
        status: "ready",
      },
      {
        title: "PDF reader",
        body: "Paper pages include an accessible PDF frame with a direct download path.",
        status: "ready",
      },
    ],
    sidebar: ["Trending tags", "Open reviews", "Replication requests", "Authors"],
  },
  search: {
    eyebrow: "Search",
    title: "Search",
    summary:
      "Unified search across zones, posts, papers, authors, comments, moderation-visible records, and tags.",
    sections: [
      {
        title: "Filters",
        body: "Result type, time range, zone, tag, author, and review-state filters are arranged for keyboard use.",
        status: "planned",
      },
    ],
    sidebar: ["Saved searches", "Recent filters", "Advanced syntax"],
  },
  legal: {
    eyebrow: "Legal",
    title: "Legal and policy center",
    summary:
      "Privacy, terms, cookies, DMCA, community guidelines, research policy, moderator code, transparency, DSA, and online safety pages.",
    sections: [
      {
        title: "Policy documents",
        body: "Document bodies use safe Markdown, accessible headings, and version labels.",
        status: "planned",
      },
    ],
    sidebar: ["Policy versions", "Transparency reports", "Contact"],
  },
  admin: {
    eyebrow: "Admin",
    title: "Administration",
    summary:
      "Operational panels for users, roles, zones, content, research, moderation, legal, privacy, security, finance, audit, settings, and feature flags.",
    sections: [
      {
        title: "Guarded actions",
        body: "Navigation is only a hint. Server guards remain authoritative for every admin mutation.",
        status: "guarded",
      },
      {
        title: "Tables and filters",
        body: "Panels use keyboard-friendly tables, filters, and bulk action review flows.",
        status: "planned",
      },
    ],
    sidebar: ["Audit log", "High-risk queue", "Incident mode"],
  },
} as const satisfies Record<string, ShellPageSpec>;

export interface SafeMarkdownResult {
  html: string;
  strippedTags: readonly string[];
}

export function renderSafeMarkdown(markdown: string): SafeMarkdownResult {
  const strippedTags = Array.from(markdown.matchAll(/<\s*\/?\s*([a-zA-Z0-9-]+)/g)).map(
    (match) => match[1]?.toLowerCase() ?? "unknown",
  );
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html = blocks
    .map((block) => renderMarkdownBlock(block.trim()))
    .filter(Boolean)
    .join("\n");

  return {
    html,
    strippedTags,
  };
}

export interface PdfViewerDescriptor {
  src: string;
  title: string;
  downloadLabel: string;
  sandbox: "allow-downloads";
}

export function buildPdfViewerDescriptor(input: {
  src: string;
  title: string;
  downloadLabel?: string;
}): PdfViewerDescriptor {
  return {
    src: input.src,
    title: input.title,
    downloadLabel: input.downloadLabel ?? "Download PDF",
    sandbox: "allow-downloads",
  };
}

function renderMarkdownBlock(block: string): string {
  if (block.length === 0) {
    return "";
  }

  if (block.startsWith("```")) {
    return renderCodeFence(block);
  }

  const heading = block.match(/^(#{1,3})\s+(.+)$/);
  if (heading !== null) {
    const level = heading[1]?.length ?? 2;
    const text = renderInlineMarkdown(heading[2] ?? "");
    return `<h${level}>${text}</h${level}>`;
  }

  if (block.split("\n").every((line) => /^[-*]\s+/.test(line.trim()))) {
    const items = block
      .split("\n")
      .map((line) => `<li>${renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  return `<p>${renderInlineMarkdown(block.replace(/\n+/g, " "))}</p>`;
}

function renderCodeFence(block: string): string {
  const lines = block.split("\n");
  const language = sanitizeLanguage(lines[0]?.replace(/^```/, "").trim() ?? "text");
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "```");
  const code = lines.slice(1, closingIndex === -1 ? undefined : closingIndex).join("\n");
  return `<pre data-language="${language}"><code class="language-${language}">${highlightCode(
    code,
  )}</code></pre>`;
}

function renderInlineMarkdown(input: string): string {
  const escaped = escapeHtml(input);
  const linked = escaped.replace(
    /\[([^\]]+)]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) => {
      const safeHref = sanitizeHref(href);
      return safeHref === null
        ? label
        : `<a href="${safeHref}" rel="nofollow noopener noreferrer">${label}</a>`;
    },
  );
  return linked.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function highlightCode(input: string): string {
  return escapeHtml(input).replace(
    /\b(const|let|function|return|type|interface|export|import|from|async|await)\b/g,
    '<span class="token keyword">$1</span>',
  );
}

function sanitizeLanguage(language: string): string {
  return /^[a-z0-9-]+$/i.test(language) ? language.toLowerCase() : "text";
}

function sanitizeHref(href: string): string | null {
  if (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("mailto:")
  ) {
    return escapeHtml(href);
  }
  return null;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
