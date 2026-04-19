import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "../../../lib/appointment-utils";
import { buildAppointmentReminder } from "../../../lib/appointment-reminders";
import { generateGeneralChatReply } from "../../../lib/general-chat";
import { routeIntent, shouldUseBrowserUse } from "../../../lib/intent-router";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadUserContextFromCookies } from "../../../lib/user-context";
import { persistPreferenceSignals } from "../../../lib/preference-store";
import { getTaskFlow } from "../../../lib/memory-store";
import { persistCopilotMemoryUpdate } from "../../../lib/copilot-memory";
import { normalizeTaskMemoryInput } from "../../../lib/task-memory-input";
import type { CopilotRequest, CopilotResponse, UserContextEntry, UserProfileContext, AppointmentContext } from "../../../lib/response-schema";

type ChatRequest = {
  message?: string;
  url?: string;
  pageTitle?: string;
  visibleText?: string;
  pageSummary?: string;
  taskMemory?: unknown;
  appointment?: {
    connected?: boolean;
    summary?: string | null;
    whenLabel?: string | null;
    timeLabel?: string | null;
    location?: string | null;
    description?: string | null;
    prepNotes?: string | null;
    source?: string | null;
  } | null;
};

type ChatDependencies = {
  generateGeneralChatReply?: typeof generateGeneralChatReply;
  orchestrateCopilot?: (input: CopilotRequest) => Promise<CopilotResponse>;
  persistPreferenceSignals?: typeof persistPreferenceSignals;
  persistCopilotMemoryUpdate?: typeof persistCopilotMemoryUpdate;
  userContext?: {
    profile: UserProfileContext;
    entries: UserContextEntry[];
  };
  appointment?: AppointmentContext | null;
};

function buildChatMessage(
  summary?: string,
  nextStep?: string,
  explanation?: string,
  reminderMessage?: string,
  savedPreferences?: string[],
) {
  const parts = [summary, nextStep, explanation, reminderMessage];
  if (savedPreferences?.length) {
    parts.push(`I saved: ${savedPreferences.join(", ")}.`);
  }

  return parts.filter(Boolean).join(" ");
}

export async function POST(request: Request) {
  return handleChatRequest(request);
}

export async function handleChatRequest(
  request: Request,
  deps: ChatDependencies = {},
) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    const normalizedTaskMemory = normalizeTaskMemoryInput(body.taskMemory);
    const routingInput: CopilotRequest = {
      mode: "auto",
      query: message,
      url: body.url,
      pageTitle: body.pageTitle,
      visibleText: body.visibleText,
      pageSummary: body.pageSummary,
    };
    const intent = routeIntent(routingInput);
    const shouldOrchestrate =
      intent === "scam_check" || shouldUseBrowserUse(routingInput, intent);

    const cookieStore = deps.userContext ? null : await cookies();
    const userContext =
      deps.userContext ?? (await loadUserContextFromCookies(cookieStore!));
    const userId = userContext.profile.userId;

    const supabase = createServerSupabaseClient();
    let appointment = deps.appointment ?? body.appointment ?? null;
    const currentFlowPromise = getTaskFlow(userId);
    const appointmentPromise =
      !appointment && supabase
        ? supabase
            .from("appointments")
            .select("*")
            .eq("user_id", userId)
            .gte("start_time", new Date().toISOString())
            .order("start_time", { ascending: true })
            .limit(1)
            .single()
        : Promise.resolve({ data: null as unknown } as { data: unknown });

    const [{ data }, currentFlow] = await Promise.all([appointmentPromise, currentFlowPromise]);

    if (!appointment && data) {
      appointment = buildAppointmentContextFromRow(data as Record<string, unknown>, { source: "supabase" });
    }

    if (!shouldOrchestrate) {
      const generateReply =
        deps.generateGeneralChatReply ?? generateGeneralChatReply;
      const reply = await generateReply({
        query: message,
        url: body.url,
        pageTitle: body.pageTitle,
        visibleText: body.visibleText,
        pageSummary: body.pageSummary,
        taskMemory: normalizedTaskMemory,
        appointment,
        userProfile: userContext.profile,
        userContextEntries: userContext.entries,
      });

      const savedPreferences = await (deps.persistPreferenceSignals ?? persistPreferenceSignals)(
        userId,
        message,
        userContext.profile,
      );

      return Response.json({
        mode: "chat",
        message: reply.message,
        summary: reply.message,
        appointment,
        saved_preferences: savedPreferences,
      });
    }

    const orchestrateCopilot =
      deps.orchestrateCopilot ??
      (await import("../../../lib/orchestrator")).orchestrateCopilot;
    const response = await orchestrateCopilot({
      mode: "auto",
      query: message,
      url: body.url,
      pageTitle: body.pageTitle,
      visibleText: body.visibleText,
      pageSummary: body.pageSummary,
      taskMemory: normalizedTaskMemory,
      appointment,
      userProfile: userContext.profile,
      userContextEntries: userContext.entries,
      userId,
    });

    const persistMemoryUpdate = deps.persistCopilotMemoryUpdate ?? persistCopilotMemoryUpdate;
    const taskMemory = await persistMemoryUpdate({
      userId,
      response,
      currentFlow,
      taskMemory: normalizedTaskMemory,
      appointment,
      currentUrl: body.url,
      pageTitle: body.pageTitle,
    });

    const reminder = appointment
      ? buildAppointmentReminder({
          appointment,
          profile: userContext.profile,
          entries: userContext.entries,
        })
      : null;

    const savedPreferences = await (deps.persistPreferenceSignals ?? persistPreferenceSignals)(
      userId,
      message,
      userContext.profile,
    );

    return Response.json({
      ...response,
      appointment,
      reminder,
      task_memory: taskMemory,
      saved_preferences: savedPreferences,
      message: buildChatMessage(
        response.summary,
        response.nextStep,
        response.explanation,
        reminder?.message,
        savedPreferences,
      ),
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json(
      {
        summary: "I had a small problem.",
        nextStep: "Please try again in a moment.",
        explanation:
          "I’m having trouble reading the message right now. Please try again in a moment.",
      },
      { status: 500 },
    );
  }
}
