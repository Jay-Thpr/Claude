export interface TaskStep {
  index: number;
  instruction: string;
  voiceAnnouncement: string;
  pageSummary?: string;
  nextButton?: string;
}

export interface TaskStepRequest {
  steps: TaskStep[];
  currentStepIndex: number;
  userResponse: string;
  url: string;
  pageTitle?: string;
  pageText?: string;
}

export interface TaskStepResponse {
  done: boolean;
  nextStepIndex: number;
  announcement: string;
  instruction?: string;
  pageSummary?: string;
  nextButton?: string;
  memoryUpdate?: {
    currentTask: string;
    lastStep: string;
  };
}

const STOP_WORDS = new Set(["stop", "no", "cancel", "quit", "exit", "never mind", "nevermind"]);

function isStopResponse(userResponse: string): boolean {
  return STOP_WORDS.has(userResponse.trim().toLowerCase());
}

export async function POST(request: Request): Promise<Response> {
  let body: TaskStepRequest;
  try {
    body = (await request.json()) as TaskStepRequest;
  } catch {
    return Response.json(
      {
        done: true,
        nextStepIndex: 0,
        announcement: "Something went wrong. Let me know if you need help.",
      } satisfies TaskStepResponse,
      { status: 400 },
    );
  }

  const { steps, currentStepIndex, userResponse } = body;

  // Guard: steps must be an array
  if (!Array.isArray(steps) || steps.length === 0) {
    return Response.json({
      done: true,
      nextStepIndex: 0,
      announcement: "I don't have any steps for this task. Let me know what you need help with.",
    } satisfies TaskStepResponse);
  }

  const safeCurrentIndex = Math.max(0, Math.min(currentStepIndex, steps.length - 1));
  const currentStep = steps[safeCurrentIndex];

  // 1. Stop / No response — end the task immediately
  if (isStopResponse(userResponse)) {
    return Response.json({
      done: true,
      nextStepIndex: safeCurrentIndex,
      announcement: "Okay, I'll stop here. Let me know if you need anything.",
    } satisfies TaskStepResponse);
  }

  // 2. Task complete — no more steps
  if (safeCurrentIndex + 1 >= steps.length) {
    return Response.json({
      done: true,
      nextStepIndex: safeCurrentIndex,
      announcement: "We're all done! Great job.",
      memoryUpdate: {
        currentTask: "Completed task",
        lastStep: currentStep?.instruction ?? "Finished the last step",
      },
    } satisfies TaskStepResponse);
  }

  // 3. Advance to next step
  const nextStepIndex = safeCurrentIndex + 1;
  const nextStep = steps[nextStepIndex];

  return Response.json({
    done: false,
    nextStepIndex,
    announcement: nextStep.voiceAnnouncement,
    instruction: nextStep.instruction,
    pageSummary: nextStep.pageSummary ?? nextStep.instruction,
    nextButton: nextStep.nextButton ?? "Look for the next button or link on the page.",
    memoryUpdate: {
      currentTask: nextStep.pageSummary || nextStep.instruction || "Task in progress",
      lastStep: currentStep?.instruction ?? `Completed step ${safeCurrentIndex + 1}`,
    },
  } satisfies TaskStepResponse);
}
