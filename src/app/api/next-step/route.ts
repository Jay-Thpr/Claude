import { orchestrateCopilot } from "@/lib/orchestrator";
import { updateTaskMemory } from "@/lib/memory-store";

const DEMO_USER_ID = "demo-user-001";

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
            taskType: body.taskMemory.task_type,
            taskGoal: body.taskMemory.task_goal,
            currentStageIndex: body.taskMemory.current_stage_index,
            currentStageTitle: body.taskMemory.current_stage_title,
            currentStageDetail: body.taskMemory.current_stage_detail,
            nextStageTitle: body.taskMemory.next_stage_title,
            nextStageDetail: body.taskMemory.next_stage_detail,
            stagePlan: body.taskMemory.stage_plan,
            status: body.taskMemory.status,
            lastStep: body.taskMemory.last_step,
            currentUrl: body.taskMemory.current_url,
            pageTitle: body.taskMemory.page_title,
          }
        : undefined,
    });

    if (response.memoryUpdate) {
      updateTaskMemory(DEMO_USER_ID, {
        current_task: response.memoryUpdate.currentTask,
        last_step: response.memoryUpdate.lastStep,
        current_url: body.url,
        page_title: body.pageTitle,
      });
    }

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
