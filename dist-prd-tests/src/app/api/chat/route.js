"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.handleChatRequest = handleChatRequest;
const headers_1 = require("next/headers");
const appointment_utils_1 = require("../../../lib/appointment-utils");
const appointment_reminders_1 = require("../../../lib/appointment-reminders");
const general_chat_1 = require("../../../lib/general-chat");
const intent_router_1 = require("../../../lib/intent-router");
const supabase_server_1 = require("../../../lib/supabase-server");
const user_context_1 = require("../../../lib/user-context");
const preference_store_1 = require("../../../lib/preference-store");
const memory_store_1 = require("../../../lib/memory-store");
const copilot_memory_1 = require("../../../lib/copilot-memory");
const task_memory_input_1 = require("../../../lib/task-memory-input");
function buildChatMessage(summary, nextStep, explanation, reminderMessage, savedPreferences) {
    const parts = [summary, nextStep, explanation, reminderMessage];
    if (savedPreferences?.length) {
        parts.push(`I saved: ${savedPreferences.join(", ")}.`);
    }
    return parts.filter(Boolean).join(" ");
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
        const routingInput = {
            mode: "auto",
            query: message,
            url: body.url,
            pageTitle: body.pageTitle,
            visibleText: body.visibleText,
            pageSummary: body.pageSummary,
        };
        const intent = (0, intent_router_1.routeIntent)(routingInput);
        const shouldOrchestrate = intent === "scam_check" || (0, intent_router_1.shouldUseBrowserUse)(routingInput, intent);
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
        if (!appointment && data) {
            appointment = (0, appointment_utils_1.buildAppointmentContextFromRow)(data, { source: "supabase" });
        }
        if (!shouldOrchestrate) {
            const generateReply = deps.generateGeneralChatReply ?? general_chat_1.generateGeneralChatReply;
            const reply = await generateReply({
                query: message,
                url: body.url,
                pageTitle: body.pageTitle,
                visibleText: body.visibleText,
                pageSummary: body.pageSummary,
                taskMemory: normalizedTaskMemory,
                appointment,
                userProfile: userContext.profile,
                userContextEntries: userContext.entries,
            });
            const savedPreferences = await (deps.persistPreferenceSignals ?? preference_store_1.persistPreferenceSignals)(userId, message, userContext.profile);
            return Response.json({
                mode: "chat",
                message: reply.message,
                summary: reply.message,
                appointment,
                saved_preferences: savedPreferences,
            });
        }
        const orchestrateCopilot = deps.orchestrateCopilot ??
            (await Promise.resolve().then(() => __importStar(require("../../../lib/orchestrator")))).orchestrateCopilot;
        const response = await orchestrateCopilot({
            mode: "auto",
            query: message,
            url: body.url,
            pageTitle: body.pageTitle,
            visibleText: body.visibleText,
            pageSummary: body.pageSummary,
            taskMemory: normalizedTaskMemory,
            appointment,
            userProfile: userContext.profile,
            userContextEntries: userContext.entries,
            userId,
        });
        const persistMemoryUpdate = deps.persistCopilotMemoryUpdate ?? copilot_memory_1.persistCopilotMemoryUpdate;
        const taskMemory = await persistMemoryUpdate({
            userId,
            response,
            currentFlow,
            taskMemory: normalizedTaskMemory,
            appointment,
            currentUrl: body.url,
            pageTitle: body.pageTitle,
        });
        const reminder = appointment
            ? (0, appointment_reminders_1.buildAppointmentReminder)({
                appointment,
                profile: userContext.profile,
                entries: userContext.entries,
            })
            : null;
        const savedPreferences = await (deps.persistPreferenceSignals ?? preference_store_1.persistPreferenceSignals)(userId, message, userContext.profile);
        return Response.json({
            ...response,
            appointment,
            reminder,
            task_memory: taskMemory,
            saved_preferences: savedPreferences,
            message: buildChatMessage(response.summary, response.nextStep, response.explanation, reminder?.message, savedPreferences),
        });
    }
    catch (error) {
        console.error("Chat route error:", error);
        return Response.json({
            summary: "I had a small problem.",
            nextStep: "Please try again in a moment.",
            explanation: "I’m having trouble reading the message right now. Please try again in a moment.",
        }, { status: 500 });
    }
}
