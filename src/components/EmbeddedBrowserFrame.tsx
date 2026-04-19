"use client";

import Image from "next/image";
import Link from "next/link";

type BrowserStatus = "idle" | "running" | "paused" | "error";

interface EmbeddedBrowserFrameProps {
  currentUrl: string;
  pageTitle?: string;
  screenshotB64?: string | null;
  status?: BrowserStatus;
}

function normalizeFrameUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/.test(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    if (/^www\./i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return "";
  }
}

export default function EmbeddedBrowserFrame({
  currentUrl,
  pageTitle,
  screenshotB64 = null,
  status = "idle",
}: EmbeddedBrowserFrameProps) {
  const frameUrl = normalizeFrameUrl(currentUrl);
  const frameLabel = pageTitle?.trim() || "SafeStep browser";

  return (
    <section className="embedded-browser-shell">
      <div className="embedded-browser-topbar">
        <Link href="/navigate" className="google-brand" aria-label="Open SafeStep navigation">
          <span className="google-brand-mark" aria-hidden="true">
            S
          </span>
          <span className="google-brand-wordmark">SafeStep</span>
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`status-badge ${
              status === "running"
                ? "status-running"
                : status === "paused"
                  ? "status-paused"
                  : status === "error"
                    ? "status-error"
                    : "status-idle"
            }`}
          >
            {status === "running"
              ? "Following steps"
              : status === "paused"
                ? "Paused"
                : status === "error"
                  ? "Error"
                  : "Ready"}
          </span>
        </div>
      </div>

      <div className="embedded-browser-frame-shell">
        {screenshotB64 ? (
          <div className="embedded-browser-screenshot-shell">
            <Image
              className="embedded-browser-screenshot"
              src={`data:image/png;base64,${screenshotB64}`}
              alt={frameLabel}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 100vw"
            />
          </div>
        ) : frameUrl ? (
          <iframe
            key={frameUrl}
            className="embedded-browser-frame"
            src={frameUrl}
            title={frameLabel}
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="embedded-browser-placeholder">
            <div className="embedded-browser-placeholder-badge">Awaiting navigation</div>
            <h4>Start a browser trace from the copilot bubble.</h4>
            <p>
              SafeStep will keep the browser agent and this frame in sync. If a site blocks
              iframe embedding, the agent still follows the page and the shell keeps the latest
              URL visible here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
