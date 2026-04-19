import { runBrowserTask } from "@/lib/browser-use";

type BrowserUseTestBody = {
  task?: string;
  url?: string;
  title?: string;
};

async function runBrowserUseTest(task: string, url?: string, title?: string) {
  return runBrowserTask(task, {
    url,
    title,
  }, { headless: true });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const task =
    searchParams.get("task") ??
    "Go to google.com and tell me the page title";
  const url = searchParams.get("url") ?? "https://google.com";
  const title = searchParams.get("title") ?? "Test";

  const result = await runBrowserUseTest(task, url, title);

  if (!result.success) {
    return Response.json({
      status: "error",
      message: "Could not reach browser agent backend. Make sure the Python backend is running on port 8000.",
      error: result.error,
    }, { status: 503 });
  }

  return Response.json({
    status: "ok",
    message: "Browser Use backend is reachable and accepted the task.",
    task_id: result.task_id,
  });
}

export async function POST(request: Request) {
  let body: BrowserUseTestBody = {};

  try {
    body = (await request.json()) as BrowserUseTestBody;
  } catch {
    body = {};
  }

  const task = body.task?.trim() || "Go to google.com and tell me the page title";
  const url = body.url?.trim() || "https://google.com";
  const title = body.title?.trim() || "Test";

  const result = await runBrowserUseTest(task, url, title);

  if (!result.success) {
    return Response.json(
      {
        status: "error",
        message: "Could not reach browser agent backend. Make sure the Python backend is running on port 8000.",
        error: result.error,
      },
      { status: 503 },
    );
  }

  return Response.json({
    status: "ok",
    message: "Browser Use backend is reachable and accepted the task.",
    task_id: result.task_id,
    task,
    url,
    title,
  });
}
