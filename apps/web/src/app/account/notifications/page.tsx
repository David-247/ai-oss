"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const notificationOptions = [
  {
    name: "security_alerts",
    label: "Security alerts and suspicious-login notices",
    required: true,
  },
  {
    name: "product_updates",
    label: "Product and account updates",
    required: false,
  },
  {
    name: "research_activity",
    label: "Research submissions, reviews, replications, and citations",
    required: false,
  },
  {
    name: "moderation_activity",
    label: "Moderation actions and report outcomes involving me",
    required: false,
  },
  {
    name: "zone_digest",
    label: "Zone and community digest emails",
    required: false,
  },
  {
    name: "donation_updates",
    label: "Donation receipts and donor-badge notices where available",
    required: false,
  },
];

export default function AccountNotificationsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const notificationPreferences = Object.fromEntries(
        notificationOptions.map((option) => [
          option.name,
          formData.get(option.name) === "true",
        ]),
      );
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacy: {
            notificationPreferences: {
              ...notificationPreferences,
              digestFormat: String(formData.get("digest_format") ?? "summary"),
            },
            emailDigestFrequency: String(
              formData.get("digest_frequency") ?? "weekly",
            ),
          },
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Notification settings saved."
          : result.detail ?? result.title ?? "Notification update failed.",
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
            <h1 className="text-3xl font-bold tracking-tight">
              Notifications
            </h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Configure notification preferences used by account, research,
              moderation, donation, and digest jobs.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="notifications-form-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="notifications-form-title" className="text-lg font-semibold">
            Email preferences
          </h2>
          <form
            action="/api/account"
            method="post"
            onSubmit={handleSubmit}
            className="mt-5 space-y-6"
          >
            <input type="hidden" name="action" value="update_notifications" />
            <fieldset className="space-y-4">
              <legend className="sr-only">Notification types</legend>
              {notificationOptions.map((option) => (
                <label
                  key={option.name}
                  className="flex gap-3 rounded-md border border-zinc-200 p-4 text-sm leading-6 dark:border-zinc-800"
                >
                  {option.required ? (
                    <input type="hidden" name={option.name} value="true" />
                  ) : null}
                  <input
                    type="checkbox"
                    name={option.name}
                    value="true"
                    defaultChecked={option.required}
                    disabled={option.required}
                    className="mt-1 h-4 w-4 rounded border-zinc-300"
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    {option.required ? (
                      <span className="mt-1 block text-zinc-600 dark:text-zinc-400">
                        Required for account safety.
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Digest schedule</legend>
              <div className="space-y-2">
                <label htmlFor="digest-frequency" className="text-sm font-medium">
                  Digest frequency
                </label>
                <select
                  id="digest-frequency"
                  name="digest_frequency"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="never">No digest</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="digest-format" className="text-sm font-medium">
                  Digest format
                </label>
                <select
                  id="digest-format"
                  name="digest_format"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                >
                  <option value="summary">Summary</option>
                  <option value="full">Full detail</option>
                </select>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Save notification settings
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
