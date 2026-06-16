"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Home,
  Layers,
  MessageSquare,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";
import { GLOBAL_NAV_ITEMS, MOBILE_NAV_ITEMS } from "@ai-oss/design-system";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const icons: Record<string, LucideIcon> = {
  bell: Bell,
  bookOpen: BookOpen,
  heartHandshake: HeartHandshake,
  home: Home,
  layers: Layers,
  messageSquare: MessageSquare,
  moon: Moon,
  search: Search,
  shieldCheck: ShieldCheck,
  sun: Sun,
  userRound: UserRound,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const contextItems = useMemo(() => sidebarItemsForPath(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-panel-strong)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-text)] focus:shadow"
      >
        Skip to content
      </a>

      <div className="mx-auto grid min-h-screen max-w-[1800px] lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <aside className="hidden border-r border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-5 lg:block">
          <div className="sticky top-5 flex h-[calc(100vh-2.5rem)] flex-col gap-6">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm font-semibold outline-none transition hover:bg-[var(--color-panel-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-text)] text-[var(--color-canvas)]">
                AI
              </span>
              <span>AI-OSS.net</span>
            </Link>

            <nav aria-label="Global sections" className="grid gap-1">
              {GLOBAL_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActivePath(pathname, item.href)}
                />
              ))}
            </nav>

            <div className="mt-auto rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)] p-3 text-xs leading-5 text-[var(--color-text-muted)]">
              <p className="font-medium text-[var(--color-text)]">Least privilege</p>
              <p>Admin navigation is only a hint; server-side guards enforce every mutation.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-canvas)]/92 px-4 py-3 backdrop-blur md:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="text-sm font-semibold">
                AI-OSS.net
              </Link>
              <ThemeToggle />
            </div>
          </header>

          <div className="hidden justify-end border-b border-[var(--color-border)] px-6 py-3 lg:flex">
            <ThemeToggle />
          </div>

          <div id="main-content" className="min-w-0">
            {children}
          </div>
        </div>

        <aside className="hidden border-l border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-6 xl:block">
          <div className="sticky top-6">
            <h2 className="text-sm font-semibold">Context</h2>
            <ul className="mt-4 grid gap-3 text-sm text-[var(--color-text-muted)]">
              {contextItems.map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel-strong)] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-2 shadow-lg lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {MOBILE_NAV_ITEMS.map((item) => (
            <MobileNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActivePath(pathname, item.href)}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("ai-oss-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = stored === "dark" || (stored === null && prefersDark);
    document.documentElement.classList.toggle("dark", enabled);
    setDark(enabled);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("ai-oss-theme", next ? "dark" : "light");
  }

  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      title={dark ? "Use light theme" : "Use dark theme"}
      className="grid h-9 w-9 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text)] outline-none transition hover:bg-[var(--color-panel-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  const Icon = icons[icon] ?? Home;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-text)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-strong)] hover:text-[var(--color-text)]",
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  const Icon = icons[icon] ?? Home;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "grid min-h-12 place-items-center gap-1 rounded-md px-1 py-1 text-[0.69rem] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-text)]"
          : "text-[var(--color-text-muted)]",
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sidebarItemsForPath(pathname: string): string[] {
  if (pathname.startsWith("/research")) {
    return ["Trending tags", "Open reviews", "Replication requests", "Recent versions"];
  }
  if (pathname.startsWith("/z")) {
    return ["Zone rules", "Active rooms", "Moderator queue", "Related papers"];
  }
  if (pathname.startsWith("/admin")) {
    return ["Audit log", "High-risk approvals", "Incident mode", "Feature flags"];
  }
  if (pathname.startsWith("/legal")) {
    return ["Policy versions", "Transparency reports", "Data requests", "Safety contacts"];
  }
  return ["Pinned research", "Active discussions", "Open reviews", "Community rules"];
}
