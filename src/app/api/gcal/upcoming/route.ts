import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadCalendarSnapshot } from "../../../../lib/gcal";
import type { CalendarSnapshot, CalendarEventSummary } from "../../../../lib/gcal";

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

type GCalUpcomingDeps = {
  loadCalendarSnapshot?: () => Promise<CalendarSnapshot | null>;
};

export async function handleGCalUpcomingRequest(deps: GCalUpcomingDeps = {}): Promise<Response> {
  try {
    let snapshot: CalendarSnapshot | null;
    if (deps.loadCalendarSnapshot) {
      snapshot = await deps.loadCalendarSnapshot();
    } else {
      const cookieStore = await cookies();
      snapshot = await loadCalendarSnapshot(cookieStore);
    }

    if (!snapshot || !snapshot.connected) {
      return NextResponse.json({ connected: false, appointments: [] });
    }

    const now = Date.now();
    const cutoff = now + FOUR_HOURS_MS;

    const appointments = snapshot.upcomingAppointments
      .filter((appt: CalendarEventSummary) => {
        const startMs = new Date(appt.start).getTime();
        return startMs >= now && startMs <= cutoff;
      })
      .map((appt: CalendarEventSummary) => {
        const startMs = new Date(appt.start).getTime();
        return {
          ...appt,
          minutesUntil: Math.round((startMs - now) / 60000),
        };
      });

    return NextResponse.json({ connected: true, appointments });
  } catch (err) {
    console.error("Google Calendar upcoming error:", err);
    return NextResponse.json({
      connected: false,
      appointments: [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function GET() {
  return handleGCalUpcomingRequest();
}
