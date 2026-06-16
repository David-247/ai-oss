"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const exportItems = [
  "Profile and user settings",
  "Zone memberships",
  "Posts and comments",
  "Paper submissions and metadata",
  "Reviews and replications",
  "Votes where appropriate",
  "Moderation history involving the user",
  "Donation records where available",
  "Consent records",
];

export default function AccountExportPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_export",
          includeJson: true,
          includeCsv: formData.get("include_csv") === "true",
          deliveryEmail: String(formData.get("delivery_email") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Export request submitted."
          : result.detail ?? result.title ?? "Export request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="space-y-3">
          <Link
            href="/account"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Account
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Data export</h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Request a machine-readable archive. The export is delivered as an
              expiring-link archive with JSON and CSV where useful.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="export-contents-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="export-contents-title" className="text-lg font-semibold">
            Included data
          </h2>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            {exportItems.map((item) => (
              <li key={item} className="border-l border-zinc-300 pl-3">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="export-form-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="export-form-title" className="text-lg font-semibold">
            Request archive
          </h2>
          <form
            action="/api/account/export"
            method="post"
            onSubmit={handleSubmit}
            className="mt-5 space-y-5"
          >
            <input type="hidden" name="action" value="request_export" />
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">Formats</legend>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="include_json"
                  value="true"
                  defaultChecked
                  readOnly
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>JSON archive (required)</span>
              </label>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="include_csv"
                  value="true"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>CSV files where useful</span>
              </label>
            </fieldset>
            <div className="space-y-2">
              <label htmlFor="delivery-email" className="text-sm font-medium">
                Delivery email
              </label>
              <input
                id="delivery-email"
                name="delivery_email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Request export
            </button>
          </form>
        </section>

        {message !== null ? (
          <p
            role="status"
            className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
