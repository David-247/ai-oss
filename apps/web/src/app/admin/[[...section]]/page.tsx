import Link from "next/link";
import { headers } from "next/headers";
import {
  ADMIN_HOME_WIDGETS,
  adminPanelForSection,
  adminPanelSummaries,
  type AdminPanelDefinition,
} from "@ai-oss/admin";
import type { PermissionScope } from "@ai-oss/permissions";
import { requirePermissionForRequest } from "@/lib/permissions-server";

export const dynamic = "force-dynamic";

type AdminRouteContext = {
  params: Promise<{ section?: string[] }>;
};

export async function generateMetadata({ params }: AdminRouteContext) {
  const { section } = await params;
  const panel = adminPanelForSection(section);
  return {
    title: `${panel.title} | AI-OSS.net`,
  };
}

export default async function AdminPage({ params }: AdminRouteContext) {
  const { section } = await params;
  const panel = adminPanelForSection(section);
  const request = await requestFromHeaders(panel.path);
  const guard = await requirePermissionForRequest(request, panel.permission as PermissionScope);

  if (!guard.ok) {
    return <AdminDenied panel={panel} />;
  }

  return (
    <main
      aria-labelledby="admin-title"
      className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[16rem_minmax(0,1fr)]"
    >
      <nav
        aria-label="Admin panels"
        className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-3 xl:sticky xl:top-4 xl:self-start"
      >
        {adminPanelSummaries().map((item) => (
          <Link
            key={item.key}
            href={item.path}
            className={`block rounded px-3 py-2 text-sm ${
              item.key === panel.key
                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-strong)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-muted)]"
            }`}
          >
            {item.title}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 space-y-6">
        <header className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
            Admin
          </div>
          <h1 id="admin-title" className="text-3xl font-semibold tracking-normal">
            {panel.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="rounded border border-[var(--color-border)] px-2 py-1">
              {panel.permission}
            </span>
            <span className="rounded border border-[var(--color-border)] px-2 py-1">
              Server-side
            </span>
            <span className="rounded border border-[var(--color-border)] px-2 py-1">
              Audited actions
            </span>
          </div>
        </header>

        {panel.key === "overview" ? <AdminHomeWidgets /> : null}

        <section aria-labelledby="panel-checklist-title" className="space-y-3">
          <h2 id="panel-checklist-title" className="text-lg font-semibold">
            Controls
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {panel.checklist.map((item) => (
              <article
                key={item}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
              >
                <div className="text-sm font-semibold">{item}</div>
                <div className="mt-3 h-2 rounded bg-[var(--color-panel-muted)]" />
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="admin-data-title" className="space-y-3">
          <h2 id="admin-data-title" className="text-lg font-semibold">
            Data Sources
          </h2>
          <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--color-panel-muted)] text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Table</th>
                  <th className="px-3 py-2 font-semibold">Access</th>
                  <th className="px-3 py-2 font-semibold">Mode</th>
                </tr>
              </thead>
              <tbody>
                {panel.tables.map((table) => (
                  <tr key={table} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-mono text-xs">{table}</td>
                    <td className="px-3 py-2">{panel.permission}</td>
                    <td className="px-3 py-2">No-store</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminHomeWidgets() {
  return (
    <section aria-labelledby="admin-home-title" className="space-y-3">
      <h2 id="admin-home-title" className="text-lg font-semibold">
        Operations
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_HOME_WIDGETS.map((widget) => (
          <article
            key={widget}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
          >
            <div className="text-sm font-semibold">{widget}</div>
            <div className="mt-3 text-2xl font-semibold tracking-normal">0</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminDenied({ panel }: { panel: AdminPanelDefinition }) {
  return (
    <main
      aria-labelledby="admin-denied-title"
      className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6"
    >
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
          Admin
        </div>
        <h1 id="admin-denied-title" className="mt-2 text-2xl font-semibold tracking-normal">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
          {panel.title} requires `{panel.permission}`.
        </p>
      </div>
    </main>
  );
}

async function requestFromHeaders(path: string): Promise<Request> {
  const incoming = await headers();
  return new Request(`http://localhost${path}`, {
    headers: Object.fromEntries(incoming.entries()),
  });
}
