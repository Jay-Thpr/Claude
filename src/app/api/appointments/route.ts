import { getUpcomingAppointments, createAppointment } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";

const DEMO_APPOINTMENT = {
  id: "demo-001",
  title: "Cardiology Follow-up",
  start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
  description: "Follow-up with Dr. Martinez at UCSD Medical Center. Bring medication list and insurance card.",
  location: "UCSD Medical Center",
  portal_link: "https://myhealth.ucsd.edu",
};

function formatAppointmentMessage(appt: { title: string; start_time: string; description: string | null }) {
  const apptDate = new Date(appt.start_time);
  const isToday = apptDate.toDateString() === new Date().toDateString();
  const isTomorrow =
    apptDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

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

  return `Your next appointment is ${when} at ${time}: ${appt.title}. ${appt.description ?? ""}`;
}

export async function GET() {
  const appointments = await getUpcomingAppointments(1);

  if (appointments.length > 0) {
    return Response.json({
      message: formatAppointmentMessage(appointments[0]),
      appointment: appointments[0],
    });
  }

  // Fallback to demo data when GCal is not yet connected
  logger.warn("appointments", "No GCal appointments found, using demo fallback");
  return Response.json({
    message: formatAppointmentMessage(DEMO_APPOINTMENT),
    appointment: DEMO_APPOINTMENT,
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
  } catch {
    return Response.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
