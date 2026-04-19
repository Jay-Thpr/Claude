"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.handleChatRequest = handleChatRequest;
const headers_1 = require("next/headers");
const appointment_utils_1 = require("../../../lib/appointment-utils");
const chat_agent_1 = require("../../../lib/chat-agent");
const supabase_server_1 = require("../../../lib/supabase-server");
const user_context_1 = require("../../../lib/user-context");
const preference_store_1 = require("../../../lib/preference-store");
const memory_store_1 = require("../../../lib/memory-store");
const task_memory_input_1 = require("../../../lib/task-memory-input");
const google_calendar_1 = require("../../../lib/google-calendar");
function buildExecutionInput(requestBody, taskMemory, appointment, userContext) {
    return {
        query: requestBody.message?.trim() || "",
        url: requestBody.url,
        pageTitle: requestBody.pageTitle,
        visibleText: requestBody.visibleText,
        pageSummary: requestBody.pageSummary,
        taskMemory,
        appointment,
        userProfile: userContext.profile,
        userContextEntries: userContext.entries,
    };
}
function resolveTaskMemory(taskMemory, currentFlow) {
    return taskMemory || currentFlow || null;
}
function parseScheduledAt(value) {
    if (!value) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}
async function runDefaultCalendarAction(input) {
    if (input.action.action === "update") {
        if (!input.action.eventId) {
            throw new Error("calendar update requires eventId");
        }
        const updatedId = await (0, google_calendar_1.updateAppointment)(input.action.eventId, {
            title: input.action.title,
            startTime: parseScheduledAt(input.action.scheduledAt) || undefined,
            durationMinutes: input.action.durationMinutes,
            notes: input.action.notes,
            location: input.action.location ?? undefined,
        });
        return {
            calendarEvent: {
                action: "update",
                eventId: updatedId,
                title: input.action.title || input.appointment?.summary || "Calendar event",
                scheduledAt: input.action.scheduledAt,
                durationMinutes: input.action.durationMinutes,
            },
            appointment: input.appointment ?? null,
        };
    }
    const scheduledAt = parseScheduledAt(input.action.scheduledAt);
    if (!scheduledAt) {
        throw new Error("calendar create requires scheduledAt");
    }
    const eventId = await (0, google_calendar_1.createAppointment)(input.action.title || "Calendar event", scheduledAt, input.action.durationMinutes || 60, input.action.notes, input.action.location ?? null);
    return {
        calendarEvent: {
            action: "create",
            eventId,
            title: input.action.title || "Calendar event",
            scheduledAt: scheduledAt.toISOString(),
            durationMinutes: input.action.durationMinutes || 60,
        },
        appointment: input.appointment ?? null,
    };
}
async function POST(request) {
    return handleChatRequest(request);
}
async function handleChatRequest(request, deps = {}) {
    try {
        const body = (await request.json());
        const message = body.message?.trim();
        if (!message) {
            return Response.json({ error: "message is required" }, { status: 400 });
        }
        const normalizedTaskMemory = (0, task_memory_input_1.normalizeTaskMemoryInput)(body.taskMemory);
        const cookieStore = deps.userContext ? null : await (0, headers_1.cookies)();
        const userContext = deps.userContext ?? (await (0, user_context_1.loadUserContextFromCookies)(cookieStore));
        const userId = userContext.profile.userId;
        const supabase = (0, supabase_server_1.createServerSupabaseClient)();
        let appointment = deps.appointment ?? body.appointment ?? null;
        const currentFlowPromise = (0, memory_store_1.getTaskFlow)(userId);
        const appointmentPromise = !appointment && supabase
            ? supabase
                .from("appointments")
                .select("*")
                .eq("user_id", userId)
                .gte("start_time", new Date().toISOString())
                .order("start_time", { ascending: true })
                .limit(1)
                .single()
            : Promise.resolve({ data: null });
        const [{ data }, currentFlow] = await Promise.all([appointmentPromise, currentFlowPromise]);
        const taskMemory = resolveTaskMemory(normalizedTaskMemory, currentFlow);
        if (!appointment && data) {
            appointment = (0, appointment_utils_1.buildAppointmentContextFromRow)(data, { source: "supabase" });
        }
        const input = buildExecutionInput({ ...body, message }, taskMemory, appointment, userContext);
        const classify = deps.classifyChatIntent ?? chat_agent_1.classifyChatIntent;
        const planResponse = deps.generateChatPlan ?? chat_agent_1.generateChatPlan;
        const intentResult = await classify(input);
        const plan = await planResponse({ ...input, intent: intentResult.intent });
        const savedPreferences = await (deps.persistPreferenceSignals ?? preference_store_1.persistPreferenceSignals)(userId, message, userContext.profile);
        if (intentResult.intent === "calendar_action" && plan.calendarAction) {
            try {
                const execute = deps.runCalendarAction ?? runDefaultCalendarAction;
                const calendarResult = await execute({
                    action: plan.calendarAction,
                    appointment,
                });
                return Response.json({
                    mode: "appointment",
                    ...plan,
                    calendarEvent: calendarResult.calendarEvent,
                    appointment: calendarResult.appointment ?? appointment,
                    saved_preferences: savedPreferences,
                });
            }
            catch {
                return Response.json({
                    mode: "appointment",
                    ...plan,
                    appointment,
                    saved_preferences: savedPreferences,
                });
            }
        }
        const modeByIntent = {
            basic_chat: "chat",
            calendar_action: "appointment",
            page_security: "scam_check",
            current_stage: "memory_recall",
            next_stage: "memory_recall",
        };
        return Response.json({
            mode: modeByIntent[intentResult.intent],
            ...plan,
            appointment,
            saved_preferences: savedPreferences,
        });
    }
    catch (error) {
        console.error("Chat route error:", error);
        return Response.json({
            mode: "chat",
            summary: "I had a small problem.",
            nextStep: "Please try again in a moment.",
            explanation: "I’m having trouble reading the message right now. Please try again in a moment.",
            riskLevel: "uncertain",
            suspiciousSignals: [],
        }, { status: 500 });
    }
}
