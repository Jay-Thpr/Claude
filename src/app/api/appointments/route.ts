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
    });
  } catch (err) {
    console.error("Appointments error:", err);
    return Response.json(
      { message: "I couldn't check your appointments right now. Please try again." },
      { status: 500 }
    );
  }
}
