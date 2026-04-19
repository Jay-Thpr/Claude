import { google } from "googleapis";
import { logger } from "./logger";

export interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string | null;
  location: string | null;
  portal_link: string | null;
}

function getAuthClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2;
}

function extractPortalLink(description: string | null): string | null {
  if (!description) return null;
  const match = description.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export async function getUpcomingAppointments(limit = 3): Promise<Appointment[]> {
  try {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items ?? [];

    return events.map((event) => ({
      id: event.id ?? "",
      title: event.summary ?? "Untitled",
      start_time: event.start?.dateTime ?? event.start?.date ?? "",
      end_time: event.end?.dateTime ?? event.end?.date ?? "",
      description: event.description ?? null,
      location: event.location ?? null,
      portal_link: extractPortalLink(event.description ?? null),
    }));
  } catch (err) {
    logger.error("google-calendar", "getUpcomingAppointments failed", err);
    return [];
  }
}

export async function addPrepNotes(eventId: string, notes: string): Promise<void> {
  try {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const existing = await calendar.events.get({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
    });

    const currentDescription = existing.data.description ?? "";
    const updatedDescription = currentDescription
      ? `${currentDescription}\n\n---\nPrep notes: ${notes}`
      : `Prep notes: ${notes}`;

    await calendar.events.patch({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
      requestBody: { description: updatedDescription },
    });
  } catch (err) {
    logger.error("google-calendar", "addPrepNotes failed", err);
    throw err;
  }
}

export async function createAppointment(
  title: string,
  startTime: Date,
  durationMinutes = 60,
  notes?: string
): Promise<string> {
  try {
    const auth = getAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const res = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: title,
        description: notes,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
      },
    });

    return res.data.id ?? "";
  } catch (err) {
    logger.error("google-calendar", "createAppointment failed", err);
    throw err;
  }
}
