import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account | AI-OSS.net",
};

const accountLinks = [
  {
    href: "/account/profile",
    title: "Profile",
    copy: "Edit username, display name, bio, website, GitHub, ORCID, affiliation, and research interests.",
  },
  {
    href: "/account/security",
    title: "Security",
    copy: "Manage sessions, password reset, email change confirmation, and MFA or passkey enrollment.",
  },
  {
    href: "/account/privacy",
    title: "Privacy",
    copy: "Control profile visibility, email visibility, affiliation visibility, contact permissions, cookies, search indexing, and donor badge display.",
  },
  {
    href: "/account/notifications",
    title: "Notifications",
    copy: "Choose product, moderation, research, security, and digest notification preferences.",
  },
  {
    href: "/account/export",
    title: "Data export",
    copy: "Request a machine-readable archive with JSON and CSV where useful.",
  },
  {
    href: "/account/delete",
    title: "Delete account",
    copy: "Start the re-authenticated deletion and anonymization workflow.",
  },
];

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
          >
            AI-OSS.net
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Account</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Manage identity, security, privacy, export, and deletion settings
              for your public AI-OSS.net account.
            </p>
          </div>
        </header>

        <nav
          aria-label="Account sections"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {accountLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <span className="block text-base font-semibold">
                {item.title}
              </span>
              <span className="mt-2 block text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {item.copy}
              </span>
            </Link>
          ))}
        </nav>

        <section
          aria-labelledby="account-copy-title"
          className="border-t border-zinc-200 pt-6 dark:border-zinc-800"
        >
          <h2 id="account-copy-title" className="text-lg font-semibold">
            Account baseline
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Basic activity must not require a donation, legal name, or connected
            GitHub account. Profile trust indicators, public contribution
            summaries, and donation badges are read from later phases when
            available.
          </p>
        </section>
      </div>
    </main>
  );
}
