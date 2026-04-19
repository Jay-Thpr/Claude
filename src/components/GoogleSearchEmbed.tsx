"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

function buildGoogleSearchUrl(query: string) {
  const trimmed = query.trim() || "SafeStep";
  return `/search?q=${encodeURIComponent(trimmed)}`;
}

interface GoogleSearchEmbedProps {
  currentUrl?: string | null;
  onNavigate?: (url: string) => void;
}

export default function GoogleSearchEmbed({
  currentUrl = null,
  onNavigate,
}: GoogleSearchEmbedProps) {
  const [draftQuery, setDraftQuery] = useState("SafeStep");
  const [searchQuery, setSearchQuery] = useState("SafeStep");

  const searchUrl = currentUrl || buildGoogleSearchUrl(searchQuery);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = draftQuery.trim() || "SafeStep";
    const nextUrl = buildGoogleSearchUrl(nextQuery);
    setSearchQuery(nextQuery);
    onNavigate?.(nextUrl);
  };

  return (
    <section className="google-search-shell">
      <div className="google-search-header">
        <Link href="/navigate" className="google-brand" aria-label="Open SafeStep navigation">
          <span className="google-brand-mark" aria-hidden="true">
            S
          </span>
          <span className="google-brand-wordmark">SafeStep</span>
        </Link>

        <form className="google-search-form" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="google-search-input">
            Search Google
          </label>
          <input
            id="google-search-input"
            type="search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Search Google"
            className="google-search-input"
          />
          <button type="submit" className="google-search-button">
            Search
          </button>
        </form>
      </div>

      <div className="google-search-frame-shell">
        <iframe
          key={searchUrl}
          className="google-search-frame"
          src={searchUrl}
          title="SafeStep search"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </section>
  );
}
