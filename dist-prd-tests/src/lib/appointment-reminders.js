"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAppointmentReminder = buildAppointmentReminder;
function hasCalmPreference(profile, entries = []) {
    const haystack = [
        profile?.notes,
        ...(profile?.supportNeeds || []),
        ...(profile?.preferences || []),
        ...(profile?.conditions || []),
        ...(entries || []).map((entry) => `${entry.title} ${entry.detail}`),
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return /calm|steady|simple wording|plain language|short sentences|one step at a time|not rushed|slow/i.test(haystack);
}
function buildNoteReminder(appointment) {
    const note = [appointment.prepNotes, appointment.description].find((value) => Boolean(value));
    if (!note) {
        return null;
    }
    if (/retainer/i.test(note)) {
        return "Bring the note about your retainers.";
    }
    return `Bring the appointment note: ${note}`;
}
function buildAppointmentReminder({ appointment, profile, entries = [], }) {
    const whenLabel = appointment.whenLabel || "soon";
    const timeLabel = appointment.timeLabel ? ` at ${appointment.timeLabel}` : "";
    const summary = appointment.summary || "your upcoming appointment";
    const reminders = [`Your appointment is ${whenLabel}${timeLabel}: ${summary}.`];
    const noteReminder = buildNoteReminder(appointment);
    if (noteReminder) {
        reminders.push(noteReminder);
    }
    if (hasCalmPreference(profile, entries)) {
        reminders.push("Use the calm pace that works best for you and take one step at a time.");
    }
    if (appointment.location) {
        reminders.push(`Location: ${appointment.location}.`);
    }
    return {
        summary: `Your appointment reminder is ready for ${summary}.`,
        reminders,
        message: reminders.join(" "),
    };
}
