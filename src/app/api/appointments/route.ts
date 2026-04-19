import { cookies } from "next/headers";
import type { CalendarSnapshot } from "@/lib/gcal";
import { loadCalendarSnapshot } from "@/lib/gcal";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Fallback demo appointment data when Google Calendar isn't connected
const DEMO_APPOINTMENT = {
  title: "Cardiology Follow-up",
  start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  description:
    "Follow-up appointment with Dr. Martinez at UCSD Medical Center. Bring medication list and insurance card.",
  portal_link: "https://myhealth.ucsd.edu",
};

const DEMO_USER_ID = "demo-user-001";

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

    if (snapshot.connected) {
      if (snapshot.nextAppointment) {
        const appt = snapshot.nextAppointment;
        return Response.json({
          message: snapshot.message,
          appointment: {
            title: appt.summary,
            start_time: appt.start,
            end_time: appt.end || null,
            description: appt.description || "",
            location: appt.location || "",
            source: "google-calendar",
          },
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

      return Response.json({
        message: `Your next appointment is ${when} at ${time}: ${data.title}. ${data.description || ""}`,
        appointment: data,
        connected: false,
        source: "supabase",
      });
    }

    // Fallback to demo data
    const apptDate = new Date(DEMO_APPOINTMENT.start_time);
    const time = apptDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    return Response.json({
      message: `Your next appointment is tomorrow at ${time}: ${DEMO_APPOINTMENT.title}. ${DEMO_APPOINTMENT.description}`,
      appointment: DEMO_APPOINTMENT,
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
