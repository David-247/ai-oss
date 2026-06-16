import Link from "next/link";
import {
  COOKIE_CATEGORIES,
  DO_NOT_SELL_OR_SHARE_DEFAULT,
  LEGAL_POLICY_PAGES,
  PROCESSING_RECORDS,
  RETENTION_SCHEDULES,
  VENDOR_REGISTER,
  legalPolicySummaries,
} from "@ai-oss/compliance";

export const metadata = {
  title: "Legal | AI-OSS.net",
};

export default function LegalPage() {
  return (
    <main
      aria-labelledby="legal-title"
      className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-6 md:py-8"
    >
      <header className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
          Legal
        </div>
        <h1 id="legal-title" className="text-3xl font-semibold tracking-normal md:text-4xl">
          Legal, Privacy, and Safety
        </h1>
        <p className="max-w-3xl text-base leading-7 text-[var(--color-text-muted)]">
          Policy pages, privacy rights, legal intake, cookie consent, safety reporting, and
          transparency records for AI-OSS.net.
        </p>
      </header>

      <section aria-labelledby="policies-title" className="space-y-3">
        <h2 id="policies-title" className="text-lg font-semibold">
          Policies
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {legalPolicySummaries().map((policy) => (
            <Link
              key={policy.slug}
              href={`/legal/${policy.slug}`}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-sm no-underline hover:bg-[var(--color-panel-strong)]"
            >
              <span className="block font-semibold text-[var(--color-text)]">{policy.title}</span>
              <span className="mt-2 block leading-6 text-[var(--color-text-muted)]">
                {policy.summary}
              </span>
              <span className="mt-3 block text-xs text-[var(--color-text-muted)]">
                {policy.version}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="privacy-controls-title"
        className="grid gap-4 lg:grid-cols-3"
      >
        <CompliancePanel
          title="Privacy Rights"
          items={[
            "Access/export",
            "Correction",
            "Deletion/anonymization",
            "Restriction",
            "Objection",
            "Automated-decision review",
            "Do Not Sell or Share",
          ]}
        />
        <CompliancePanel
          title="Cookie Consent"
          items={COOKIE_CATEGORIES.map(
            (category) =>
              `${category.label}: ${category.required ? "required" : "consent-gated"}`,
          )}
        />
        <CompliancePanel
          title="Default Posture"
          items={[
            DO_NOT_SELL_OR_SHARE_DEFAULT ? "Do not sell/share by default" : "Sale/share enabled",
            "No behavioral advertising at launch",
            "Global Privacy Control honored where applicable",
            "Nonessential analytics are withdrawable",
          ]}
        />
      </section>

      <section aria-labelledby="registers-title" className="grid gap-4 lg:grid-cols-3">
        <CompliancePanel
          title="Processing Records"
          items={PROCESSING_RECORDS.map((record) => `${record.key}: ${record.legalBasis}`)}
        />
        <CompliancePanel
          title="Vendors"
          items={VENDOR_REGISTER.map((vendor) => `${vendor.name}: ${vendor.dpaStatus}`)}
        />
        <CompliancePanel
          title="Retention"
          items={RETENTION_SCHEDULES.map((schedule) => `${schedule.key}: ${schedule.rule}`)}
        />
      </section>

      <section
        aria-labelledby="intake-title"
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
      >
        <h2 id="intake-title" className="text-lg font-semibold">
          Intake
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link className="button-secondary" href="/legal/dmca">
            DMCA
          </Link>
          <Link className="button-secondary" href="/legal/dsa">
            DSA
          </Link>
          <Link className="button-secondary" href="/legal/online-safety">
            Online Safety
          </Link>
        </div>
      </section>

      <div className="hidden">{LEGAL_POLICY_PAGES.length} legal policy pages loaded.</div>
    </main>
  );
}

function CompliancePanel({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-muted)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
