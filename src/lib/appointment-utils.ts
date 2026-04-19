import type { AppointmentContext } from "@/lib/response-schema";

type AppointmentRow = {
  title?: string | null;
  start_time?: string | null;
  location?: string | null;
  description?: string | null;
  prep_notes?: string | null;
};

export function formatRelativeAppointmentDate(startTime: string | Date, now = new Date()) {
  const appointmentDate = startTime instanceof Date ? startTime : new Date(startTime);
  const tomorrow = new Date(now.getTime() + 86400000);

  if (appointmentDate.toDateString() === now.toDateString()) {
    return {
      whenLabel: "today",
      timeLabel: appointmentDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  }

  if (appointmentDate.toDateString() === tomorrow.toDateString()) {
    return {
      whenLabel: "tomorrow",
      timeLabel: appointmentDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  }

  return {
    whenLabel: appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    timeLabel: appointmentDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function buildAppointmentContextFromRow(
  row: AppointmentRow,
  options?: { connected?: boolean; source?: AppointmentContext["source"] },
): AppointmentContext {
  if (!row.start_time) {
    return {
      connected: Boolean(options?.connected),
      summary: row.title || "Appointment",
      whenLabel: "soon",
      timeLabel: null,
      location: row.location || null,
      description: row.description || null,
      prepNotes: row.prep_notes || null,
      source: options?.source || "supabase",
    };
  }

  const { whenLabel, timeLabel } = formatRelativeAppointmentDate(row.start_time);
  return {
    connected: Boolean(options?.connected),
    summary: row.title || "Appointment",
    whenLabel,
    timeLabel,
    location: row.location || null,
    description: row.description || null,
    prepNotes: row.prep_notes || null,
    source: options?.source || "supabase",
  };
}
