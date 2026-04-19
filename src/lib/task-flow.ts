import type { TaskStage } from "./response-schema";

export type TaskFlowSnapshotLike = {
  currentTask: string | null;
  taskGoal: string | null;
  taskType: string | null;
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

export const DEFAULT_APPOINTMENT_STAGE_PLAN = [
  {
    title: "Check the doctor website",
    detail: "Open the hospital portal and confirm the visit details.",
  },
  {
    title: "Pack what you need",
    detail: "Put the medication list, insurance card, and notes in a bag.",
  },
  {
    title: "Leave the house",
    detail: "Grab your keys and leave 15 minutes early.",
  },
] satisfies TaskStage[];

export function normalizeStagePlan(value: unknown): TaskStage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  type RawStage = {
    title: string;
    detail: string | null;
  };

  return value
    .map((stage) => {
      if (!stage || typeof stage !== "object") {
        return null;
      }

      const title = "title" in stage ? String((stage as { title?: string }).title || "").trim() : "";
      if (!title) {
        return null;
      }

      const detail = "detail" in stage ? (stage as { detail?: string | null }).detail ?? null : null;
      return { title, detail };
    })
    .filter((stage): stage is RawStage => Boolean(stage))
    .map((stage) => ({ title: stage.title, detail: stage.detail }));
}

export function buildStageStateFromPlan(
  stagePlan: TaskStage[] | null | undefined,
  currentStageIndex: number | null | undefined,
) {
  const normalizedPlan = normalizeStagePlan(stagePlan ?? []);
  const index = typeof currentStageIndex === "number" && currentStageIndex >= 0 ? currentStageIndex : 0;
  const currentStage = normalizedPlan[index] ?? null;
  const nextStage = normalizedPlan[index + 1] ?? null;

  return {
    stagePlan: normalizedPlan,
    currentStageIndex: normalizedPlan.length ? Math.min(index, normalizedPlan.length - 1) : 0,
    currentStage,
    nextStage,
  };
}

export function buildStageMessage(flow: TaskFlowSnapshotLike | null) {
  if (!flow || !flow.stagePlan.length) {
    return "No staged flow is saved yet.";
  }

  const current = flow.currentStageTitle || flow.currentTask || "the current step";
  const next = flow.nextStageTitle ? ` Next, ${flow.nextStageTitle.toLowerCase()}.` : "";
  return `You are on stage ${Math.max((flow.currentStageIndex ?? 0) + 1, 1)} of ${flow.stagePlan.length}: ${current}.${next}`;
}
