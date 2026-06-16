"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AccountSecurityPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuthAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Security request submitted."
          : (result.detail ?? result.title ?? "Security request failed."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-3">
          <Link
            href="/account"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            Account
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Security</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Review active sessions, reset your password, request an email change confirmation, and
              enroll stronger authentication. Elevated admin and moderator accounts must use MFA or
              passkeys when those roles ship.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="sessions-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="sessions-title" className="text-lg font-semibold">
                Active sessions
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                The API should replace this static row with the signed-in user's active session
                list.
              </p>
            </div>
            <form action="/api/auth" method="post" onSubmit={handleAuthAction}>
              <input type="hidden" name="action" value="logout_everywhere" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Revoke all sessions
              </button>
            </form>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Active account sessions</caption>
              <thead className="border-b border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Session
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Last active
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Location
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 pr-4">Current browser</td>
                  <td className="py-3 pr-4">Now</td>
                  <td className="py-3 pr-4">Detected by server</td>
                  <td className="py-3">
                    <form action="/api/auth" method="post" onSubmit={handleAuthAction}>
                      <input type="hidden" name="action" value="revoke_session" />
                      <input type="hidden" name="session_id" value="current" />
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="security-actions-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="security-actions-title" className="text-lg font-semibold">
            Account access
          </h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <form
              action="/api/auth"
              method="post"
              onSubmit={handleAuthAction}
              className="space-y-4"
            >
              <input type="hidden" name="action" value="reset_password" />
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium">
                  Password reset email
                </label>
                <input
                  id="reset-email"
                  name="email"
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
                Send reset
              </button>
            </form>

            <form
              action="/api/auth"
              method="post"
              onSubmit={handleAuthAction}
              className="space-y-4"
            >
              <input type="hidden" name="action" value="change_email" />
              <div className="space-y-2">
                <label htmlFor="new-email" className="text-sm font-medium">
                  New email
                </label>
                <input
                  id="new-email"
                  name="new_email"
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
                Send confirmation
              </button>
            </form>
          </div>
        </section>

        <section
          aria-labelledby="strong-auth-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="strong-auth-title" className="text-lg font-semibold">
            MFA and passkeys
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            These controls are optional for public users and required for elevated admins and
            moderators.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <form action="/api/auth" method="post" onSubmit={handleAuthAction}>
              <input type="hidden" name="action" value="enroll_mfa" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Enroll MFA
              </button>
            </form>
            <form action="/api/auth" method="post" onSubmit={handleAuthAction}>
              <input type="hidden" name="action" value="enroll_passkey" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Add passkey
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
