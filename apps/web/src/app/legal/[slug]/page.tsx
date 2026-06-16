import Link from "next/link";
import { notFound } from "next/navigation";
import { legalPolicyForSlug, legalPolicySummaries } from "@ai-oss/compliance";

type LegalRouteContext = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return legalPolicySummaries().map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({ params }: LegalRouteContext) {
  const { slug } = await params;
  const policy = legalPolicyForSlug(slug);
  return {
    title: `${policy?.title ?? slug} | AI-OSS.net`,
  };
}

export default async function LegalPolicyPage({ params }: LegalRouteContext) {
  const { slug } = await params;
  const policy = legalPolicyForSlug(slug);
  if (policy === null) {
    notFound();
  }

  return (
    <main
      aria-labelledby="policy-title"
      className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 md:px-6 md:py-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <article className="min-w-0 space-y-8">
        <header className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
            Legal
          </div>
          <h1 id="policy-title" className="text-3xl font-semibold tracking-normal md:text-4xl">
            {policy.title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[var(--color-text-muted)]">
            {policy.summary}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="rounded border border-[var(--color-border)] px-2 py-1">
              {policy.version}
            </span>
            <span className="rounded border border-[var(--color-border)] px-2 py-1">
              Updated {policy.updatedAt}
            </span>
          </div>
        </header>

        {policy.sections.map((section) => (
          <section
            key={section.heading}
            aria-labelledby={`${policy.slug}-${section.heading.replaceAll(/\W+/g, "-")}`}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
          >
            <h2
              id={`${policy.slug}-${section.heading.replaceAll(/\W+/g, "-")}`}
              className="text-lg font-semibold"
            >
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--color-text-muted)]">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </article>

      <aside className="space-y-3">
        <h2 className="text-sm font-semibold">Policies</h2>
        {legalPolicySummaries().map((item) => (
          <Link
            key={item.slug}
            href={`/legal/${item.slug}`}
            className={`block rounded-md border border-[var(--color-border)] px-3 py-2 text-sm ${
              item.slug === policy.slug
                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent-strong)]"
                : "bg-[var(--color-panel)] text-[var(--color-text-muted)]"
            }`}
          >
            {item.title}
          </Link>
        ))}
      </aside>
    </main>
  );
}
