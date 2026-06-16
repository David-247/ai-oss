"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type AuthResult = {
  detail?: string;
  title?: string;
  url?: string;
  emailSent?: boolean;
};

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function postAuth(payload: Record<string, unknown>) {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as AuthResult;
      if (!response.ok) {
        setMessage(result.detail ?? result.title ?? "The auth request failed.");
        return;
      }
      if (result.url !== undefined) {
        window.location.assign(result.url);
        return;
      }
      setMessage(
        result.emailSent === true
          ? "Check your email for the next step."
          : "Auth request submitted.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value === "reset_password" ? "reset_password" : "login";
    await postAuth({
      action,
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  async function handlePasswordlessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await postAuth({
      action: "passwordless",
      email: String(formData.get("email") ?? ""),
    });
  }

  async function handleGithubSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAuth({
      action: "oauth",
      provider: "github",
      redirectTo: `${window.location.origin}/account`,
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            AI-OSS.net
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Log in to your account
            </h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Public user identity is handled by Supabase Auth. Use email and
              password, a passwordless email link, or GitHub if your workspace
              has GitHub OAuth configured.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="password-login-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="password-login-title" className="text-lg font-semibold">
            Email and password
          </h2>
          <form
            action="/api/auth"
            method="post"
            onSubmit={handlePasswordSubmit}
            className="mt-5 space-y-5"
          >
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
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
                Password
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                name="action"
                value="login"
                disabled={isSubmitting}
                className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Log in
              </button>
              <button
                type="submit"
                name="action"
                value="reset_password"
                formNoValidate
                disabled={isSubmitting}
                className="text-left text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
              >
                Send password reset email
              </button>
            </div>
          </form>
        </section>

        <section
          aria-labelledby="passwordless-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="passwordless-title" className="text-lg font-semibold">
            Passwordless or GitHub
          </h2>
          <div className="mt-5 grid gap-4">
            <form
              action="/api/auth"
              method="post"
              onSubmit={handlePasswordlessSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="action" value="passwordless" />
              <div className="space-y-2">
                <label
                  htmlFor="passwordless-email"
                  className="text-sm font-medium"
                >
                  Email
                </label>
                <input
                  id="passwordless-email"
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
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Email me a sign-in link
              </button>
            </form>
            <form action="/api/auth" method="post" onSubmit={handleGithubSubmit}>
              <input type="hidden" name="action" value="oauth" />
              <input type="hidden" name="provider" value="github" />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Continue with GitHub
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

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          New to AI-OSS.net?{" "}
          <Link
            href="/signup"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Create an account
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
