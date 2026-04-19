"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGCalUpcomingRequest = handleGCalUpcomingRequest;
exports.GET = GET;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
const gcal_1 = require("../../../../lib/gcal");
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
async function handleGCalUpcomingRequest(deps = {}) {
    try {
        let snapshot;
        if (deps.loadCalendarSnapshot) {
            snapshot = await deps.loadCalendarSnapshot();
        }
        else {
            const cookieStore = await (0, headers_1.cookies)();
            snapshot = await (0, gcal_1.loadCalendarSnapshot)(cookieStore);
        }
        if (!snapshot || !snapshot.connected) {
            return server_1.NextResponse.json({ connected: false, appointments: [] });
        }
        const now = Date.now();
        const cutoff = now + FOUR_HOURS_MS;
        const appointments = snapshot.upcomingAppointments
            .filter((appt) => {
            const startMs = new Date(appt.start).getTime();
            return startMs >= now && startMs <= cutoff;
        })
            .map((appt) => {
            const startMs = new Date(appt.start).getTime();
            return {
                ...appt,
                minutesUntil: Math.round((startMs - now) / 60000),
            };
        });
        return server_1.NextResponse.json({ connected: true, appointments });
    }
    catch (err) {
        console.error("Google Calendar upcoming error:", err);
        return server_1.NextResponse.json({
            connected: false,
            appointments: [],
            error: err instanceof Error ? err.message : "Unknown error",
        });
    }
}
async function GET() {
    return handleGCalUpcomingRequest();
}
