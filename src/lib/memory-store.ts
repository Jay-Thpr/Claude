import { createServerSupabaseClient } from "./supabase-server";
import { logger } from "./logger";
import { normalizeStagePlan } from "./task-flow";
import type { TaskStage } from "./response-schema";

export interface TaskMemory {
  user_id: string;
  current_task: string | null;
  task_type: string | null;
  task_goal: string | null;
  current_stage_index: number | null;
  current_stage_title: string | null;
  current_stage_detail: string | null;
  next_stage_title: string | null;
  next_stage_detail: string | null;
  stage_plan: TaskStage[] | null;
  status: string | null;
  last_step: string | null;
  current_url: string | null;
  page_title: string | null;
  updated_at: string;
}

export type TaskMemoryPatch = Partial<
  Pick<
    TaskMemory,
    | "current_task"
    | "task_type"
    | "task_goal"
    | "current_stage_index"
    | "current_stage_title"
    | "current_stage_detail"
    | "next_stage_title"
    | "next_stage_detail"
    | "stage_plan"
    | "status"
    | "last_step"
    | "current_url"
    | "page_title"
  >
>;

export type TaskFlowSnapshot = {
  currentTask: string | null;
  taskType: string | null;
  taskGoal: string | null;
  currentStageIndex: number | null;
  currentStageTitle: string | null;
  currentStageDetail: string | null;
  nextStageTitle: string | null;
  nextStageDetail: string | null;
  stagePlan: TaskStage[];
  status: string | null;
  lastStep: string | null;
  currentUrl: string | null;
  pageTitle: string | null;
};

export function serializeTaskFlowSnapshot(memory: TaskMemory | null): TaskFlowSnapshot | null {
  if (!memory) {
    return null;
  }

  return {
    currentTask: memory.current_task ?? null,
    taskType: memory.task_type ?? null,
    taskGoal: memory.task_goal ?? null,
    currentStageIndex: memory.current_stage_index ?? null,
    currentStageTitle: memory.current_stage_title ?? null,
    currentStageDetail: memory.current_stage_detail ?? null,
    nextStageTitle: memory.next_stage_title ?? null,
    nextStageDetail: memory.next_stage_detail ?? null,
    stagePlan: normalizeStagePlan(memory.stage_plan ?? []),
    status: memory.status ?? null,
    lastStep: memory.last_step ?? null,
    currentUrl: memory.current_url ?? null,
    pageTitle: memory.page_title ?? null,
  };
}

export function buildTaskFlowMessage(flow: TaskFlowSnapshot | null) {
  if (!flow || !flow.stagePlan.length) {
    return "No staged flow is saved yet.";
  }

  const current = flow.currentStageTitle || flow.currentTask || "the current step";
  const next = flow.nextStageTitle ? ` Next, ${flow.nextStageTitle.toLowerCase()}.` : "";
  return `You are on stage ${Math.max((flow.currentStageIndex ?? 0) + 1, 1)} of ${flow.stagePlan.length}: ${current}.${next}`;
}

function toSnapshot(memory: TaskMemory | null): TaskFlowSnapshot {
  return serializeTaskFlowSnapshot(memory) || {
    currentTask: null,
    taskType: null,
    taskGoal: null,
    currentStageIndex: null,
    currentStageTitle: null,
    currentStageDetail: null,
    nextStageTitle: null,
    nextStageDetail: null,
    stagePlan: [],
    status: null,
    lastStep: null,
    currentUrl: null,
    pageTitle: null,
  };
}

export async function getTaskMemory(userId: string): Promise<TaskMemory | null> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("task_memory")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("memory-store", "getTaskMemory failed", error);
      return null;
    }

    return data ?? null;
  } catch (err) {
    logger.error("memory-store", "getTaskMemory threw", err);
    return null;
  }
}

export async function getTaskFlow(userId: string): Promise<TaskFlowSnapshot | null> {
  const memory = await getTaskMemory(userId);
  return memory ? toSnapshot(memory) : null;
}

export async function updateTaskMemory(
  userId: string,
  patch: TaskMemoryPatch
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase.from("task_memory").upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      logger.error("memory-store", "updateTaskMemory failed", error);
    }
  } catch (err) {
    logger.error("memory-store", "updateTaskMemory threw", err);
  }
}

export async function updateTaskFlow(
  userId: string,
  patch: TaskMemoryPatch,
): Promise<TaskFlowSnapshot | null> {
  await updateTaskMemory(userId, patch);
  return getTaskFlow(userId);
}

export function buildStageStateFromPlan(
  stagePlan: TaskStage[] | null | undefined,
  currentStageIndex: number | null | undefined,
) {
  const normalizedPlan = normalizeStagePlan(stagePlan ?? []);
  const index = typeof currentStageIndex === "number" && currentStageIndex >= 0
    ? currentStageIndex
    : 0;
  const currentStage = normalizedPlan[index] ?? null;
  const nextStage = normalizedPlan[index + 1] ?? null;

  return {
    stagePlan: normalizedPlan,
    currentStageIndex: normalizedPlan.length ? Math.min(index, normalizedPlan.length - 1) : 0,
    currentStage,
    nextStage,
  };
}
