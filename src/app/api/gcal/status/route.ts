import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadCalendarSnapshot } from "@/lib/gcal";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const snapshot = await loadCalendarSnapshot(cookieStore);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("Google Calendar status error:", err);
    return NextResponse.json(
      {
        connected: false,
        profile: null,
        nextAppointment: null,
        upcomingAppointments: [],
        message: "I couldn't check Google Calendar right now.",
        source: "none",
      },
      { status: 200 },
    );
  }
}
