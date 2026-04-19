"use client";

import { FormEvent, useState } from "react";

function buildGoogleSearchUrl(query: string) {
  const trimmed = query.trim() || "SafeStep";
  return `https://www.google.com/search?igu=1&hl=en&q=${encodeURIComponent(trimmed)}`;
}

export default function GoogleSearchEmbed() {
  const [draftQuery, setDraftQuery] = useState("SafeStep");
  const [searchQuery, setSearchQuery] = useState("SafeStep");

  const searchUrl = buildGoogleSearchUrl(searchQuery);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(draftQuery.trim() || "SafeStep");
  };

  return (
    <section className="google-search-shell">
      <div className="google-search-header">
        <div>
          <p className="google-search-eyebrow">Embedded web view</p>
          <h2>Google Search inside SafeStep</h2>
          <p className="google-search-copy">
            Search the web from the main page while keeping the SafeStep workspace open below.
          </p>
        </div>

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
          title="Embedded Google Search"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="google-search-footer">
        <p>
          If the frame is blocked by your browser, use the direct Google link instead.
        </p>
        <a href={searchUrl} target="_blank" rel="noreferrer" className="google-search-link">
          Open in Google
        </a>
      </div>
    </section>
  );
}
