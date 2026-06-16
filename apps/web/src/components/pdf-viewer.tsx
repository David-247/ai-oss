import { buildPdfViewerDescriptor } from "@ai-oss/design-system";

export function PdfViewer({ src, title }: { src: string; title: string }) {
  const descriptor = buildPdfViewerDescriptor({ src, title });

  return (
    <figure className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]">
      <iframe
        title={descriptor.title}
        src={descriptor.src}
        sandbox={descriptor.sandbox}
        className="h-80 w-full bg-white"
      />
      <figcaption className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
        <span>{descriptor.title}</span>
        <a
          href={descriptor.src}
          className="font-medium text-[var(--color-link)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
        >
          {descriptor.downloadLabel}
        </a>
      </figcaption>
    </figure>
  );
}
