"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface BrowserTaskAreaProps {
  onUrlChange: (url: string) => void;
  onPageTitleChange: (title: string) => void;
}

interface StepEvent {
  type: "step" | "status" | "done" | "paused" | "error" | "ping";
  step?: number;
  thought?: string;
  action?: string;
  message?: string;
  status?: string;
}

export default function BrowserTaskArea({
  onUrlChange,
  onPageTitleChange,
}: BrowserTaskAreaProps) {
  const [taskInput, setTaskInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "error">("idle");
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const stepsEndRef = useRef<HTMLDivElement | null>(null);
  const stepCountRef = useRef(0);

  // Auto-scroll to latest step
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const startTask = useCallback(async () => {
    if (!taskInput.trim() || status === "running") return;

    setSteps([]);
    setStatus("running");
    stepCountRef.current = 0;

    // Notify parent about the task
    onPageTitleChange(taskInput.trim());

    try {
      const res = await fetch("http://localhost:8000/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskInput.trim() }),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          msg = err.detail ?? msg;
        } catch {
          msg = await res.text().catch(() => msg);
        }
        setStatus("error");
        setSteps((prev) => [
          ...prev,
          { type: "error", message: msg },
        ]);
        return;
      }

      // Open SSE stream
      const es = new EventSource("http://localhost:8000/api/stream");
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        const event: StepEvent = JSON.parse(e.data);

        if (event.type === "ping") return;

        if (event.type === "status") {
          if (event.status) {
            setStatus(event.status as "idle" | "running" | "paused" | "error");
          }
          return;
        }

        if (event.type === "step") {
          stepCountRef.current += 1;
          event.step = stepCountRef.current;

          // Track URLs the agent visits
          if (event.action?.includes("navigate")) {
            const urlMatch = event.action.match(/navigate → (.+)/);
            if (urlMatch) {
              onUrlChange(urlMatch[1]);
            }
          }
        }

        if (
          event.type === "done" ||
          event.type === "paused" ||
          event.type === "error"
        ) {
          setStatus(
            event.type === "done" ? "idle" : (event.type as "paused" | "error")
          );
          es.close();
          eventSourceRef.current = null;
        }

        setSteps((prev) => [...prev, event]);
      };

      es.onerror = () => {
        setStatus("error");
        es.close();
        eventSourceRef.current = null;
      };
    } catch {
      setStatus("error");
      setSteps((prev) => [
        ...prev,
        { type: "error", message: "Cannot reach the browser agent. Make sure the backend is running on port 8000." },
      ]);
    }
  }, [taskInput, status, onUrlChange, onPageTitleChange]);

  const getStatusBadge = () => {
    const configs = {
      idle: { class: "status-idle", dotClass: "bg-surface-400", label: "Ready" },
      running: { class: "status-running", dotClass: "bg-blue-500", label: "Working..." },
      paused: { class: "status-paused", dotClass: "bg-warning", label: "Paused" },
      error: { class: "status-error", dotClass: "bg-danger", label: "Error" },
    };
    const c = configs[status];
    return (
      <span className={`status-badge ${c.class}`}>
        <span className={`pulse-dot ${c.dotClass}`} />
        {c.label}
      </span>
    );
  };

  const getStepIcon = (action?: string) => {
    if (!action) return "💭";
    if (action.includes("navigate")) return "🌐";
    if (action.includes("click")) return "👆";
    if (action.includes("type") || action.includes("input")) return "⌨️";
    if (action.includes("scroll")) return "📜";
    if (action.includes("done")) return "✅";
    return "⚡";
  };

  return (
    <div className="browser-area" id="browser-task-area">
      {/* Header */}
      <div className="p-6 bg-white border-b border-surface-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary">
            Browser Assistant
          </h2>
          {getStatusBadge()}
        </div>

        {/* Task input */}
        <div className="flex gap-3">
          <input
            id="task-input"
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") startTask();
            }}
            placeholder='Tell me what to do... (e.g., "Go to Google and search for my pharmacy")'
            className="flex-1 px-5 py-4 rounded-xl border-2 border-surface-200 bg-surface-50 text-lg focus:outline-none focus:border-primary-400 focus:bg-white transition-all placeholder:text-text-muted"
            disabled={status === "running"}
          />
          <button
            id="btn-run-task"
            onClick={startTask}
            disabled={status === "running" || !taskInput.trim()}
            className="px-6 py-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold text-lg hover:from-primary-400 hover:to-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:shadow-sm"
          >
            {status === "running" ? (
              <span className="flex items-center gap-2">
                <span className="spinner !border-white/30 !border-t-white" />
                Working
              </span>
            ) : (
              "Run Task"
            )}
          </button>
        </div>
      </div>

      {/* Steps log */}
      <div className="flex-1 overflow-y-auto p-4" id="steps-log">
        {steps.length === 0 && status !== "running" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-5xl mb-6 shadow-sm">
              🌐
            </div>
            <h3 className="text-2xl font-bold text-text-primary mb-3">
              Ready to help you browse
            </h3>
            <p className="text-lg text-text-secondary max-w-md leading-relaxed">
              Type what you&apos;d like to do in the box above. I&apos;ll open a
              browser and guide you through it step by step.
            </p>
            <div className="mt-8 space-y-3 text-left w-full max-w-sm">
              <p className="text-sm font-semibold text-text-muted uppercase tracking-wide">
                Try saying:
              </p>
              {[
                '"Go to my pharmacy website and look for refill options"',
                '"Search Google for my hospital portal"',
                '"Go to Medicare.gov and find my benefits"',
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => setTaskInput(example.replace(/"/g, ""))}
                  className="block w-full text-left px-4 py-3 rounded-lg bg-white border border-surface-200 text-text-secondary hover:border-primary-300 hover:bg-primary-50 transition-all text-base"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {steps.map((step, index) => (
          <div key={index} className="step-item">
            {step.type === "step" && (
              <>
                <div className="step-number">{step.step}</div>
                <div className="flex-1 min-w-0">
                  {step.thought && (
                    <p className="text-base text-text-primary font-medium mb-1">
                      {step.thought}
                    </p>
                  )}
                  {step.action && (
                    <p className="text-sm text-text-muted flex items-center gap-1.5">
                      <span>{getStepIcon(step.action)}</span>
                      {step.action}
                    </p>
                  )}
                </div>
              </>
            )}

            {step.type === "done" && (
              <div className="flex items-center gap-3 text-safe font-semibold text-lg">
                <span className="text-2xl">✅</span>
                Task completed!
              </div>
            )}

            {step.type === "paused" && (
              <div className="flex items-center gap-3 text-warning font-semibold text-lg">
                <span className="text-2xl">⏸️</span>
                {step.message || "Paused before submission — please review."}
              </div>
            )}

            {step.type === "error" && (
              <div className="flex items-center gap-3 text-danger font-semibold text-lg">
                <span className="text-2xl">❌</span>
                {step.message || "Something went wrong."}
              </div>
            )}
          </div>
        ))}

        <div ref={stepsEndRef} />
      </div>
    </div>
  );
}
