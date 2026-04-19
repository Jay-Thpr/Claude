import { runBrowserTask } from "@/lib/browser-use";

export async function GET() {
  const result = await runBrowserTask("Go to google.com and tell me the page title", {
    url: "https://google.com",
    title: "Test",
  });

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
