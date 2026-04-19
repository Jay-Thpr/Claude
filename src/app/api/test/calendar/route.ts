import { getUpcomingAppointments } from "@/lib/google-calendar";

export async function GET() {
  const appointments = await getUpcomingAppointments(3);

  if (appointments.length === 0) {
    return Response.json({
      status: "warning",
      message: "Connected but no upcoming appointments found. Check your calendar has future events.",
      appointments: [],
    });
  }

  return Response.json({
    status: "ok",
    message: `Found ${appointments.length} upcoming appointment(s).`,
    appointments,
  });
}
