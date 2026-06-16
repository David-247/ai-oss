"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const policies = [
  {
    id: "terms",
    key: "terms",
    name: "terms_consent",
    label: "I accept the Terms.",
    versionName: "terms_version",
  },
  {
    id: "privacy",
    key: "privacy",
    name: "privacy_policy_consent",
    label: "I accept the Privacy Policy.",
    versionName: "privacy_policy_version",
  },
  {
    id: "community-guidelines",
    key: "community_guidelines",
    name: "community_guidelines_consent",
    label: "I accept the Community Guidelines.",
    versionName: "community_guidelines_version",
  },
  {
    id: "research-publishing-policy",
    key: "research_publishing",
    name: "research_publishing_policy_consent",
    label: "I accept the Research Publishing Policy.",
    versionName: "research_publishing_policy_version",
  },
  {
    id: "cookie-policy",
    key: "cookie_policy",
    name: "cookie_policy_consent",
    label: "I accept the Cookie Policy.",
    versionName: "cookie_policy_version",
  },
];

export default function SignupPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const consents = Object.fromEntries(
        policies
          .filter((policy) => formData.get(policy.name) === "true")
          .map((policy) => [
            policy.key,
            String(formData.get(policy.versionName) ?? "phase-03"),
          ]),
      );
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          username: String(formData.get("username") ?? ""),
          displayName: String(formData.get("display_name") ?? ""),
          bio: String(formData.get("bio") ?? ""),
          ageAttested: formData.get("age_attestation") === "true",
          consents,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Signup submitted. Check your email for verification."
          : result.detail ?? result.title ?? "Signup failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            AI-OSS.net
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Create your account
            </h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Sign up with email and password. Email verification is required
              before the account is fully active. Display name and bio are
              optional.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="signup-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="signup-title" className="text-lg font-semibold">
            Account details
          </h2>
          <form
            action="/api/auth"
            method="post"
            onSubmit={handleSubmit}
            className="mt-5 space-y-6"
          >
            <input type="hidden" name="action" value="signup" />
            {policies.map((policy) => (
              <input
                key={policy.versionName}
                type="hidden"
                name={policy.versionName}
                value="phase-03"
              />
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
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
                  autoComplete="new-password"
                  required
                  minLength={12}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="display-name" className="text-sm font-medium">
                  Display name <span className="font-normal">(optional)</span>
                </label>
                <input
                  id="display-name"
                  name="display_name"
                  type="text"
                  autoComplete="name"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio <span className="font-normal">(optional)</span>
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>

            <fieldset className="space-y-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <legend className="px-1 text-sm font-semibold">
                Required attestations and consent
              </legend>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="age_attestation"
                  value="true"
                  required
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>
                  I attest that I am old enough to create an account and use
                  this research community under the laws that apply to me.
                </span>
              </label>
              {policies.map((policy) => (
                <label
                  key={policy.id}
                  className="flex gap-3 text-sm leading-6"
                >
                  <input
                    type="checkbox"
                    name={policy.name}
                    value="true"
                    required
                    className="mt-1 h-4 w-4 rounded border-zinc-300"
                  />
                  <span>{policy.label}</span>
                </label>
              ))}
            </fieldset>

            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Basic participation does not require a donation, legal name, or a
              connected GitHub account. Stronger verification may only be
              requested later for anti-abuse thresholds.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Create account and send verification email
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

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Log in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
