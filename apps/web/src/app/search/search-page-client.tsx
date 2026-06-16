"use client";

import { Search } from "lucide-react";
import { useState } from "react";

type SearchResult = {
  target_type: string;
  target_id: string;
  title: string;
  body: string;
  rank?: number;
};

type SearchResponse = {
  results?: SearchResult[];
  facets?: {
    targetTypes?: { value: string; count: number }[];
  };
  page?: {
    nextCursor?: string | null;
    hasMore?: boolean;
  };
};

const targetTypes = [
  "paper",
  "paper_full_text",
  "post",
  "comment",
  "zone",
  "user",
  "tag",
  "chat_message",
] as const;

export function SearchPageClient() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("paper");
  const [status, setStatus] = useState("Ready");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  async function runSearch(append = false) {
    setStatus("Searching");
    const params = new URLSearchParams({ q: query, type, limit: "20" });
    if (append && nextCursor) {
      params.set("cursor", nextCursor);
    }
    const response = await fetch(`/api/search?${params.toString()}`, { credentials: "include" });
    const data = (await response.json().catch(() => null)) as SearchResponse | null;
    setResults((current) => (append ? [...current, ...(data?.results ?? [])] : data?.results ?? []));
    setNextCursor(data?.page?.nextCursor ?? null);
    setStatus(
      response.ok ? `${data?.results?.length ?? 0} results` : `Search failed: ${response.status}`,
    );
  }

  return (
    <main
      aria-labelledby="search-title"
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6 md:py-8"
    >
      <header className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-strong)]">
          Search
        </div>
        <h1 id="search-title" className="text-3xl font-semibold tracking-normal md:text-4xl">
          Search archive
        </h1>
      </header>

      <section className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setNextCursor(null);
            void runSearch(false);
          }}
        >
          <label className="min-w-0">
            <span className="sr-only">Query</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm"
              name="q"
              placeholder="papers, authors, tags, zones"
            />
          </label>
          <label>
            <span className="sr-only">Type</span>
            <select
              value={type}
              onChange={(event) => setType(event.currentTarget.value)}
              className="h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm"
              name="type"
            >
              {targetTypes.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {targetType.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-primary gap-2">
            <Search size={16} />
            Search
          </button>
        </form>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">{status}</p>
      </section>

      <section className="grid gap-3">
        {results.map((result) => (
          <article
            key={`${result.target_type}:${result.target_id}`}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
            style={{ contentVisibility: "auto", containIntrinsicSize: "160px" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{result.title}</h2>
              <span className="status-pill" data-status="ready">
                {result.target_type.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{result.body}</p>
          </article>
        ))}
        {nextCursor ? (
          <button
            type="button"
            className="button-secondary justify-self-start"
            onClick={() => void runSearch(true)}
          >
            Load more
          </button>
        ) : null}
      </section>
    </main>
  );
}
