import Link from "next/link";
import type { ShellPageSpec } from "@ai-oss/design-system";
import { SHELL_PAGE_SPECS } from "@ai-oss/design-system";
import { PdfViewer } from "@/components/pdf-viewer";
import { SafeMarkdown } from "@/components/safe-markdown";

type ShellKey = keyof typeof SHELL_PAGE_SPECS;

export function RouteShellPage({
  specKey,
  title,
  eyebrow,
  summary,
  detail,
}: {
  specKey: ShellKey;
  title?: string;
  eyebrow?: string;
  summary?: string;
  detail?: string;
}) {
  const spec = SHELL_PAGE_SPECS[specKey] as ShellPageSpec;
  const resolvedTitle = title ?? spec.title;
  const resolvedEyebrow = eyebrow ?? spec.eyebrow;
  const resolvedSummary = summary ?? spec.summary;

  return (
    <main
      aria-labelledby="page-title"
      className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 md:px-6 md:py-8 xl:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="min-w-0 space-y-8">
        <header className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
            {resolvedEyebrow}
          </div>
          <div className="space-y-3">
            <h1
              id="page-title"
              className="max-w-4xl text-3xl font-semibold tracking-normal text-[var(--color-text)] md:text-4xl"
            >
              {resolvedTitle}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[var(--color-text-muted)]">
              {resolvedSummary}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {spec.primaryAction ? (
              <Link className="button-primary" href={spec.primaryAction.href}>
                {spec.primaryAction.label}
              </Link>
            ) : null}
            {spec.secondaryAction ? (
              <Link className="button-secondary" href={spec.secondaryAction.href}>
                {spec.secondaryAction.label}
              </Link>
            ) : null}
          </div>
        </header>

        {detail ? (
          <section
            aria-label="Current view"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
          >
            <p className="text-sm leading-6 text-[var(--color-text-muted)]">{detail}</p>
          </section>
        ) : null}

        <section aria-labelledby="workspace-title" className="space-y-4">
          <h2 id="workspace-title" className="text-lg font-semibold">
            Workspace
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {spec.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold">{section.title}</h3>
                  {section.status ? (
                    <span data-status={section.status} className="status-pill">
                      {statusLabel(section.status)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {specKey === "research" ? (
          <section aria-labelledby="research-rendering-title" className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
              <h2 id="research-rendering-title" className="text-lg font-semibold">
                Abstract Preview
              </h2>
              <div className="mt-4">
                <SafeMarkdown
                  markdown={
                    "## Example abstract\n\nOpen review notes support `code` and links like [policy](/legal/research-policy).\n\n```ts\nexport const result = await review();\n```"
                  }
                />
              </div>
            </div>
            <PdfViewer src="/sample-paper.pdf" title="Paper PDF preview" />
          </section>
        ) : null}
      </div>

      <aside className="space-y-4 xl:hidden">
        <h2 className="text-sm font-semibold">Context</h2>
        <ul className="grid gap-2 text-sm text-[var(--color-text-muted)] sm:grid-cols-2 xl:grid-cols-1">
          {spec.sidebar.map((item) => (
            <li
              key={item}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

function statusLabel(status: "ready" | "planned" | "guarded"): string {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "guarded") {
    return "Guarded";
  }
  return "Queued";
}
