"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface CopilotPanelProps {
  currentUrl: string;
  currentPageTitle: string;
  onClose: () => void;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tone?: "neutral" | "safe" | "warning" | "danger";
  timestamp: Date;
};

type CalendarStatus = {
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
};

type TaskMemoryPayload = {
  current_task: string | null;
  task_type?: string | null;
  task_goal?: string | null;
  current_stage_index?: number | null;
  current_stage_title?: string | null;
  current_stage_detail?: string | null;
  next_stage_title?: string | null;
  next_stage_detail?: string | null;
  stage_plan?: Array<{ title: string; detail?: string | null }> | null;
  status?: string | null;
  last_step: string | null;
  current_url?: string | null;
  page_title?: string | null;
};

function buildAssistantTone(value?: string): ChatMessage["tone"] {
  if (!value) {
    return "neutral";
  }

  if (/safe|ready|ok/i.test(value)) {
    return "safe";
  }

  if (/warning|careful|not sure/i.test(value)) {
    return "warning";
  }

  if (/risky|danger|stop/i.test(value)) {
    return "danger";
  }

  return "neutral";
}

export default function CopilotPanel({
  currentUrl,
  currentPageTitle,
  onClose,
}: CopilotPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Hi, I am SafeStep. Ask me anything, and I will keep the reply calm and simple.",
      tone: "neutral",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [taskMemory, setTaskMemory] = useState<TaskMemoryPayload | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const appendMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      setMessages((prev) => [
        ...prev,
        {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
      ]);
    },
    [],
  );

  const loadCalendarStatus = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/gcal/status");
      const data = (await res.json()) as CalendarStatus;
      setCalendarStatus(data);
    } catch {
      setCalendarStatus({
        connected: false,
        message: "I could not check Google Calendar right now.",
      });
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  const loadTaskMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory");
      const data = (await res.json()) as TaskMemoryPayload;
      setTaskMemory(data);
      return data;
    } catch {
      setTaskMemory(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCalendarStatus();
      void loadTaskMemory();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCalendarStatus, loadTaskMemory]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

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
        message: "I could not disconnect Google Calendar right now.",
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  const sendUserMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    appendMessage({ role: "user", content: trimmed });
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          url: currentUrl,
          pageTitle: currentPageTitle,
        }),
      });
      const data = await res.json();
      appendMessage({
        role: "assistant",
        content:
          data.message ||
          data.explanation ||
          data.nextStep ||
          "I am here to help.",
        tone: buildAssistantTone(data.riskLevel),
      });
    } catch {
      appendMessage({
        role: "assistant",
        content: "I am having trouble connecting right now. Please try again in a moment.",
        tone: "warning",
      });
    } finally {
      setIsLoading(false);
      setFreeText("");
    }
  };

  const sendButtonPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }

    appendMessage({ role: "user", content: trimmed });
    setIsLoading(true);

    try {
      const res = await fetch("/api/next-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          pageTitle: currentPageTitle,
          question: trimmed,
          taskMemory: taskMemory || undefined,
        }),
      });
      const data = await res.json();
      appendMessage({
        role: "assistant",
        content: data.message || data.explanation || data.next_step || "I am ready to help.",
        tone: buildAssistantTone(data.riskLevel),
      });
    } catch {
      appendMessage({
        role: "assistant",
        content: "I am having trouble connecting right now. Please try again in a moment.",
        tone: "warning",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScamCheck = async () => {
    const prompt = freeText.trim() || "Is this safe?";
    appendMessage({ role: "user", content: prompt });
    setIsLoading(true);

    try {
      const res = await fetch("/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          pageTitle: currentPageTitle,
          content: prompt,
        }),
      });
      const data = await res.json();
      appendMessage({
        role: "assistant",
        content: data.explanation || "Let me check that for you.",
        tone: buildAssistantTone(data.classification),
      });
    } catch {
      appendMessage({
        role: "assistant",
        content:
          "I could not check this right now. If you are unsure about a website, it is safer to wait.",
        tone: "warning",
      });
    } finally {
      setIsLoading(false);
      setFreeText("");
    }
  };

  const handleAppointments = async () => {
    appendMessage({ role: "user", content: "Show me my appointments." });
    setIsLoading(true);

    try {
      const res = await fetch("/api/appointments");
      const data = await res.json();
      appendMessage({
        role: "assistant",
        content: data.message || "No upcoming appointments found.",
        tone: "neutral",
      });
    } catch {
      appendMessage({
        role: "assistant",
        content: "I could not check your appointments right now. Please try again.",
        tone: "warning",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMemory = async () => {
    appendMessage({ role: "user", content: "What was I doing?" });
    setIsLoading(true);

    try {
      const data = taskMemory || (await loadTaskMemory());
      const memoryParts = [
        data?.current_task ? `You were working on: ${data.current_task}.` : null,
        data?.current_stage_title ? `Current stage: ${data.current_stage_title}.` : null,
        data?.next_stage_title ? `Next stage: ${data.next_stage_title}.` : null,
        `Your last step was: ${data?.last_step || "just getting started"}.`,
      ].filter(Boolean);
      appendMessage({
        role: "assistant",
        content: memoryParts.length
          ? memoryParts.join(" ")
          : "I do not have any saved tasks yet. Start browsing and I will keep track for you.",
        tone: "neutral",
      });
    } catch {
      appendMessage({
        role: "assistant",
        content: "I could not check your saved tasks right now.",
        tone: "warning",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBubbleClass = (message: ChatMessage) => {
    if (message.role === "user") {
      return "ml-8 border border-primary-200 bg-primary-50 text-text-primary";
    }

    switch (message.tone) {
      case "safe":
        return "mr-8 border border-safe/20 bg-safe-bg text-text-primary";
      case "warning":
        return "mr-8 border border-warning/20 bg-warning-bg text-text-primary";
      case "danger":
        return "mr-8 border border-danger/20 bg-danger-bg text-text-primary";
      default:
        return "mr-8 border border-surface-200 bg-white text-text-primary";
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" id="copilot-panel">
      <div className="panel-header">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-xl text-white">
            💬
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              SafeStep Chat
            </p>
            <span className="text-lg font-bold text-text-primary">Ask in plain language</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding/basic-info"
            className="rounded-full border border-surface-200 bg-surface-50 px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            Edit basics
          </Link>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-200 hover:text-text-primary"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="panel-section bg-surface-50">
          <div className="rounded-2xl border border-surface-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Google Calendar
                </p>
                <h3 className="text-lg font-bold text-text-primary">
                  {calendarStatus?.connected ? "Connected" : "Not connected"}
                </h3>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
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

            <p className="text-base leading-relaxed text-text-secondary">
              {calendarStatus?.message ||
                "Connect Google Calendar so SafeStep can mention your next appointment while helping you browse."}
            </p>

            {calendarStatus?.connected && calendarStatus.nextAppointment ? (
              <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-3">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
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
                  className="flex-1 rounded-xl border-2 border-surface-200 px-4 py-3 font-semibold text-text-primary transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleCalendarConnect}
                  disabled={calendarLoading}
                  className="flex-1 rounded-xl bg-primary-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  Connect Google Calendar
                </button>
              )}
              <button
                onClick={loadCalendarStatus}
                disabled={calendarLoading}
                className="rounded-xl border-2 border-surface-200 px-4 py-3 font-semibold text-text-secondary transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="panel-section space-y-2">
          <button className="action-btn action-btn-primary" onClick={() => sendButtonPrompt("What do I do next?")} disabled={isLoading}>
            <span className="text-2xl">👉</span>
            <span>What do I do next?</span>
          </button>

          <button className="action-btn action-btn-amber" onClick={handleScamCheck} disabled={isLoading}>
            <span className="text-2xl">🛡️</span>
            <span>Is this safe?</span>
          </button>

          <button className="action-btn action-btn-indigo" onClick={handleAppointments} disabled={isLoading}>
            <span className="text-2xl">📅</span>
            <span>Appointments</span>
          </button>

          <div className="flex gap-2 pt-1">
            <button
              className="action-btn action-btn-secondary !py-3 !text-base flex-1"
              onClick={handleMemory}
              disabled={isLoading}
            >
              <span>🧠</span>
              <span>What was I doing?</span>
            </button>
            <button
              className="action-btn action-btn-secondary !py-3 !text-base"
              onClick={() => {
                const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
                if (lastAssistant) {
                  appendMessage({ role: "user", content: "Say that again." });
                  appendMessage({
                    role: "assistant",
                    content: lastAssistant.content,
                    tone: lastAssistant.tone,
                  });
                }
              }}
              disabled={isLoading || messages.length === 0}
            >
              <span>🔄</span>
            </button>
          </div>
        </div>

        <div className="space-y-3 px-3 pb-3" id="responses-area">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`response-card ${getBubbleClass(message)} max-w-[calc(100%-2rem)]`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                <span>{message.role === "user" ? "You" : "SafeStep"}</span>
                <span>•</span>
                <span>{message.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <p className="text-lg leading-relaxed text-text-primary whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          ))}

          {isLoading ? (
            <div className="response-card flex items-center gap-3">
              <div className="spinner" />
              <span className="text-lg text-text-secondary">Thinking...</span>
            </div>
          ) : null}

          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="panel-section">
        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            void sendUserMessage(freeText || "");
          }}
        >
          <input
            id="free-text-input"
            type="text"
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            placeholder="Ask a question, like 'remind me about my appointment'"
            className="w-full rounded-xl border-2 border-surface-200 bg-white px-4 py-3 pr-12 text-lg transition-colors placeholder:text-text-muted focus:border-primary-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading || !freeText.trim()}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
}
