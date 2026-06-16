"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AccountPrivacyPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePrivacySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const analyticsConsent = formData.get("allow_cookie_analytics") === "true";
      const donorBadgeVisible =
        formData.get("show_public_donor_badge") === "true";
      const searchIndexingEnabled =
        formData.get("allow_profile_search_indexing") === "true";
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            profileVisibility: String(
              formData.get("profile_visibility") ?? "public",
            ),
            emailVisibility: String(
              formData.get("email_visibility") ?? "private",
            ),
            contactPermission: String(
              formData.get("contact_permissions") ?? "members",
            ),
            searchIndexingEnabled,
            donorBadgeVisible,
          },
          privacy: {
            analyticsConsent,
            cookieConsent: { optional_analytics: analyticsConsent },
            publicDonorBadgeOptIn: donorBadgeVisible,
            dmPermissions: String(formData.get("contact_permissions") ?? "members"),
            affiliationVisibility: String(
              formData.get("affiliation_visibility") ?? "public",
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
          ? "Privacy settings saved."
          : result.detail ?? result.title ?? "Privacy update failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePrivacyRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/account/privacy-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: String(formData.get("request_type") ?? ""),
          message: String(formData.get("details") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
      };
      setMessage(
        response.ok
          ? "Privacy request submitted."
          : result.detail ?? result.title ?? "Privacy request failed.",
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
              Privacy controls
            </h1>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Choose what is public, how people can contact you, and whether
              optional cookies, analytics, donor badge display, or profile
              search indexing are enabled.
            </p>
          </div>
        </header>

        <section
          aria-labelledby="privacy-form-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="privacy-form-title" className="text-lg font-semibold">
            Visibility and consent
          </h2>
          <form
            action="/api/account"
            method="post"
            onSubmit={handlePrivacySubmit}
            className="mt-5 space-y-6"
          >
            <input type="hidden" name="action" value="update_privacy" />

            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">
                Public visibility
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="profile-visibility"
                    className="text-sm font-medium"
                  >
                    Profile visibility
                  </label>
                  <select
                    id="profile-visibility"
                    name="profile_visibility"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                  >
                    <option value="public">Public</option>
                    <option value="authenticated">Signed-in members only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="email-visibility"
                    className="text-sm font-medium"
                  >
                    Email visibility
                  </label>
                  <select
                    id="email-visibility"
                    name="email_visibility"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                  >
                    <option value="private">Private</option>
                    <option value="authenticated">Signed-in members only</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="affiliation-visibility"
                    className="text-sm font-medium"
                  >
                    Research affiliation visibility
                  </label>
                  <select
                    id="affiliation-visibility"
                    name="affiliation_visibility"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                  >
                    <option value="public">Public</option>
                    <option value="authenticated">Signed-in members only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="contact-permissions"
                    className="text-sm font-medium"
                  >
                    DM and contact permissions
                  </label>
                  <select
                    id="contact-permissions"
                    name="contact_permissions"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                  >
                    <option value="members">Signed-in members</option>
                    <option value="everyone">Everyone</option>
                    <option value="none">No direct contact</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <legend className="px-1 text-sm font-semibold">
                Preferences
              </legend>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="allow_cookie_analytics"
                  value="true"
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>Allow optional cookie and analytics consent.</span>
              </label>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="show_public_donor_badge"
                  value="true"
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>Show a public donor badge when donation status exists.</span>
              </label>
              <label className="flex gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  name="allow_profile_search_indexing"
                  value="true"
                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                />
                <span>Allow profile search indexing where applicable.</span>
              </label>
            </fieldset>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Save privacy settings
            </button>
          </form>
        </section>

        <section
          aria-labelledby="privacy-request-title"
          className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="privacy-request-title" className="text-lg font-semibold">
            Privacy request
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Submit a correction, objection, or processing restriction request.
            Use the export and delete pages for those dedicated workflows.
          </p>
          <form
            action="/api/account/privacy-request"
            method="post"
            onSubmit={handlePrivacyRequest}
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="action" value="submit_privacy_request" />
            <div className="space-y-2">
              <label htmlFor="request-type" className="text-sm font-medium">
                Request type
              </label>
              <select
                id="request-type"
                name="request_type"
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              >
                <option value="rectify">Correction</option>
                <option value="objection">Objection</option>
                <option value="restrict_processing">
                  Restrict processing
                </option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="request-details" className="text-sm font-medium">
                Details
              </label>
              <textarea
                id="request-details"
                name="details"
                rows={5}
                required
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Submit privacy request
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
