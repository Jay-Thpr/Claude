import { GoogleGenerativeAI } from "@google/generative-ai";
import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "@/lib/appointment-utils";
import { loadCalendarSnapshot } from "@/lib/gcal";
import { createServerSupabaseClient, hasSupabaseConfig } from "@/lib/supabase-server";
import { DEMO_APPOINTMENT, DEMO_MEMORY, DEMO_USER_ID } from "@/lib/mock-context";
import {
  type AppointmentContext,
  type CopilotRequest,
  type CopilotResponse,
  type CopilotMode,
  type TaskMemoryState,
  type UserContextEntry,
  type UserProfileContext,
  normalizeCopilotResponse,
} from "@/lib/response-schema";
import { routeIntent } from "@/lib/intent-router";
import {
  assessRiskLevel,
  buildMemorySummary,
  extractSuspiciousSignals,
  fallbackSafetyResponse,
} from "@/lib/safety-rules";
import { buildCopilotPrompt } from "@/lib/prompts";
import { loadUserContextFromCookies, summarizeUserContext } from "@/lib/user-context";

type OrchestrationMode = Exclude<CopilotMode, "chat">;

type CopilotContext = {
  userProfile: UserProfileContext;
  userContextEntries: UserContextEntry[];
  taskMemory: TaskMemoryState;
  appointment: AppointmentContext;
  intent: OrchestrationMode;
  suspiciousSignals: string[];
  riskLevel: CopilotResponse["riskLevel"];
};

const FALLBACK_MODELS = [
  process.env.SAFESTEP_GEMINI_MODEL || "gemini-2.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.1-flash-lite-preview",
];

function buildDefaultTaskMemory(): TaskMemoryState {
  return {
      currentTask: DEMO_MEMORY.currentTask,
      taskType: DEMO_MEMORY.taskType,
      taskGoal: DEMO_MEMORY.taskGoal,
      currentStageIndex: DEMO_MEMORY.currentStageIndex,
      currentStageTitle: DEMO_MEMORY.currentStageTitle,
      currentStageDetail: DEMO_MEMORY.currentStageDetail,
      nextStageTitle: DEMO_MEMORY.nextStageTitle,
      nextStageDetail: DEMO_MEMORY.nextStageDetail,
      stagePlan: DEMO_MEMORY.stagePlan,
      status: DEMO_MEMORY.status,
      lastStep: DEMO_MEMORY.lastStep,
      currentUrl: DEMO_MEMORY.currentUrl,
      pageTitle: DEMO_MEMORY.pageTitle,
  };
}

function buildDefaultAppointment(): AppointmentContext {
  return {
    ...DEMO_APPOINTMENT,
    connected: Boolean(DEMO_APPOINTMENT.connected),
  };
}

async function loadStoredTaskMemory(userId: string): Promise<TaskMemoryState> {
  const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;
  if (!supabase) {
    return buildDefaultTaskMemory();
  }

  try {
    const { data, error } = await supabase
      .from("task_memory")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return buildDefaultTaskMemory();
    }

    return {
      currentTask: data.current_task || DEMO_MEMORY.currentTask,
      taskType: data.task_type || DEMO_MEMORY.taskType,
      taskGoal: data.task_goal || DEMO_MEMORY.taskGoal,
      currentStageIndex:
        typeof data.current_stage_index === "number"
          ? data.current_stage_index
          : DEMO_MEMORY.currentStageIndex,
      currentStageTitle: data.current_stage_title || DEMO_MEMORY.currentStageTitle,
      currentStageDetail: data.current_stage_detail || DEMO_MEMORY.currentStageDetail,
      nextStageTitle: data.next_stage_title || DEMO_MEMORY.nextStageTitle,
      nextStageDetail: data.next_stage_detail || DEMO_MEMORY.nextStageDetail,
      stagePlan: Array.isArray(data.stage_plan) ? data.stage_plan : DEMO_MEMORY.stagePlan,
      status: data.status || DEMO_MEMORY.status,
      lastStep: data.last_step || DEMO_MEMORY.lastStep,
      currentUrl: data.current_url || DEMO_MEMORY.currentUrl,
      pageTitle: data.page_title || DEMO_MEMORY.pageTitle,
    };
  } catch {
    return buildDefaultTaskMemory();
  }
}

async function loadStoredAppointment(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  userId: string,
): Promise<AppointmentContext> {
  const fallback = buildDefaultAppointment();

  try {
    const snapshot = await loadCalendarSnapshot(cookieStore);
    if (snapshot.connected && snapshot.nextAppointment) {
      return {
        connected: true,
        summary: snapshot.nextAppointment.summary,
        whenLabel: snapshot.nextAppointment.whenLabel,
        timeLabel: snapshot.nextAppointment.timeLabel,
        location: snapshot.nextAppointment.location,
        description: snapshot.nextAppointment.description,
        source: snapshot.source,
      };
    }
  } catch {
    // Fallback below.
  }

  const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .single();

    if (!error && data) {
      return buildAppointmentContextFromRow(data, { source: "supabase" });
    }
    } catch {
      // Fallback below.
    }
  }

  return fallback;
}

function safeParseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return new GoogleGenerativeAI(apiKey);
}

async function runGeminiPrompt(prompt: string) {
  const genAI = buildGenAI();

  let lastError: unknown = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to reach Gemini.");
}

function buildContext(
  input: CopilotRequest,
  taskMemory: TaskMemoryState,
  appointment: AppointmentContext,
  userProfile: UserProfileContext,
  userContextEntries: UserContextEntry[],
): CopilotContext {
  const intent = routeIntent(input);
  const pageText = [input.pageTitle, input.query, input.visibleText, input.pageSummary, input.url]
    .filter(Boolean)
    .join(" ");
  const suspiciousSignals = extractSuspiciousSignals(pageText);
  const riskLevel = assessRiskLevel(pageText);
  return {
    userProfile,
    userContextEntries,
    taskMemory,
    appointment,
    intent,
    suspiciousSignals,
    riskLevel,
  };
}

export async function orchestrateCopilot(input: CopilotRequest): Promise<CopilotResponse> {
  const cookieStore = await cookies();
  const loadedUserContext = input.userProfile
    ? {
        profile: input.userProfile,
        entries: input.userContextEntries || [],
        source: "request" as const,
      }
    : await loadUserContextFromCookies(cookieStore);
  const userId = input.userId || loadedUserContext.profile.userId || DEMO_USER_ID;
  const taskMemory = input.taskMemory || (await loadStoredTaskMemory(userId));
  const appointment = input.appointment || (await loadStoredAppointment(cookieStore, userId));
  const context = buildContext(
    input,
    taskMemory,
    appointment,
    loadedUserContext.profile,
    loadedUserContext.entries,
  );

  const textToAnalyze = [
    input.pageTitle,
    input.query,
    input.visibleText,
    input.pageSummary,
    input.url,
    buildMemorySummary(taskMemory, appointment),
    summarizeUserContext(loadedUserContext.entries),
  ]
    .filter(Boolean)
    .join("\n");

  if (context.intent === "scam_check" && context.riskLevel === "risky") {
    return normalizeCopilotResponse(
      fallbackSafetyResponse(textToAnalyze, context.intent),
      context.intent,
    );
  }

  const prompt = buildCopilotPrompt({
    mode: context.intent,
    query: input.query,
    url: input.url,
    pageTitle: input.pageTitle,
    visibleText: input.visibleText || input.pageSummary,
    taskMemory,
    appointment,
    userProfile: context.userProfile,
    userContextEntries: context.userContextEntries,
    suspiciousSignals: context.suspiciousSignals,
    riskLevel: context.riskLevel,
  });

  try {
    const rawText = await runGeminiPrompt(prompt);
    const parsed = safeParseJson<Partial<CopilotResponse>>(rawText);
    const response = normalizeCopilotResponse(parsed, context.intent);

    return {
      ...response,
      mode: context.intent,
      riskLevel:
        response.riskLevel ||
        (context.intent === "scam_check" ? context.riskLevel : undefined),
      suspiciousSignals:
        response.suspiciousSignals?.length
          ? response.suspiciousSignals
          : context.suspiciousSignals,
      memoryUpdate: response.memoryUpdate || {
        currentTask: taskMemory.currentTask || appointment.summary || "Browsing with SafeStep",
        lastStep: taskMemory.lastStep || "Reviewed the current page and asked SafeStep for help.",
      },
    };
  } catch (error) {
    console.error("Copilot orchestration failed:", error);
    const fallback = fallbackSafetyResponse(textToAnalyze, context.intent);
    return normalizeCopilotResponse(
      {
        ...fallback,
        memoryUpdate: {
          currentTask:
            taskMemory.currentTask || appointment.summary || "Browsing with SafeStep",
          lastStep: taskMemory.lastStep || "Reviewed the current page and asked SafeStep for help.",
        },
      },
      context.intent,
    );
  }
}
