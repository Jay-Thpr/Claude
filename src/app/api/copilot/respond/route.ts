import { cookies } from "next/headers";
import type { CopilotRequest, CopilotResponse } from "../../../../lib/response-schema";
import { getTaskFlow } from "../../../../lib/memory-store";
import { persistCopilotMemoryUpdate } from "../../../../lib/copilot-memory";
import { loadUserContextFromCookies } from "../../../../lib/user-context";
import { normalizeTaskMemoryInput } from "../../../../lib/task-memory-input";

type CopilotRespondDependencies = {
  orchestrateCopilot?: (input: CopilotRequest) => Promise<CopilotResponse>;
  persistCopilotMemoryUpdate?: typeof persistCopilotMemoryUpdate;
  userContext?: {
    profile: {
      userId: string;
    };
  };
};

export async function POST(request: Request) {
  return handleCopilotRespondRequest(request);
}

export async function handleCopilotRespondRequest(
  request: Request,
  deps: CopilotRespondDependencies = {},
) {
  try {
    const body = (await request.json()) as CopilotRequest;
    const requestBody = {
      ...body,
      taskMemory: normalizeTaskMemoryInput(body.taskMemory),
    };
    const cookieStore = deps.userContext || body.userId ? null : await cookies();
    const userContext =
      deps.userContext ?? (body.userId ? null : await loadUserContextFromCookies(cookieStore!));
    const userId = body.userId || userContext?.profile.userId;
    const orchestrateCopilot =
      deps.orchestrateCopilot ?? (await import("../../../../lib/orchestrator")).orchestrateCopilot;
    const response = await orchestrateCopilot(requestBody);

    if (userId && response.memoryUpdate) {
      const persistMemoryUpdate = deps.persistCopilotMemoryUpdate ?? persistCopilotMemoryUpdate;
      const currentFlow = await getTaskFlow(userId);
      const taskMemory = await persistMemoryUpdate({
        userId,
        response,
        currentFlow,
        taskMemory: requestBody.taskMemory,
        appointment: body.appointment || null,
        currentUrl: body.url,
        pageTitle: body.pageTitle,
      });

      return Response.json({
        ...response,
        task_memory: taskMemory,
      });
    }

    return Response.json(response);
  } catch (error) {
    console.error("Copilot respond error:", error);
    return Response.json(
      {
        mode: "guidance",
        summary: "I had a small problem.",
        nextStep: "Please try again in a moment.",
        explanation:
          "I'm having trouble reading the page right now. Try again in a moment, or ask me to check the safe next step.",
        riskLevel: "uncertain",
        suspiciousSignals: [],
      },
      { status: 500 },
    );
  }
}
