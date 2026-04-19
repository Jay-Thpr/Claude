import { cookies } from "next/headers";
import type { CalendarSnapshot } from "@/lib/gcal";
import { loadCalendarSnapshot } from "@/lib/gcal";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DEMO_APPOINTMENT, DEMO_USER_ID } from "@/lib/mock-context";
import { loadUserContextFromCookies } from "@/lib/user-context";
import { generateAppointmentAdvice } from "@/lib/appointment-advice";

export async function GET() {
  try {
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

    if (snapshot.connected) {
      if (snapshot.nextAppointment) {
        const appt = snapshot.nextAppointment;
        const advice = await generateAppointmentAdvice({
          appointment: {
            connected: true,
            summary: appt.summary,
            whenLabel: appt.whenLabel,
            timeLabel: appt.timeLabel,
            location: appt.location || null,
            description: appt.description || null,
            source: snapshot.source,
          },
          profile: userContext.profile,
          entries: userContext.entries,
        });

        return Response.json({
          message: snapshot.message,
          appointment: {
            summary: appt.summary,
            whenLabel: appt.whenLabel,
            timeLabel: appt.timeLabel,
            location: appt.location || null,
            description: appt.description || null,
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
      const advice = await generateAppointmentAdvice({
        appointment: DEMO_APPOINTMENT,
        profile: userContext.profile,
        entries: userContext.entries,
      });

      return Response.json({
        message: `Your next appointment is ${DEMO_APPOINTMENT.whenLabel || "tomorrow"} at ${DEMO_APPOINTMENT.timeLabel || "10:30 AM"}: ${DEMO_APPOINTMENT.summary}. ${DEMO_APPOINTMENT.description || ""}`,
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
      .eq("user_id", DEMO_USER_ID)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(1)
      .single();

    if (data && !error) {
      const apptDate = new Date(data.start_time);
      const isToday =
        apptDate.toDateString() === new Date().toDateString();
      const isTomorrow =
        apptDate.toDateString() ===
        new Date(Date.now() + 86400000).toDateString();

      const when = isToday
        ? "today"
        : isTomorrow
          ? "tomorrow"
          : apptDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            });

      const time = apptDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      const advice = await generateAppointmentAdvice({
        appointment: {
          connected: false,
          summary: data.title,
          whenLabel: when,
          timeLabel: time,
          location: data.location || null,
          description: data.description || null,
          source: "supabase",
        },
        profile: userContext.profile,
        entries: userContext.entries,
      });

      return Response.json({
        message: `Your next appointment is ${when} at ${time}: ${data.title}. ${data.description || ""}`,
        appointment: {
          summary: data.title,
          whenLabel: when,
          timeLabel: time,
          location: data.location || null,
          description: data.description || null,
          source: "supabase",
        },
        prep_advice: advice,
        connected: false,
        source: "supabase",
      });
    }

    // Fallback to demo data
    const advice = await generateAppointmentAdvice({
      appointment: DEMO_APPOINTMENT,
      profile: userContext.profile,
      entries: userContext.entries,
    });

    return Response.json({
      message: `Your next appointment is ${DEMO_APPOINTMENT.whenLabel || "tomorrow"} at ${DEMO_APPOINTMENT.timeLabel || "10:30 AM"}: ${DEMO_APPOINTMENT.summary}. ${DEMO_APPOINTMENT.description || ""}`,
      appointment: DEMO_APPOINTMENT,
      prep_advice: advice,
      connected: false,
      source: "demo",
    });
  } catch (err) {
    console.error("Appointments error:", err);
    return Response.json(
      { message: "I couldn't check your appointments right now. Please try again." },
      { status: 500 }
    );
  }
}
