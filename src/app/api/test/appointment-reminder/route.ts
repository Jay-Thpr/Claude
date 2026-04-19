import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "@/lib/appointment-utils";
import { buildAppointmentReminder } from "@/lib/appointment-reminders";
import { DEMO_USER_ID } from "@/lib/mock-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadUserContextFromCookies } from "@/lib/user-context";

async function ensureReminderTestRow(userId: string) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .ilike("prep_notes", "%retainers%")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const { error: insertError } = await supabase.from("appointments").insert({
    user_id: userId,
    title: "Doctor appointment with Dr. Patel",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    description: "Review the follow-up plan and bring the note about retainers.",
    portal_link: "https://myhealth.ucsd.edu",
    source: "seed",
    location: "UCSD Medical Center",
    prep_notes: "Remember to bring retainers.",
  });

  if (insertError) {
    throw insertError;
  }

  const { data: inserted } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .ilike("prep_notes", "%retainers%")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  return inserted;
}

export async function GET() {
  const cookieStore = await cookies();
  const userContext = await loadUserContextFromCookies(cookieStore);
  const userId = userContext.profile.userId || DEMO_USER_ID;
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return Response.json(
      {
        status: "error",
        message: "Supabase is not configured yet.",
      },
      { status: 503 },
    );
  }

  const row = await ensureReminderTestRow(userId);
  if (!row) {
    return Response.json(
      {
        status: "error",
        message: "Could not find or create the reminder test appointment.",
      },
      { status: 500 },
    );
  }

  const appointment = buildAppointmentContextFromRow(row, { source: "supabase" });

  const reminder = buildAppointmentReminder({
    appointment,
    profile: userContext.profile,
    entries: userContext.entries,
  });

  const reminderText = reminder.message.toLowerCase();
  const hasRetainers = reminderText.includes("retainer");
  const hasCalmSupport =
    reminderText.includes("calm") || reminderText.includes("one step at a time");
  const allOk = hasRetainers && hasCalmSupport;

  return Response.json({
    status: allOk ? "ok" : "partial_failure",
    appointment,
    reminder,
    checks: {
      appointment: "ok",
      note: hasRetainers ? "ok" : "missing retainers reminder",
      calming: hasCalmSupport ? "ok" : "missing calming preference reminder",
      database: "ok",
    },
  });
}
