import { cookies } from "next/headers";
import type { CalendarSnapshot } from "@/lib/gcal";
import { loadCalendarSnapshot } from "@/lib/gcal";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DEMO_APPOINTMENT, DEMO_USER_ID } from "@/lib/mock-context";
import { buildAppointmentContextFromRow } from "@/lib/appointment-utils";
import { loadUserContextFromCookies } from "@/lib/user-context";
import { generateAppointmentAdvice } from "@/lib/appointment-advice";
import { buildAppointmentReminder } from "@/lib/appointment-reminders";
import { createAppointment } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";

export async function GET() {
  const cookieStore = await cookies();
  let snapshot: CalendarSnapshot = {
    connected: false,
    profile: null,
    nextAppointment: null,
    upcomingAppointments: [],
    message: "Google Calendar is not connected yet.",
    source: "none" as const,
  };

  try {
    snapshot = await loadCalendarSnapshot(cookieStore);
  } catch (err) {
    console.error("Google Calendar snapshot error:", err);
  }

  const userContext = await loadUserContextFromCookies(cookieStore);
  const userId = userContext.profile.userId || DEMO_USER_ID;

  if (snapshot.connected) {
    if (snapshot.nextAppointment) {
      const appt = snapshot.nextAppointment;
      const appointment = {
        connected: true,
        summary: appt.summary,
        whenLabel: appt.whenLabel,
        timeLabel: appt.timeLabel,
        location: appt.location || null,
        description: appt.description || null,
        prepNotes: null,
        source: snapshot.source,
      };
      const reminder = buildAppointmentReminder({
        appointment,
        profile: userContext.profile,
        entries: userContext.entries,
      });
      const advice = await generateAppointmentAdvice({
        appointment,
        profile: userContext.profile,
        entries: userContext.entries,
      });

      return Response.json({
        message: reminder.message,
        reminder,
        appointment: {
          summary: appt.summary,
          whenLabel: appt.whenLabel,
          timeLabel: appt.timeLabel,
          location: appt.location || null,
          description: appt.description || null,
          prepNotes: null,
          source: "google-calendar",
        },
        prep_advice: advice,
        upcoming_appointments: snapshot.upcomingAppointments,
        connected: true,
        account: snapshot.profile,
        source: snapshot.source,
      });
    }

    return Response.json({
      message: snapshot.message,
      appointment: null,
      upcoming_appointments: snapshot.upcomingAppointments,
      connected: true,
      account: snapshot.profile,
      source: snapshot.source,
    });
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    const reminder = buildAppointmentReminder({
      appointment: DEMO_APPOINTMENT,
      profile: userContext.profile,
      entries: userContext.entries,
    });
    const advice = await generateAppointmentAdvice({
      appointment: DEMO_APPOINTMENT,
      profile: userContext.profile,
      entries: userContext.entries,
    });

    return Response.json({
      message: reminder.message,
      reminder,
      appointment: DEMO_APPOINTMENT,
      prep_advice: advice,
      connected: false,
      source: "demo",
    });
  }

  // Try to fetch from Supabase first
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .single();

  if (data && !error) {
    const appointment = buildAppointmentContextFromRow(data, { source: "supabase" });

    const advice = await generateAppointmentAdvice({
      appointment,
      profile: userContext.profile,
      entries: userContext.entries,
    });
    const reminder = buildAppointmentReminder({
      appointment,
      profile: userContext.profile,
      entries: userContext.entries,
    });

    return Response.json({
      message: reminder.message,
      reminder,
      appointment,
      prep_advice: advice,
      connected: false,
      source: "supabase",
    });
  }

  // Fallback to demo data -> This was inside origin/main but missed in the conflict block correctly above
  const advice = await generateAppointmentAdvice({
    appointment: DEMO_APPOINTMENT,
    profile: userContext.profile,
    entries: userContext.entries,
  });
  const reminder = buildAppointmentReminder({
    appointment: DEMO_APPOINTMENT,
    profile: userContext.profile,
    entries: userContext.entries,
  });

  return Response.json({
    message: reminder.message,
    reminder,
    appointment: DEMO_APPOINTMENT,
    prep_advice: advice,
    connected: false,
    source: "demo",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, startTime, durationMinutes, notes } = body;

    if (!title || !startTime) {
      return Response.json({ error: "title and startTime are required" }, { status: 400 });
    }

    const eventId = await createAppointment(
      title,
      new Date(startTime),
      durationMinutes ?? 60,
      notes
    );

    return Response.json({ success: true, eventId });
  } catch (err) {
    logger.error("appointments-route", "Failed to create appointment", err);
    return Response.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
