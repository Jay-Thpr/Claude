import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "@/lib/appointment-utils";
import { orchestrateCopilot } from "@/lib/orchestrator";
import { buildAppointmentReminder } from "@/lib/appointment-reminders";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadUserContextFromCookies } from "@/lib/user-context";
import { persistPreferenceSignals } from "@/lib/preference-store";

type ChatRequest = {
  message?: string;
  url?: string;
  pageTitle?: string;
  visibleText?: string;
  pageSummary?: string;
  taskMemory?: {
    currentTask?: string | null;
    lastStep?: string | null;
    currentUrl?: string | null;
    pageTitle?: string | null;
  } | null;
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
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const userContext = await loadUserContextFromCookies(cookieStore);
    const userId = userContext.profile.userId;

    const supabase = createServerSupabaseClient();
    let appointment = body.appointment || null;

    if (!appointment && supabase) {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("user_id", userId)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(1)
        .single();

      if (data) {
        appointment = buildAppointmentContextFromRow(data, { source: "supabase" });
      }
    }

    const response = await orchestrateCopilot({
      mode: "auto",
      query: message,
      url: body.url,
      pageTitle: body.pageTitle,
      visibleText: body.visibleText,
      pageSummary: body.pageSummary,
      taskMemory: body.taskMemory,
      appointment,
      userProfile: userContext.profile,
      userContextEntries: userContext.entries,
      userId,
    });

    const reminder = appointment
      ? buildAppointmentReminder({
          appointment,
          profile: userContext.profile,
          entries: userContext.entries,
        })
      : null;

    const savedPreferences = await persistPreferenceSignals(userId, message, userContext.profile);

    return Response.json({
      ...response,
      appointment,
      reminder,
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
