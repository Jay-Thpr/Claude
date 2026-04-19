"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCurrentAppointmentContext = loadCurrentAppointmentContext;
const appointment_utils_1 = require("./appointment-utils");
const mock_context_1 = require("./mock-context");
const gcal_1 = require("./gcal");
const supabase_server_1 = require("./supabase-server");
const user_context_1 = require("./user-context");
async function loadCurrentAppointmentContext(cookieStore, userId) {
    const fallback = {
        ...mock_context_1.DEMO_APPOINTMENT,
        connected: Boolean(mock_context_1.DEMO_APPOINTMENT.connected),
    };
    try {
        const [snapshot, userContext] = await Promise.all([
            (0, gcal_1.loadCalendarSnapshot)(cookieStore),
            (0, user_context_1.loadUserContextFromCookies)(cookieStore),
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
        const resolvedUserId = userId || userContext.profile.userId || mock_context_1.DEMO_USER_ID;
        const supabase = (0, supabase_server_1.hasSupabaseConfig)() ? (0, supabase_server_1.createServerSupabaseClient)() : null;
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
                    return (0, appointment_utils_1.buildAppointmentContextFromRow)(data, { source: "supabase" });
                }
            }
            catch {
                // Fall through to demo data.
            }
        }
    }
    catch {
        // Fall through to demo data.
    }
    return fallback;
}
