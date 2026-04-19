import { orchestrateCopilot } from "@/lib/orchestrator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await orchestrateCopilot({
      mode: "guidance",
      query: body.question,
      url: body.url,
      pageTitle: body.pageTitle,
      visibleText: body.visibleText || body.content,
      taskMemory: body.taskMemory
        ? {
            currentTask: body.taskMemory.current_task,
            lastStep: body.taskMemory.last_step,
            currentUrl: body.taskMemory.current_url,
            pageTitle: body.taskMemory.page_title,
          }
        : undefined,
    });

    return Response.json({
      ...response,
      message: response.summary || response.explanation || response.nextStep,
      next_step: response.nextStep,
    });
  } catch (err) {
    console.error("Next-step error:", err);
    return Response.json(
      {
        summary: "I had a small problem.",
        next_step: "Please try again in a moment.",
        explanation:
          "I'm having a little trouble right now, but don't worry. Please click the button again in a moment.",
      },
      { status: 500 }
    );
  }
}
