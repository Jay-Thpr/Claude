"use client";

import { useState, useCallback, useEffect } from "react";

interface CopilotPanelProps {
  currentUrl: string;
  currentPageTitle: string;
  onClose: () => void;
}

interface AssistantResponse {
  type: "next-step" | "scam-check" | "appointment" | "memory";
  content: string;
  classification?: "safe" | "not-sure" | "risky";
  timestamp: Date;
}

interface CalendarStatus {
  connected: boolean;
  message: string;
  profile?: {
    email?: string;
    name?: string;
  } | null;
  nextAppointment?: {
    summary: string;
    whenLabel: string;
    timeLabel?: string;
    location?: string;
  } | null;
  source?: string;
}

export default function CopilotPanel({
  currentUrl,
  currentPageTitle,
  onClose,
}: CopilotPanelProps) {
  const [responses, setResponses] = useState<AssistantResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const addResponse = useCallback((response: AssistantResponse) => {
    setResponses((prev) => [response, ...prev]);
  }, []);

  const loadCalendarStatus = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/gcal/status");
      const data = (await res.json()) as CalendarStatus;
      setCalendarStatus(data);
    } catch {
      setCalendarStatus({
        connected: false,
        message: "I couldn't check Google Calendar right now.",
      });
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCalendarStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCalendarStatus]);

  const handleCalendarConnect = () => {
    window.location.href = "/api/gcal/connect";
  };

  const handleCalendarDisconnect = async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/gcal/disconnect", { method: "POST" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await loadCalendarStatus();
    } catch {
      setCalendarStatus({
        connected: false,
        message: "I couldn't disconnect Google Calendar right now.",
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleNextStep = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/next-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          pageTitle: currentPageTitle,
          question: freeText || undefined,
        }),
      });
      const data = await res.json();
      addResponse({
        type: "next-step",
        content: data.explanation || data.message || "I can help you with that. Let me look at what you're doing.",
        timestamp: new Date(),
      });
    } catch {
      addResponse({
        type: "next-step",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      });
    }
    setIsLoading(false);
    setFreeText("");
  };

  const handleScamCheck = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          pageTitle: currentPageTitle,
          content: freeText || undefined,
        }),
      });
      const data = await res.json();
      addResponse({
        type: "scam-check",
        content: data.explanation || "Let me check that for you.",
        classification: data.classification || "not-sure",
        timestamp: new Date(),
      });
    } catch {
      addResponse({
        type: "scam-check",
        content: "I couldn't check this right now. If you're unsure about a website, it's safer to wait.",
        classification: "not-sure",
        timestamp: new Date(),
      });
    }
    setIsLoading(false);
    setFreeText("");
  };

  const handleAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      addResponse({
        type: "appointment",
        content: data.message || "No upcoming appointments found.",
        timestamp: new Date(),
      });
    } catch {
      addResponse({
        type: "appointment",
        content: "I couldn't check your appointments right now. Please try again.",
        timestamp: new Date(),
      });
    }
    setIsLoading(false);
  };

  const handleMemory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      addResponse({
        type: "memory",
        content: data.current_task
          ? `You were working on: ${data.current_task}. Your last step was: ${data.last_step || "just getting started"}.`
          : "I don't have any saved tasks yet. Start browsing and I'll keep track for you!",
        timestamp: new Date(),
      });
    } catch {
      addResponse({
        type: "memory",
        content: "I couldn't check your saved tasks right now.",
        timestamp: new Date(),
      });
    }
    setIsLoading(false);
  };

  const getClassificationStyles = (classification?: string) => {
    switch (classification) {
      case "safe":
        return "response-card-safe";
      case "risky":
        return "response-card-danger";
      case "not-sure":
        return "response-card-warning";
      default:
        return "";
    }
  };

  const getClassificationIcon = (classification?: string) => {
    switch (classification) {
      case "safe":
        return "✅";
      case "risky":
        return "🚨";
      case "not-sure":
        return "⚠️";
      default:
        return "";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "next-step":
        return "👉";
      case "scam-check":
        return "🛡️";
      case "appointment":
        return "📅";
      case "memory":
        return "🧠";
      default:
        return "💬";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "next-step":
        return "Next Step";
      case "scam-check":
        return "Safety Check";
      case "appointment":
        return "Appointment";
      case "memory":
        return "Your Task";
      default:
        return "Response";
    }
  };

  return (
    <div className="flex flex-col h-full" id="copilot-panel">
      {/* Panel header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦮</span>
          <span className="text-lg font-bold text-text-primary">SafeStep</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-200 hover:text-text-primary transition-colors text-lg"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Calendar connection */}
      <div className="panel-section bg-surface-50">
        <div className="rounded-2xl border border-surface-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Google Calendar
              </p>
              <h3 className="text-lg font-bold text-text-primary">
                {calendarStatus?.connected ? "Connected" : "Not connected"}
              </h3>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                calendarStatus?.connected
                  ? "bg-safe/10 text-safe"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {calendarLoading
                ? "Checking..."
                : calendarStatus?.connected
                  ? "Ready"
                  : "Disconnected"}
            </span>
          </div>

          <p className="text-base text-text-secondary leading-relaxed">
            {calendarStatus?.message ||
              "Connect Google Calendar so SafeStep can mention your next appointment while helping you browse."}
          </p>

          {calendarStatus?.connected && calendarStatus.nextAppointment ? (
            <div className="mt-3 rounded-xl bg-surface-50 p-3 border border-surface-200">
              <p className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-1">
                Next event
              </p>
              <p className="text-base font-medium text-text-primary">
                {calendarStatus.nextAppointment.summary}
              </p>
              <p className="text-sm text-text-secondary">
                {calendarStatus.nextAppointment.whenLabel}
                {calendarStatus.nextAppointment.timeLabel
                  ? ` at ${calendarStatus.nextAppointment.timeLabel}`
                  : ""}
                {calendarStatus.nextAppointment.location
                  ? ` · ${calendarStatus.nextAppointment.location}`
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            {calendarStatus?.connected ? (
              <button
                onClick={handleCalendarDisconnect}
                disabled={calendarLoading}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-surface-200 text-text-primary font-semibold hover:border-danger hover:text-danger transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleCalendarConnect}
                disabled={calendarLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                Connect Google Calendar
              </button>
            )}
            <button
              onClick={loadCalendarStatus}
              disabled={calendarLoading}
              className="px-4 py-3 rounded-xl border-2 border-surface-200 text-text-secondary font-semibold hover:border-primary-300 hover:text-primary-600 transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="panel-section space-y-2">
        <button
          id="btn-next-step"
          className="action-btn action-btn-primary"
          onClick={handleNextStep}
          disabled={isLoading}
        >
          <span className="text-2xl">👉</span>
          <span>What do I do next?</span>
        </button>

        <button
          id="btn-scam-check"
          className="action-btn action-btn-amber"
          onClick={handleScamCheck}
          disabled={isLoading}
        >
          <span className="text-2xl">🛡️</span>
          <span>Is this safe?</span>
        </button>

        <button
          id="btn-appointments"
          className="action-btn action-btn-indigo"
          onClick={handleAppointments}
          disabled={isLoading}
        >
          <span className="text-2xl">📅</span>
          <span>Appointments</span>
        </button>

        {/* Secondary actions */}
        <div className="flex gap-2 pt-1">
          <button
            id="btn-memory"
            className="action-btn action-btn-secondary flex-1 !text-base !py-3"
            onClick={handleMemory}
            disabled={isLoading}
          >
            <span>🧠</span>
            <span>What was I doing?</span>
          </button>
          <button
            id="btn-repeat"
            className="action-btn action-btn-secondary !text-base !py-3"
            onClick={() => {
              if (responses.length > 0) {
                /* just re-show the last response */
              }
            }}
            disabled={isLoading || responses.length === 0}
          >
            <span>🔄</span>
          </button>
        </div>
      </div>

      {/* Free-text input */}
      <div className="panel-section">
        <div className="relative">
          <input
            id="free-text-input"
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && freeText.trim()) {
                handleNextStep();
              }
            }}
            placeholder="Type a question or paste a link..."
            className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-surface-200 bg-white text-lg focus:outline-none focus:border-primary-400 transition-colors placeholder:text-text-muted"
          />
          {freeText.trim() && (
            <button
              onClick={handleNextStep}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors"
            >
              →
            </button>
          )}
        </div>
      </div>

      {/* Responses */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" id="responses-area">
        {isLoading && (
          <div className="response-card flex items-center gap-3">
            <div className="spinner" />
            <span className="text-text-secondary text-lg">
              Thinking...
            </span>
          </div>
        )}

        {responses.length === 0 && !isLoading && (
          <div className="text-center py-12 px-6">
            <div className="text-5xl mb-4">👋</div>
            <p className="text-xl text-text-secondary font-medium mb-2">
              Hello! I&apos;m here to help.
            </p>
            <p className="text-text-muted text-lg">
              Click a button above or type a question to get started.
            </p>
          </div>
        )}

        {responses.map((response, index) => (
          <div
            key={index}
            className={`response-card ${getClassificationStyles(response.classification)}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {response.classification
                  ? getClassificationIcon(response.classification)
                  : getTypeIcon(response.type)}
              </span>
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                {getTypeLabel(response.type)}
              </span>
              {response.classification && (
                <span
                  className={`ml-auto text-sm font-bold uppercase ${
                    response.classification === "safe"
                      ? "text-safe"
                      : response.classification === "risky"
                        ? "text-danger"
                        : "text-warning"
                  }`}
                >
                  {response.classification === "safe"
                    ? "Looks Safe"
                    : response.classification === "risky"
                      ? "Looks Risky"
                      : "Not Sure"}
                </span>
              )}
            </div>
            <p className="text-lg leading-relaxed text-text-primary">
              {response.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
