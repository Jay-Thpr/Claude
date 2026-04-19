import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "../../../lib/appointment-utils";
import { generateChatPlan, classifyChatIntent } from "../../../lib/chat-agent";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadUserContextFromCookies } from "../../../lib/user-context";
import { persistPreferenceSignals } from "../../../lib/preference-store";
import { getTaskFlow } from "../../../lib/memory-store";
import { normalizeTaskMemoryInput } from "../../../lib/task-memory-input";
import { createAppointment, updateAppointment } from "../../../lib/google-calendar";
import type {
  AppointmentContext,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "../../../lib/response-schema";
import type { CalendarActionPlan, ChatAgentInput, ChatIntent } from "../../../lib/chat-agent";

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

type CalendarExecutionResult = {
  calendarEvent: {
    action: "create" | "update";
    eventId: string;
    title: string;
    scheduledAt?: string;
    durationMinutes?: number;
  } | null;
  appointment?: AppointmentContext | null;
};

type ChatDependencies = {
  classifyChatIntent?: typeof classifyChatIntent;
  generateChatPlan?: typeof generateChatPlan;
  persistPreferenceSignals?: typeof persistPreferenceSignals;
  runCalendarAction?: (input: {
    action: CalendarActionPlan;
    appointment?: AppointmentContext | null;
  }) => Promise<CalendarExecutionResult>;
  userContext?: {
    profile: UserProfileContext;
    entries: UserContextEntry[];
  };
  appointment?: AppointmentContext | null;
  taskFlow?: TaskMemoryState | null;
};

function buildExecutionInput(
  requestBody: ChatRequest,
  taskMemory: TaskMemoryState | null,
  appointment: AppointmentContext | null,
  userContext: { profile: UserProfileContext; entries: UserContextEntry[] },
): ChatAgentInput {
  return {
    query: requestBody.message?.trim() || "",
    url: requestBody.url,
    pageTitle: requestBody.pageTitle,
    visibleText: requestBody.visibleText,
    pageSummary: requestBody.pageSummary,
    taskMemory,
    appointment,
    userProfile: userContext.profile,
    userContextEntries: userContext.entries,
  };
}

function resolveTaskMemory(
  taskMemory: TaskMemoryState | null,
  currentFlow: TaskMemoryState | null,
) {
  return taskMemory || currentFlow || null;
}

function parseScheduledAt(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

async function runDefaultCalendarAction(input: {
  action: CalendarActionPlan;
  appointment?: AppointmentContext | null;
}): Promise<CalendarExecutionResult> {
  if (input.action.action === "update") {
    if (!input.action.eventId) {
      throw new Error("calendar update requires eventId");
    }

    const updatedId = await updateAppointment(input.action.eventId, {
      title: input.action.title,
      startTime: parseScheduledAt(input.action.scheduledAt) || undefined,
      durationMinutes: input.action.durationMinutes,
      notes: input.action.notes,
      location: input.action.location ?? undefined,
    });

    return {
      calendarEvent: {
        action: "update",
        eventId: updatedId,
        title: input.action.title || input.appointment?.summary || "Calendar event",
        scheduledAt: input.action.scheduledAt,
        durationMinutes: input.action.durationMinutes,
      },
      appointment: input.appointment ?? null,
    };
  }

  const scheduledAt = parseScheduledAt(input.action.scheduledAt);
  if (!scheduledAt) {
    throw new Error("calendar create requires scheduledAt");
  }

  const eventId = await createAppointment(
    input.action.title || "Calendar event",
    scheduledAt,
    input.action.durationMinutes || 60,
    input.action.notes,
    input.action.location ?? null,
  );

  return {
    calendarEvent: {
      action: "create",
      eventId,
      title: input.action.title || "Calendar event",
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: input.action.durationMinutes || 60,
    },
    appointment: input.appointment ?? null,
  };
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
    const taskMemory = resolveTaskMemory(normalizedTaskMemory, currentFlow);

    if (!appointment && data) {
      appointment = buildAppointmentContextFromRow(data as Record<string, unknown>, { source: "supabase" });
    }

    const input = buildExecutionInput(
      { ...body, message },
      taskMemory,
      appointment,
      userContext,
    );

    const classify = deps.classifyChatIntent ?? classifyChatIntent;
    const planResponse = deps.generateChatPlan ?? generateChatPlan;
    const intentResult = await classify(input);
    const plan = await planResponse({ ...input, intent: intentResult.intent });

    const savedPreferences = await (deps.persistPreferenceSignals ?? persistPreferenceSignals)(
      userId,
      message,
      userContext.profile,
    );

    if (intentResult.intent === "calendar_action" && plan.calendarAction) {
      try {
        const execute = deps.runCalendarAction ?? runDefaultCalendarAction;
        const calendarResult = await execute({
          action: plan.calendarAction,
          appointment,
        });

        return Response.json({
          mode: "appointment",
          ...plan,
          calendarEvent: calendarResult.calendarEvent,
          appointment: calendarResult.appointment ?? appointment,
          saved_preferences: savedPreferences,
        });
      } catch {
        return Response.json({
          mode: "appointment",
          ...plan,
          appointment,
          saved_preferences: savedPreferences,
        });
      }
    }

    const modeByIntent: Record<ChatIntent, string> = {
      basic_chat: "chat",
      calendar_action: "appointment",
      page_security: "scam_check",
      current_stage: "memory_recall",
      next_stage: "memory_recall",
    };

    return Response.json({
      mode: modeByIntent[intentResult.intent],
      ...plan,
      appointment,
      saved_preferences: savedPreferences,
    });
  } catch (error) {
    console.error("Chat route error:", error);
    return Response.json(
      {
        mode: "chat",
        summary: "I had a small problem.",
        nextStep: "Please try again in a moment.",
        explanation:
          "I’m having trouble reading the message right now. Please try again in a moment.",
        riskLevel: "uncertain",
        suspiciousSignals: [],
      },
      { status: 500 },
    );
  }
}
