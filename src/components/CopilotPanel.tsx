"use client";

import { useState } from "react";

interface CopilotPanelProps {
  onClose: () => void;
  currentUrl: string;
  currentPageTitle: string;
  onNavigateBanana: () => void;
  onRunPharmacyTrace?: () => void;
}

type PanelState = {
  title: string;
  detail: string;
};

const QUICK_ACTIONS = [
  { label: "What was I doing?", message: "What was I doing?" },
  { label: "Show appointments", message: "Show me my appointments." },
  { label: "Is this safe?", message: "Is this safe?" },
];

export default function CopilotPanel({
  onClose,
  currentUrl,
  currentPageTitle,
  onNavigateBanana,
  onRunPharmacyTrace,
}: CopilotPanelProps) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>({
    title: "Ready",
    detail: "Pick a small action or type a short question.",
  });

  const updateState = (title: string, detail: string) => {
    setPanelState({ title, detail });
  };

  const sendChatMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    updateState("Thinking", "SafeStep is checking that now.");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      updateState("Reply", data.message || data.explanation || "I am here to help.");
    } catch {
      updateState("Error", "I could not connect right now. Please try again.");
    } finally {
      setLoading(false);
      setDraft("");
    }
  };

  const focusBrowserTrace = () => {
    document.getElementById("browser-task-area")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    updateState("Browser trace", "The embedded browser trace is ready below.");
  };

  return (
    <div
      className="flex h-full max-h-[calc(100vh-124px)] w-full max-w-[360px] flex-col overflow-hidden rounded-[26px] border border-surface-200 bg-[rgba(255,253,249,0.98)] shadow-[0_18px_50px_rgba(34,44,37,0.18)] backdrop-blur-xl"
      id="copilot-panel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-surface-200 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-text-muted">
            SafeStep
          </p>
          <h2 className="truncate text-lg font-bold text-text-primary">Quick actions</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateBanana}
            className="flex h-9 items-center justify-center rounded-full border border-surface-200 bg-white px-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:border-primary-300 hover:text-text-primary"
            aria-label="Open banana search"
            title="Open banana search"
          >
            Banana
          </button>
          <button
            type="button"
            onClick={() => {
              onRunPharmacyTrace?.();
              focusBrowserTrace();
            }}
            className="flex h-9 items-center justify-center rounded-full border border-surface-200 bg-white px-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:border-primary-300 hover:text-text-primary disabled:opacity-50"
            aria-label="Focus browser trace"
            title="Focus browser trace"
          >
            Trace
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-200 bg-white text-text-muted transition-colors hover:border-primary-300 hover:text-text-primary"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Status
          </p>
          <p className="mt-1.5 text-lg font-semibold text-text-primary">{panelState.title}</p>
          <p className="mt-1 text-base leading-relaxed text-text-secondary">{panelState.detail}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            Current page
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {currentPageTitle || "Waiting for a browser trace."}
          </p>
          <p className="mt-1 text-sm text-text-secondary break-all">
            {currentUrl || "The embedded browser will show the current page here."}
          </p>
        </div>

        <div className="space-y-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={loading}
              onClick={() => void sendChatMessage(action.message)}
              className="flex w-full items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left text-base font-medium leading-snug text-text-primary transition-colors hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50"
            >
              <span>{action.label}</span>
              <span className="text-text-muted">→</span>
            </button>
          ))}
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendChatMessage(draft);
          }}
        >
          <label className="block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Ask
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a short question"
              className="min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={loading || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
              aria-label="Send question"
            >
              →
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3.5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Reply
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-text-primary">{panelState.detail}</p>
        </div>
      </div>
    </div>
  );
}
