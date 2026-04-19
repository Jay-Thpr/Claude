"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpcomingAppointments = getUpcomingAppointments;
exports.addPrepNotes = addPrepNotes;
exports.createAppointment = createAppointment;
exports.updateAppointment = updateAppointment;
const googleapis_1 = require("googleapis");
const logger_1 = require("./logger");
function getAuthClient() {
    const oauth2 = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
    return oauth2;
}
function extractPortalLink(description) {
    if (!description)
        return null;
    const match = description.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
}
async function getUpcomingAppointments(limit = 3) {
    try {
        const auth = getAuthClient();
        const calendar = googleapis_1.google.calendar({ version: "v3", auth });
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
    }
    catch (err) {
        logger_1.logger.error("google-calendar", "getUpcomingAppointments failed", err);
        return [];
    }
}
async function addPrepNotes(eventId, notes) {
    try {
        const auth = getAuthClient();
        const calendar = googleapis_1.google.calendar({ version: "v3", auth });
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
    }
    catch (err) {
        logger_1.logger.error("google-calendar", "addPrepNotes failed", err);
        throw err;
    }
}
async function createAppointment(title, startTime, durationMinutes = 60, notes, location) {
    try {
        const auth = getAuthClient();
        const calendar = googleapis_1.google.calendar({ version: "v3", auth });
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        const res = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            requestBody: {
                summary: title,
                description: notes,
                location: location || undefined,
                start: { dateTime: startTime.toISOString() },
                end: { dateTime: endTime.toISOString() },
            },
        });
        return res.data.id ?? "";
    }
    catch (err) {
        logger_1.logger.error("google-calendar", "createAppointment failed", err);
        throw err;
    }
}
function parseEventDate(value) {
    const raw = value?.dateTime ?? value?.date;
    if (!raw) {
        return null;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return {
        raw,
        date,
        isAllDay: Boolean(value?.date && !value?.dateTime),
    };
}
async function updateAppointment(eventId, patch) {
    try {
        const auth = getAuthClient();
        const calendar = googleapis_1.google.calendar({ version: "v3", auth });
        const existing = await calendar.events.get({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId,
        });
        const currentStart = parseEventDate(existing.data.start);
        const currentEnd = parseEventDate(existing.data.end);
        let start = currentStart;
        if (patch.startTime) {
            start = {
                raw: patch.startTime.toISOString(),
                date: patch.startTime,
                isAllDay: false,
            };
        }
        let end = currentEnd;
        if (patch.startTime || typeof patch.durationMinutes === "number") {
            const startDate = patch.startTime ?? currentStart?.date;
            if (startDate) {
                const durationMinutes = typeof patch.durationMinutes === "number"
                    ? patch.durationMinutes
                    : currentStart && currentEnd
                        ? Math.max(1, Math.round((currentEnd.date.getTime() - currentStart.date.getTime()) / 60000))
                        : 60;
                const updatedEnd = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                end = {
                    raw: updatedEnd.toISOString(),
                    date: updatedEnd,
                    isAllDay: false,
                };
            }
        }
        await calendar.events.patch({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId,
            requestBody: {
                summary: patch.title ?? existing.data.summary ?? undefined,
                description: patch.notes ?? existing.data.description ?? undefined,
                location: typeof patch.location === "string"
                    ? patch.location
                    : patch.location === null
                        ? null
                        : existing.data.location ?? undefined,
                start: start
                    ? start.isAllDay
                        ? { date: start.raw }
                        : { dateTime: start.raw }
                    : undefined,
                end: end
                    ? end.isAllDay
                        ? { date: end.raw }
                        : { dateTime: end.raw }
                    : undefined,
            },
        });
        return eventId;
    }
    catch (err) {
        logger_1.logger.error("google-calendar", "updateAppointment failed", err);
        throw err;
    }
}
