"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const DEFAULT_QUERY = "SafeStep";

const RESULT_LIBRARY: SearchResult[] = [
  {
    title: "SafeStep assistant",
    url: "/",
    snippet: "Open the main SafeStep assistant and continue the current task.",
  },
  {
    title: "Medication refill guide",
    url: "/navigate",
    snippet: "Review the healthcare navigation tools and next-step guidance.",
  },
  {
    title: "Appointment prep checklist",
    url: "/onboarding/paste",
    snippet: "Paste notes and build a simple appointment plan.",
  },
  {
    title: "Google Calendar connection",
    url: "/login",
    snippet: "Sign in and connect calendar access for appointment awareness.",
  },
];

function buildResults(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return RESULT_LIBRARY;
  }

  const matches = RESULT_LIBRARY.filter((result) => {
    const haystack = `${result.title} ${result.snippet}`.toLowerCase();
    return haystack.includes(normalized);
  });

  return matches.length ? matches : RESULT_LIBRARY;
}

export default function LocalSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeQuery = searchParams.get("q")?.trim() || DEFAULT_QUERY;
  const [draftQuery, setDraftQuery] = useState(activeQuery);

  const results = useMemo(() => buildResults(activeQuery), [activeQuery]);

  return (
    <main className="local-search-shell">
      <section className="local-search-hero">
        <p className="local-search-eyebrow">Search</p>
        <h1>Find what you need, one step at a time.</h1>
        <p className="local-search-copy">
          This local page behaves like a lightweight search home page inside SafeStep. It stays
          embedded and does not rely on an external site that blocks iframes.
        </p>

        <form
          className="local-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextQuery = draftQuery.trim() || DEFAULT_QUERY;
            setDraftQuery(nextQuery);
            router.replace(`/search?q=${encodeURIComponent(nextQuery)}`);
          }}
        >
          <label className="sr-only" htmlFor="local-search-input">
            Search
          </label>
          <input
            id="local-search-input"
            className="local-search-input"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search the web"
          />
          <button className="local-search-button" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="local-search-results" aria-live="polite">
        <div className="local-search-results-header">
          <p className="local-search-results-label">Results for</p>
          <p className="local-search-results-query">{activeQuery}</p>
        </div>

        <div className="local-search-result-list">
          {results.map((result) => (
            <a key={result.title} href={result.url} className="local-search-result-card">
              <p className="local-search-result-url">{result.url}</p>
              <h2>{result.title}</h2>
              <p>{result.snippet}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
