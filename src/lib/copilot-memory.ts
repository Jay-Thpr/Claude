import type { AppointmentContext, CopilotResponse, TaskMemoryState } from "./response-schema";
import { getTaskFlow, updateTaskMemory, type TaskFlowSnapshot } from "./memory-store";

type PersistCopilotMemoryUpdateInput = {
  userId: string;
  response: Pick<CopilotResponse, "memoryUpdate">;
  currentFlow?: TaskFlowSnapshot | null;
  taskMemory?: TaskMemoryState | null;
  appointment?: AppointmentContext | null;
  currentUrl?: string | null;
  pageTitle?: string | null;
};

export async function persistCopilotMemoryUpdate({
  userId,
  response,
  currentFlow,
  taskMemory,
  appointment,
  currentUrl,
  pageTitle,
}: PersistCopilotMemoryUpdateInput): Promise<TaskFlowSnapshot | null> {
  if (!response.memoryUpdate) {
    return currentFlow || null;
  }

  const flow = currentFlow || (await getTaskFlow(userId));
  const nextFlow = {
    current_task: response.memoryUpdate.currentTask || flow?.currentTask || taskMemory?.currentTask || appointment?.summary || "Browsing with SafeStep",
    task_type: flow?.taskType ?? taskMemory?.taskType ?? null,
    task_goal: flow?.taskGoal ?? taskMemory?.taskGoal ?? appointment?.summary ?? null,
    current_stage_index: flow?.currentStageIndex ?? taskMemory?.currentStageIndex ?? null,
    current_stage_title: flow?.currentStageTitle ?? taskMemory?.currentStageTitle ?? null,
    current_stage_detail: flow?.currentStageDetail ?? taskMemory?.currentStageDetail ?? null,
    next_stage_title: flow?.nextStageTitle ?? taskMemory?.nextStageTitle ?? null,
    next_stage_detail: flow?.nextStageDetail ?? taskMemory?.nextStageDetail ?? null,
    stage_plan: flow?.stagePlan ?? taskMemory?.stagePlan ?? [],
    status: flow?.status ?? taskMemory?.status ?? "active",
    last_step: response.memoryUpdate.lastStep || flow?.lastStep || taskMemory?.lastStep || "Reviewed the current page and asked SafeStep for help.",
    current_url: currentUrl ?? flow?.currentUrl ?? taskMemory?.currentUrl ?? null,
    page_title: pageTitle ?? flow?.pageTitle ?? taskMemory?.pageTitle ?? null,
  };

  await updateTaskMemory(userId, nextFlow);
  return getTaskFlow(userId);
}
