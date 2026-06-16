import Link from "next/link";
import {
  DONATION_AMOUNT_PRESETS_CENTS,
  DONATION_NO_INFLUENCE_STATEMENT,
  DONATION_TAX_STATUS_STATEMENT,
} from "@ai-oss/donations";

export const metadata = {
  title: "Donate | AI-OSS.net",
};

export default function DonatePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; donation?: string }>;
}) {
  void searchParams;

  return (
    <main
      aria-labelledby="donate-title"
      className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 md:px-6 md:py-8 lg:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div className="min-w-0 space-y-8">
        <header className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
            Funding
          </div>
          <div className="space-y-3">
            <h1 id="donate-title" className="max-w-4xl text-3xl font-semibold tracking-normal md:text-4xl">
              Donate to AI-OSS.net
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[var(--color-text-muted)]">
              Donations fund independent research coordination infrastructure: hosting,
              security, accessibility work, moderation tooling, abuse response, and long-term
              archive operations.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="donation-form-title"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
        >
          <h2 id="donation-form-title" className="text-lg font-semibold">
            Donation
          </h2>
          <form action="/api/stripe/checkout" method="post" className="mt-5 space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Amount</legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DONATION_AMOUNT_PRESETS_CENTS.map((amount, index) => (
                  <label
                    key={amount}
                    className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="amount_cents"
                      value={amount}
                      defaultChecked={index === 1}
                      className="size-4"
                    />
                    <span className="font-semibold">${(amount / 100).toLocaleString("en-US")}</span>
                  </label>
                ))}
              </div>
              <label className="block text-sm">
                <span className="font-semibold">Custom amount</span>
                <input
                  type="number"
                  name="custom_amount_dollars"
                  min="1"
                  max="5000"
                  step="1"
                  placeholder="USD"
                  className="mt-2 h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm"
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Frequency</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                  <input type="radio" name="mode" value="payment" defaultChecked className="size-4" />
                  <span>One-time</span>
                </label>
                <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                  <input type="radio" name="mode" value="subscription" className="size-4" />
                  <span>Monthly recurring</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Visibility</legend>
              <label className="flex items-start gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                <input type="checkbox" name="anonymous" value="true" className="mt-1 size-4" />
                <span>
                  Donate anonymously. Anonymous donations are retained for finance records but are
                  not shown publicly.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  name="donor_badge_opt_in"
                  value="true"
                  className="mt-1 size-4"
                />
                <span>
                  Show an optional public donor badge after a successful payment on a signed-in
                  account.
                </span>
              </label>
            </fieldset>

            <label className="block text-sm">
              <span className="font-semibold">Receipt email</span>
              <input
                type="email"
                name="receipt_email"
                autoComplete="email"
                className="mt-2 h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm"
              />
            </label>

            <button type="submit" className="button-primary w-full sm:w-auto">
              Continue to Stripe
            </button>
          </form>
        </section>
      </div>

      <aside className="space-y-4">
        <section
          aria-labelledby="mission-title"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
        >
          <h2 id="mission-title" className="text-lg font-semibold">
            Mission
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            AI-OSS.net exists to make research discussion, archiving, replication, and governance
            infrastructure available without selling influence over community systems.
          </p>
        </section>

        <section
          aria-labelledby="guardrails-title"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
        >
          <h2 id="guardrails-title" className="text-lg font-semibold">
            Guardrails
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            {DONATION_NO_INFLUENCE_STATEMENT}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            Donations never increase vote weight, research ranking, search ranking, moderation
            bypass, moderator status, admin status, governance rate limits, or publishing access.
          </p>
        </section>

        <section
          aria-labelledby="tax-title"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-5"
        >
          <h2 id="tax-title" className="text-lg font-semibold">
            Tax Status
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            {DONATION_TAX_STATUS_STATEMENT}
          </p>
          <Link
            href="mailto:support@ai-oss.net"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--color-link)] underline-offset-4 hover:underline"
          >
            Contact support
          </Link>
        </section>
      </aside>
    </main>
  );
}
