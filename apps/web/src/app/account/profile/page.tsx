"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AccountProfilePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const researchInterests = String(formData.get("research_interests") ?? "")
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            username: String(formData.get("username") ?? ""),
            displayName: String(formData.get("display_name") ?? ""),
            bio: String(formData.get("bio") ?? ""),
            websiteUrl: String(formData.get("website_url") ?? ""),
            githubUsername: String(formData.get("github_username") ?? ""),
            orcid: String(formData.get("orcid") ?? ""),
            affiliation: String(formData.get("affiliation") ?? ""),
            researchInterests,
          },
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Profile saved."
          : (result.detail ?? result.title ?? "Profile update failed."),
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
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Keep your public researcher profile accurate. Avatar upload, contribution summary,
              reputation, trust indicators, and donation badges appear here when available.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="profile-form-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="profile-form-title" className="text-lg font-semibold">
            Editable profile fields
          </h2>
          <form
            action="/api/account"
            method="post"
            onSubmit={handleSubmit}
            className="mt-5 space-y-6"
          >
            <input type="hidden" name="action" value="update_profile" />
            <div className="grid gap-4 sm:grid-cols-2">
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
                  Display name
                </label>
                <input
                  id="display-name"
                  name="display_name"
                  type="text"
                  autoComplete="name"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="website" className="text-sm font-medium">
                  Website
                </label>
                <input
                  id="website"
                  name="website_url"
                  type="url"
                  autoComplete="url"
                  placeholder="https://example.org"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="github" className="text-sm font-medium">
                  GitHub username
                </label>
                <input
                  id="github"
                  name="github_username"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="orcid" className="text-sm font-medium">
                  ORCID
                </label>
                <input
                  id="orcid"
                  name="orcid"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000-0000-0000-0000"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="affiliation" className="text-sm font-medium">
                  Affiliation
                </label>
                <input
                  id="affiliation"
                  name="affiliation"
                  type="text"
                  autoComplete="organization"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={5}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="research-interests" className="text-sm font-medium">
                Research interests and tags
              </label>
              <textarea
                id="research-interests"
                name="research_interests"
                rows={3}
                placeholder="Interpretability, evals, open models"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>

            <div className="grid gap-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800 sm:grid-cols-2">
              <div>
                <p className="font-medium">User ID</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Read-only from Supabase Auth.
                </p>
              </div>
              <div>
                <p className="font-medium">Avatar file</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Stored after upload scanning and processing completes.
                </p>
              </div>
              <div>
                <p className="font-medium">Contribution summary</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Read-only public activity summary.
                </p>
              </div>
              <div>
                <p className="font-medium">Reputation and trust</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Read-only indicators from account safety and contribution history.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Save profile
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
