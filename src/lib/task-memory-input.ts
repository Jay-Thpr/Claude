import type { TaskMemoryState } from "./response-schema";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeTaskMemoryInput(taskMemory: unknown): TaskMemoryState | null {
  if (!taskMemory || typeof taskMemory !== "object") {
    return null;
  }

  const memory = taskMemory as Record<string, unknown>;

  return {
    currentTask: asString(memory.currentTask ?? memory.current_task),
    taskType: asString(memory.taskType ?? memory.task_type),
    taskGoal: asString(memory.taskGoal ?? memory.task_goal),
    currentStageIndex: asNumber(memory.currentStageIndex ?? memory.current_stage_index),
    currentStageTitle: asString(memory.currentStageTitle ?? memory.current_stage_title),
    currentStageDetail: asString(memory.currentStageDetail ?? memory.current_stage_detail),
    nextStageTitle: asString(memory.nextStageTitle ?? memory.next_stage_title),
    nextStageDetail: asString(memory.nextStageDetail ?? memory.next_stage_detail),
    stagePlan: Array.isArray(memory.stagePlan ?? memory.stage_plan)
      ? ((memory.stagePlan ?? memory.stage_plan) as TaskMemoryState["stagePlan"])
      : null,
    status: asString(memory.status),
    lastStep: asString(memory.lastStep ?? memory.last_step),
    currentUrl: asString(memory.currentUrl ?? memory.current_url),
    pageTitle: asString(memory.pageTitle ?? memory.page_title),
  };
}
