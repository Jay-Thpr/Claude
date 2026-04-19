import { cookies } from "next/headers";
import { loadCurrentAppointmentContext } from "../../../lib/appointment-context";
import { loadUserContextFromCookies } from "../../../lib/user-context";
import { DEMO_USER_ID } from "../../../lib/mock-context";
import { buildMedicareNextStepResponse, isMedicareAppointment } from "../../../lib/medicare-next-step";
import { runBrowserTask } from "../../../lib/browser-use";
import { getTaskFlow } from "../../../lib/memory-store";
import { persistCopilotMemoryUpdate } from "../../../lib/copilot-memory";

type NextStepDependencies = {
  userContext?: {
    profile: {
      userId: string;
    };
  };
  orchestrateCopilot?: (input: NextStepGuidanceInput) => Promise<{
    summary?: string;
    nextStep?: string;
    explanation?: string;
    riskLevel?: string;
    suspiciousSignals?: string[];
    mode?: string;
    memoryUpdate?: {
      currentTask?: string;
      lastStep?: string;
    };
  }>;
  runBrowserTask?: typeof runBrowserTask;
  loadCurrentAppointmentContext?: typeof loadCurrentAppointmentContext;
  persistCopilotMemoryUpdate?: typeof persistCopilotMemoryUpdate;
};

export type NextStepGuidanceInput = {
  mode: "guidance";
  query?: string;
  url?: string;
  pageTitle?: string;
  visibleText?: string;
  taskMemory?: Record<string, unknown> | null | undefined;
  appointment?: Record<string, unknown> | null | undefined;
};

function mapTaskMemory(taskMemory: unknown) {
  const memory = taskMemory as Record<string, unknown> | null | undefined;
  if (!memory) {
    return undefined;
  }

  return {
    currentTask: (memory.current_task as string | null | undefined) ?? null,
    taskType: (memory.task_type as string | null | undefined) ?? null,
    taskGoal: (memory.task_goal as string | null | undefined) ?? null,
    currentStageIndex:
      typeof memory.current_stage_index === "number" ? memory.current_stage_index : undefined,
    currentStageTitle: (memory.current_stage_title as string | null | undefined) ?? null,
    currentStageDetail: (memory.current_stage_detail as string | null | undefined) ?? null,
    nextStageTitle: (memory.next_stage_title as string | null | undefined) ?? null,
    nextStageDetail: (memory.next_stage_detail as string | null | undefined) ?? null,
    stagePlan: Array.isArray(memory.stage_plan) ? (memory.stage_plan as Array<{ title: string; detail?: string | null }>) : undefined,
    status: (memory.status as string | null | undefined) ?? null,
    lastStep: (memory.last_step as string | null | undefined) ?? null,
    currentUrl: (memory.current_url as string | null | undefined) ?? null,
    pageTitle: (memory.page_title as string | null | undefined) ?? null,
  };
}

async function loadAppointmentForNextStep(
  body: Record<string, unknown>,
  cookieStore: Awaited<ReturnType<typeof cookies>> | null,
  userId: string,
) {
  if (body.appointment && typeof body.appointment === "object") {
    return body.appointment as {
      summary?: string | null;
      description?: string | null;
      prepNotes?: string | null;
      whenLabel?: string | null;
      timeLabel?: string | null;
      location?: string | null;
      source?: string | null;
    };
  }

  return loadCurrentAppointmentContext(cookieStore ?? (await cookies()), userId);
}

async function maybeStartMedicareTask(
  appointment: { summary?: string | null; description?: string | null; prepNotes?: string | null } | null,
  deps: NextStepDependencies,
) {
  const browserTask = buildMedicareNextStepResponse(appointment).browserUseTask;
  const runTask = deps.runBrowserTask ?? runBrowserTask;
  const result = await runTask(browserTask, {
    url: "https://www.medicare.gov",
    title: appointment?.summary || "Medicare",
  });

  return {
    browserUseTask: browserTask,
    browserUse: {
      started: result.success,
      taskId: result.task_id || null,
      error: result.success ? null : result.error || "Unable to reach browser agent backend",
    },
  };
}

export async function handleNextStepRequest(
  request: Request,
  deps: NextStepDependencies = {},
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const cookieStore = deps.userContext ? null : await cookies();
    const userContext =
      deps.userContext ?? (await loadUserContextFromCookies(cookieStore!));
    const userId = userContext.profile.userId || DEMO_USER_ID;
    const currentFlowPromise = getTaskFlow(userId);
    const appointmentPromise = loadAppointmentForNextStep(body, cookieStore, userId);
    const [currentFlow, appointment] = await Promise.all([currentFlowPromise, appointmentPromise]);
    const taskMemory = mapTaskMemory(body.taskMemory);

    if (isMedicareAppointment(appointment)) {
      const browserUse = await maybeStartMedicareTask(appointment, deps).catch(() => ({
        browserUseTask: buildMedicareNextStepResponse(appointment).browserUseTask,
        browserUse: {
          started: false,
          taskId: null,
          error: "Unable to start the Medicare browser task right now.",
        },
      }));

      const response = buildMedicareNextStepResponse(appointment);
      const task_memory = await (deps.persistCopilotMemoryUpdate ?? persistCopilotMemoryUpdate)({
        userId,
        response,
        currentFlow,
        taskMemory,
        appointment,
        currentUrl: body.url as string | undefined,
        pageTitle: body.pageTitle as string | undefined,
      });

      return Response.json({
        ...response,
        ...browserUse,
        task_memory,
        message: response.summary || response.explanation || response.nextStep,
        next_step: response.nextStep,
      });
    }

    const orchestrateCopilot =
      deps.orchestrateCopilot ??
      (await import("../../../lib/orchestrator")).orchestrateCopilot;
    const response = await orchestrateCopilot({
      mode: "guidance",
      query: body.question as string | undefined,
      url: body.url as string | undefined,
      pageTitle: body.pageTitle as string | undefined,
      visibleText: (body.visibleText as string | undefined) || (body.content as string | undefined),
      taskMemory,
      appointment,
    });

    const task_memory = await (deps.persistCopilotMemoryUpdate ?? persistCopilotMemoryUpdate)({
      userId,
      response,
      currentFlow,
      taskMemory,
      appointment,
      currentUrl: body.url as string | undefined,
      pageTitle: body.pageTitle as string | undefined,
    });

    return Response.json({
      ...response,
      task_memory,
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

export async function POST(request: Request) {
  return handleNextStepRequest(request);
}
