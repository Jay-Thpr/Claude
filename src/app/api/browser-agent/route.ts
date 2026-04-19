import { extractFromPage } from "@/lib/browser-use";
import { updateTaskMemory, getTaskMemory } from "@/lib/memory-store";
import { createAppointment } from "@/lib/google-calendar";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DEMO_USER_ID, DEMO_USER_PROFILE } from "@/lib/mock-context";
import { logger } from "@/lib/logger";

interface StoredProfile {
  name?: string | null;
  age_group?: string | null;
  conditions?: string[] | null;
  preferences?: string[] | null;
  support_needs?: string[] | null;
  notes?: string | null;
}

async function loadUserProfileContext(): Promise<string> {
  try {
    const supabase = createServerSupabaseClient();
    if (supabase) {
      const { data } = await supabase
        .from("user_profiles")
        .select("name, age_group, conditions, preferences, support_needs, notes")
        .eq("user_id", DEMO_USER_ID)
        .maybeSingle();
      if (data) {
        return formatProfileContext(data as StoredProfile);
      }
    }
  } catch {
    // fall through to demo profile
  }
  return formatProfileContext({
    name: DEMO_USER_PROFILE.name,
    age_group: DEMO_USER_PROFILE.ageGroup,
    conditions: DEMO_USER_PROFILE.conditions,
    preferences: DEMO_USER_PROFILE.preferences,
    support_needs: DEMO_USER_PROFILE.supportNeeds,
    notes: DEMO_USER_PROFILE.notes,
  });
}

function formatProfileContext(p: StoredProfile): string {
  const lines: string[] = ["User profile:"];
  if (p.name) lines.push(`- Name: ${p.name}`);
  if (p.age_group) lines.push(`- Age group: ${p.age_group}`);
  if (p.conditions?.length) lines.push(`- Conditions: ${p.conditions.join(", ")}`);
  if (p.preferences?.length) lines.push(`- Preferences: ${p.preferences.join(", ")}`);
  if (p.support_needs?.length) lines.push(`- Support needs: ${p.support_needs.join(", ")}`);
  if (p.notes) lines.push(`- Notes: ${p.notes}`);
  lines.push("IMPORTANT: Do NOT submit, confirm, pay, or share personal info without explicitly pausing for user review.");
  return lines.join("\n");
}

export interface BrowserAgentRequest {
  goal: string;
  context?: string;
  returnFields?: string[];
  scheduleResult?: boolean;
  scamCheckUrl?: string;
  scamCheckNotifyPhone?: string;
}

export interface ScheduledEvent {
  eventId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
}

export interface BrowserAgentResponse {
  success: true;
  result: string;
  parsed: Record<string, unknown> | null;
  scheduled: ScheduledEvent | null;
  memory: {
    current_task: string | null;
    last_step: string | null;
  } | null;
}

export interface BrowserAgentError {
  success: false;
  error: string;
  scheduleError?: string;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    // Not JSON
  }
  return null;
}

function parseScheduledAt(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (d < new Date()) return null; // must be in the future
  return d;
}

export async function POST(request: Request): Promise<Response> {
  let body: BrowserAgentRequest;
  try {
    body = (await request.json()) as BrowserAgentRequest;
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" } satisfies BrowserAgentError, { status: 400 });
  }

  const { goal, context, returnFields, scheduleResult, scamCheckUrl, scamCheckNotifyPhone } = body;

  if (!goal?.trim()) {
    return Response.json({ success: false, error: "goal is required" } satisfies BrowserAgentError, { status: 400 });
  }

  // Pre-flight scam check — block before running the browser agent
  if (scamCheckUrl) {
    try {
      const scamRes = await fetch(new URL("/api/scam-check", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: scamCheckUrl,
          actions: {
            blockOnRisky: true,
            ...(scamCheckNotifyPhone ? { notifyPhone: scamCheckNotifyPhone } : {}),
          },
        }),
      });
      if (scamRes.ok) {
        const scamData = (await scamRes.json()) as { blocked?: boolean; classification?: string; explanation?: string };
        if (scamData.blocked) {
          return Response.json(
            {
              success: false,
              error: `This website was flagged as potentially risky and the task was stopped for your safety. ${scamData.explanation ?? ""}`.trim(),
            } satisfies BrowserAgentError,
            { status: 403 }
          );
        }
      }
    } catch (err) {
      logger.error("browser-agent", "scam pre-check failed, continuing", err);
    }
  }

  const [profileContext, priorMemory] = await Promise.all([
    loadUserProfileContext(),
    getTaskMemory(DEMO_USER_ID),
  ]);

  const memoryContext = priorMemory?.current_task
    ? `Prior session memory:\n- Last task: ${priorMemory.current_task}\n- Last step: ${priorMemory.last_step ?? "unknown"}\nContinue from where the user left off if relevant.`
    : null;

  // Build field hints. When scheduling, always request the appointment shape.
  const scheduleFields = scheduleResult
    ? ["title", "scheduledAt (ISO 8601 datetime, e.g. 2026-04-20T10:00:00)", "durationMinutes (number, default 30)", "notes"]
    : [];
  const allFields = [...(returnFields ?? []), ...scheduleFields];
  const fieldsHint = allFields.length
    ? `\n\nReturn your answer as JSON with these fields: ${allFields.join(", ")}.`
    : "";

  const task = [
    profileContext,
    memoryContext,
    goal,
    context ? `Additional context: ${context}` : null,
    fieldsHint || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await extractFromPage(task);

  if (!result) {
    return Response.json(
      { success: false, error: "Browser agent returned no result. Is the Python backend running on port 8000?" } satisfies BrowserAgentError,
      { status: 503 }
    );
  }

  const parsed = tryParseJson(result);

  // Attempt GCal scheduling if requested
  let scheduled: ScheduledEvent | null = null;
  let scheduleError: string | undefined;

  if (scheduleResult && parsed) {
    const startTime = parseScheduledAt(parsed.scheduledAt);
    if (startTime) {
      const title = typeof parsed.title === "string" ? parsed.title : goal.slice(0, 100);
      const durationMinutes = typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : 30;
      const notes = typeof parsed.notes === "string" ? parsed.notes : result.slice(0, 500);

      try {
        const eventId = await createAppointment(title, startTime, durationMinutes, notes);
        scheduled = { eventId, title, scheduledAt: startTime.toISOString(), durationMinutes };
      } catch (err) {
        logger.error("browser-agent", "createAppointment failed", err);
        scheduleError = "Browser agent found appointment info but Google Calendar write failed.";
      }
    }
    // If no scheduledAt in parsed output, scheduling is silently skipped —
    // the agent may have found a phone number to call instead of a bookable slot.
  }

  await updateTaskMemory(DEMO_USER_ID, {
    current_task: goal.slice(0, 200),
    last_step: scheduled
      ? `Scheduled "${scheduled.title}" on ${scheduled.scheduledAt}`
      : result.slice(0, 300),
  });

  const memory = await getTaskMemory(DEMO_USER_ID);

  return Response.json({
    success: true,
    result,
    parsed,
    scheduled,
    ...(scheduleError ? { scheduleError } : {}),
    memory: memory
      ? { current_task: memory.current_task, last_step: memory.last_step }
      : null,
  } satisfies BrowserAgentResponse);
}
