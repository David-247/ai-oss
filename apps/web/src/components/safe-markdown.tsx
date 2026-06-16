import { renderSafeMarkdown } from "@ai-oss/design-system";

export function SafeMarkdown({ markdown }: { markdown: string }) {
  const rendered = renderSafeMarkdown(markdown);

  return <div className="safe-markdown" dangerouslySetInnerHTML={{ __html: rendered.html }} />;
}
