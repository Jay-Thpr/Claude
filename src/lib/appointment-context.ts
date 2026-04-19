import { cookies } from "next/headers";
import { buildAppointmentContextFromRow } from "./appointment-utils";
import { DEMO_APPOINTMENT, DEMO_USER_ID } from "./mock-context";
import { loadCalendarSnapshot } from "./gcal";
import { createServerSupabaseClient, hasSupabaseConfig } from "./supabase-server";
import { loadUserContextFromCookies } from "./user-context";
import type { AppointmentContext } from "./response-schema";

export async function loadCurrentAppointmentContext(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  userId?: string,
): Promise<AppointmentContext> {
  const fallback = {
    ...DEMO_APPOINTMENT,
    connected: Boolean(DEMO_APPOINTMENT.connected),
  };

  try {
    const [snapshot, userContext] = await Promise.all([
      loadCalendarSnapshot(cookieStore),
      loadUserContextFromCookies(cookieStore),
    ]);

    if (snapshot.connected && snapshot.nextAppointment) {
      return {
        connected: true,
        summary: snapshot.nextAppointment.summary,
        whenLabel: snapshot.nextAppointment.whenLabel,
        timeLabel: snapshot.nextAppointment.timeLabel,
        location: snapshot.nextAppointment.location,
        description: snapshot.nextAppointment.description,
        prepNotes: null,
        source: snapshot.source,
      };
    }

    const resolvedUserId = userId || userContext.profile.userId || DEMO_USER_ID;

    const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("*")
          .eq("user_id", resolvedUserId)
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(1)
          .single();

        if (!error && data) {
          return buildAppointmentContextFromRow(data, { source: "supabase" });
        }
      } catch {
        // Fall through to demo data.
      }
    }
  } catch {
    // Fall through to demo data.
  }

  return fallback;
}
