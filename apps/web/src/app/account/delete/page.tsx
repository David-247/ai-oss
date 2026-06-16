"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AccountDeletePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: String(formData.get("confirmation") ?? ""),
          consequencesAcknowledged:
            formData.get("deletion_consequences_acknowledged") === "true",
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Deletion request submitted."
          : result.detail ?? result.title ?? "Deletion request failed.",
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
              Delete account
            </h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This starts a re-authenticated deletion and anonymization request.
              You can request an export before continuing.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="delete-consequences-title"
          className="rounded-lg border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/70 dark:bg-zinc-900"
        >
          <h2 id="delete-consequences-title" className="text-lg font-semibold">
            Consequences
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            <p>
              Deletion revokes sessions, marks the account deletion-pending,
              queues deletion or anonymization, emits an audit event, and sends
              confirmation when the workflow completes.
            </p>
            <p>
              Private messages and private fields are deleted or anonymized
              unless legal retention applies. Public posts and comments can be
              user-deleted or anonymized.
            </p>
            <p>
              Published research versions are withdrawn, anonymized, or
              redacted as policy requires; they are never silently destroyed.
              Authorship PII can be removed or pseudonymized where legally
              required.
            </p>
            <p>
              These research-record consequences are shown before publication
              and again here before account deletion.
            </p>
          </div>
          <div className="mt-5">
            <Link
              href="/account/export"
              className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            >
              Request a data export first
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="delete-form-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="delete-form-title" className="text-lg font-semibold">
            Confirm deletion request
          </h2>
          <form
            action="/api/account/delete"
            method="post"
            onSubmit={handleSubmit}
            className="mt-5 space-y-5"
          >
            <input type="hidden" name="action" value="request_deletion" />
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Account email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Re-authentication password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmation" className="text-sm font-medium">
                Type DELETE MY ACCOUNT to confirm
              </label>
              <input
                id="confirmation"
                name="confirmation"
                type="text"
                pattern="DELETE MY ACCOUNT"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>
            <label className="flex gap-3 text-sm leading-6">
              <input
                type="checkbox"
                name="deletion_consequences_acknowledged"
                value="true"
                required
                className="mt-1 h-4 w-4 rounded border-zinc-300"
              />
              <span>
                I understand the deletion, anonymization, retention, and
                published-research handling described above.
              </span>
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
            >
              Request account deletion
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
