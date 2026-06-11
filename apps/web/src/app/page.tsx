// Placeholder landing (§ "Routes / APIs"). The real homepage ships in Phase 05.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-bold">AI-OSS.net</h1>
      <p className="text-balance text-zinc-600 dark:text-zinc-400">
        Open research coordination platform — forum, arXiv-style archive,
        realtime rooms, moderation, governance, and donations.
      </p>
      <p className="text-sm text-zinc-500">
        Platform foundation (Phase 00) is live. Product UI ships in Phase 05.
      </p>
    </main>
  );
}
