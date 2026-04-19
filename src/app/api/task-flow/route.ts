import { DEMO_USER_ID } from "@/lib/mock-context";
import { getTaskFlow, updateTaskFlow } from "@/lib/memory-store";
import { buildStageMessage, buildStageStateFromPlan, normalizeStagePlan } from "@/lib/task-flow";
import type { TaskStage } from "@/lib/response-schema";

type TaskFlowRequest = {
  action?: "start" | "advance" | "pause" | "complete" | "reset";
  current_task?: string;
  task_goal?: string;
  task_type?: string;
  current_stage_index?: number;
  stage_plan?: TaskStage[];
  last_step?: string;
  current_url?: string;
  page_title?: string;
  status?: string;
};

export async function GET() {
  const flow = await getTaskFlow(DEMO_USER_ID);

  return Response.json({
    current_task: flow?.currentTask ?? null,
    task_goal: flow?.taskGoal ?? null,
    task_type: flow?.taskType ?? null,
    current_stage_index: flow?.currentStageIndex ?? null,
    current_stage_title: flow?.currentStageTitle ?? null,
    current_stage_detail: flow?.currentStageDetail ?? null,
    next_stage_title: flow?.nextStageTitle ?? null,
    next_stage_detail: flow?.nextStageDetail ?? null,
    stage_plan: flow?.stagePlan ?? [],
    status: flow?.status ?? null,
    last_step: flow?.lastStep ?? null,
    current_url: flow?.currentUrl ?? null,
    page_title: flow?.pageTitle ?? null,
    message: buildStageMessage(flow),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TaskFlowRequest;
    const existing = await getTaskFlow(DEMO_USER_ID);
    const stagePlan = normalizeStagePlan(body.stage_plan ?? existing?.stagePlan ?? []);
    const hasPlan = stagePlan.length > 0;
    const existingIndex = existing?.currentStageIndex ?? 0;
    const requestedIndex =
      typeof body.current_stage_index === "number" && body.current_stage_index >= 0
        ? body.current_stage_index
        : existingIndex;

    let currentStageIndex = requestedIndex;
    if (body.action === "advance") {
      currentStageIndex = hasPlan ? Math.min(existingIndex + 1, Math.max(stagePlan.length - 1, 0)) : existingIndex + 1;
    }

    if (body.action === "reset") {
      currentStageIndex = 0;
    }

    const { currentStage, nextStage, currentStageIndex: normalizedIndex } = buildStageStateFromPlan(
      stagePlan,
      currentStageIndex,
    );

    const currentTask =
      body.current_task ||
      body.task_goal ||
      existing?.currentTask ||
      currentStage?.title ||
      null;

    const status =
      body.status ||
      (body.action === "complete"
        ? "done"
        : body.action === "pause"
          ? "paused"
          : existing?.status || "active");

    const saved = await updateTaskFlow(DEMO_USER_ID, {
      current_task: currentTask,
      task_goal: body.task_goal ?? existing?.taskGoal ?? null,
      task_type: body.task_type ?? existing?.taskType ?? null,
      current_stage_index: hasPlan ? normalizedIndex : currentStageIndex,
      current_stage_title: currentStage?.title ?? null,
      current_stage_detail: currentStage?.detail ?? null,
      next_stage_title: nextStage?.title ?? null,
      next_stage_detail: nextStage?.detail ?? null,
      stage_plan: hasPlan ? stagePlan : existing?.stagePlan ?? [],
      status,
      last_step:
        body.last_step ??
        (body.action === "advance" && currentStage?.title
          ? `Finished stage: ${currentStage.title}`
          : existing?.lastStep ?? null),
      current_url: body.current_url ?? existing?.currentUrl ?? null,
      page_title: body.page_title ?? existing?.pageTitle ?? null,
    });

    return Response.json({
      success: true,
      message: buildStageMessage(saved),
      current_task: saved?.currentTask ?? null,
      task_goal: saved?.taskGoal ?? null,
      task_type: saved?.taskType ?? null,
      current_stage_index: saved?.currentStageIndex ?? null,
      current_stage_title: saved?.currentStageTitle ?? null,
      current_stage_detail: saved?.currentStageDetail ?? null,
      next_stage_title: saved?.nextStageTitle ?? null,
      next_stage_detail: saved?.nextStageDetail ?? null,
      stage_plan: saved?.stagePlan ?? [],
      status: saved?.status ?? null,
      last_step: saved?.lastStep ?? null,
      current_url: saved?.currentUrl ?? null,
      page_title: saved?.pageTitle ?? null,
      ...saved,
    });
  } catch (error) {
    console.error("Task flow error:", error);
    return Response.json(
      {
        success: false,
        message: "I could not save the stage right now.",
      },
      { status: 500 },
    );
  }
}
