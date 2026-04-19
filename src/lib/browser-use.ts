import { logger } from "./logger";

export interface PageContext {
  url?: string;
  title?: string;
  question?: string;
}

export interface BrowserTaskResult {
  success: boolean;
  task_id?: string;
  error?: string;
}

type BrowserTaskStartResponse = {
  task_id?: string;
  detail?: string;
};

type BrowserTaskErrorResponse = {
  detail?: string;
  error?: string;
};

type BrowserExtractResponse = {
  result?: string;
};

const BACKEND_URL = process.env.BROWSER_USE_BACKEND_URL ?? "http://localhost:8000";

export async function runBrowserTask(
  goal: string,
  context?: PageContext,
  options?: { headless?: boolean }
): Promise<BrowserTaskResult> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: goal,
        url: context?.url,
        page_title: context?.title,
        headless: options?.headless ?? true,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = (await res.json()) as BrowserTaskErrorResponse;
        detail = err.detail ?? err.error ?? detail;
      } catch {
        detail = (await res.text().catch(() => detail));
      }
      logger.error("browser-use", "runBrowserTask rejected", detail);
      return { success: false, error: detail };
    }

    const data = (await res.json()) as BrowserTaskStartResponse;
    return { success: true, task_id: data.task_id };
  } catch (err) {
    logger.error("browser-use", "runBrowserTask threw", err);
    return { success: false, error: "Cannot reach browser agent backend" };
  }
}

export function getBrowserStreamUrl(): string {
  return `${BACKEND_URL}/api/stream`;
}

export async function extractFromPage(task: string): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!res.ok) {
      logger.error("browser-use", "extractFromPage rejected", res.status);
      return null;
    }

    const data = (await res.json()) as BrowserExtractResponse;
    return data.result ?? null;
  } catch (err) {
    logger.error("browser-use", "extractFromPage threw", err);
    return null;
  }
}
