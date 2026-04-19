"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import EmbeddedBrowserFrame from "@/components/EmbeddedBrowserFrame";
import { getBrowserStreamUrl, runBrowserTask } from "@/lib/browser-use";

interface BrowserTaskAreaProps {
  currentUrl: string;
  currentPageTitle: string;
  onUrlChange: (url: string) => void;
  onPageTitleChange: (title: string) => void;
  onStatusChange?: (status: BrowserTaskStatus) => void;
  onOpenAssistant?: () => void;
}

export type BrowserTaskStatus = "idle" | "running" | "paused" | "error";

export interface BrowserTaskAreaHandle {
  runTask: (goal: string) => void;
}

interface StepEvent {
  type: "step" | "status" | "done" | "paused" | "error" | "ping";
  step?: number;
  thought?: string;
  action?: string;
  message?: string;
  status?: string;
  current_url?: string | null;
  current_page_title?: string | null;
  screenshot_b64?: string | null;
}

function normalizeBrowserUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/[),.;]+$/, "");
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : "";
  } catch {
    if (/^www\./i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return "";
  }
}

function extractNavigationUrl(action?: string) {
  if (!action) {
    return "";
  }

  const patterns = [
    /navigate\s*→\s*([^\s]+(?:\/[^\s]*)?)/i,
    /navigate(?:\s+to)?\s+([^\s]+(?:\/[^\s]*)?)/i,
    /(https?:\/\/[^\s]+)/i,
    /(www\.[^\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = action.match(pattern);
    const normalized = match ? normalizeBrowserUrl(match[1]) : "";
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function derivePageTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "") || url;
  } catch {
    return url;
  }
}

function extractInitialNavigationUrl(goal: string) {
  const patterns = [
    /(https?:\/\/[^\s]+)/i,
    /(www\.[^\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = goal.match(pattern);
    if (!match) {
      continue;
    }

    const normalized = normalizeBrowserUrl(match[1]);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

const BrowserTaskArea = forwardRef<BrowserTaskAreaHandle, BrowserTaskAreaProps>(
  function BrowserTaskArea(
    {
      currentUrl,
      currentPageTitle,
      onUrlChange,
      onPageTitleChange,
      onStatusChange,
      onOpenAssistant,
    }: BrowserTaskAreaProps,
    ref,
  ) {
    const [status, setStatus] = useState<BrowserTaskStatus>("idle");
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [, setSteps] = useState<StepEvent[]>([]);
    const eventSourceRef = useRef<EventSource | null>(null);
    const stepCountRef = useRef(0);

    useEffect(() => {
      onStatusChange?.(status);
    }, [onStatusChange, status]);

    useEffect(() => {
      return () => {
        eventSourceRef.current?.close();
      };
    }, []);

    const runTask = useCallback(
      async (goal: string) => {
        const trimmedGoal = goal.trim();
        if (!trimmedGoal || status === "running") {
          return;
        }

        const startingUrl =
          extractInitialNavigationUrl(trimmedGoal) ||
          currentUrl ||
          "https://www.google.com";

        eventSourceRef.current?.close();
        eventSourceRef.current = null;

        setSteps([]);
        setScreenshot(null);
        setStatus("running");
        stepCountRef.current = 0;
        onUrlChange(startingUrl);
        onPageTitleChange(derivePageTitleFromUrl(startingUrl));

        const startResult = await runBrowserTask(trimmedGoal, {
          url: startingUrl,
          title: currentPageTitle || derivePageTitleFromUrl(startingUrl),
        });

        if (!startResult.success) {
          setStatus("error");
          setSteps([{ type: "error", message: startResult.error || "Unable to start browser trace." }]);
          return;
        }

        try {
          const es = new EventSource(getBrowserStreamUrl());
          eventSourceRef.current = es;

          es.onmessage = (event) => {
            const payload: StepEvent = JSON.parse(event.data);

            if (payload.type === "ping") {
              return;
            }

            if (payload.type === "status") {
              if (payload.status) {
                setStatus(payload.status as BrowserTaskStatus);
              }
              return;
            }

            if (payload.type === "step") {
              stepCountRef.current += 1;
              payload.step = stepCountRef.current;

              if (payload.current_url) {
                onUrlChange(payload.current_url);
              }

              if (payload.current_page_title) {
                onPageTitleChange(payload.current_page_title);
              }

              if (payload.screenshot_b64) {
                setScreenshot(payload.screenshot_b64);
              }

              const nextUrl = extractNavigationUrl(payload.action);
              if (nextUrl) {
                onUrlChange(nextUrl);
                onPageTitleChange(derivePageTitleFromUrl(nextUrl));
              }
            }

            if (payload.type === "done" || payload.type === "paused" || payload.type === "error") {
              setStatus(payload.type === "done" ? "idle" : (payload.type as BrowserTaskStatus));
              es.close();
              eventSourceRef.current = null;
            }

            setSteps((previous) => [...previous, payload]);
          };

          es.onerror = () => {
            setStatus("error");
            es.close();
            eventSourceRef.current = null;
          };
        } catch {
          setStatus("error");
          setSteps((previous) => [
            ...previous,
            { type: "error", message: "Cannot reach the browser agent stream on port 8000." },
          ]);
        }
      },
      [currentPageTitle, currentUrl, onPageTitleChange, onUrlChange, status],
    );

    useImperativeHandle(
      ref,
      () => ({
        runTask(goal: string) {
          void runTask(goal);
        },
      }),
      [runTask],
    );

    return (
      <div className="browser-area" id="browser-task-area">
        <EmbeddedBrowserFrame
          currentUrl={currentUrl}
          pageTitle={currentPageTitle}
          screenshotB64={screenshot}
          status={status}
          onOpenAssistant={onOpenAssistant}
        />
      </div>
    );
  },
);

export default BrowserTaskArea;
