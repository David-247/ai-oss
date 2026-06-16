"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function LogoutPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const action = String(formData.get("action") ?? "logout");
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Logout request submitted."
          : result.detail ?? result.title ?? "Logout failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <header className="space-y-3">
          <Link
            href="/account"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Account
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Log out</h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              End this browser session, or revoke every active session if you
              believe your account is at risk.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="logout-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="logout-title" className="text-lg font-semibold">
            Session controls
          </h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <form action="/api/auth" method="post" onSubmit={handleSubmit}>
              <input type="hidden" name="action" value="logout" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Log out here
              </button>
            </form>
            <form action="/api/auth" method="post" onSubmit={handleSubmit}>
              <input type="hidden" name="action" value="logout_everywhere" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Log out everywhere
              </button>
            </form>
          </div>
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
