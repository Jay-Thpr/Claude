"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrateCopilot = orchestrateCopilot;
const generative_ai_1 = require("@google/generative-ai");
const headers_1 = require("next/headers");
const appointment_utils_1 = require("@/lib/appointment-utils");
const gcal_1 = require("@/lib/gcal");
const supabase_server_1 = require("@/lib/supabase-server");
const mock_context_1 = require("@/lib/mock-context");
const response_schema_1 = require("@/lib/response-schema");
const intent_router_1 = require("@/lib/intent-router");
const safety_rules_1 = require("@/lib/safety-rules");
const prompts_1 = require("@/lib/prompts");
const user_context_1 = require("@/lib/user-context");
const FALLBACK_MODELS = [
    process.env.SAFESTEP_GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.1-flash-lite-preview",
];
function buildDefaultTaskMemory() {
    return {
        currentTask: mock_context_1.DEMO_MEMORY.currentTask,
        taskType: mock_context_1.DEMO_MEMORY.taskType,
        taskGoal: mock_context_1.DEMO_MEMORY.taskGoal,
        currentStageIndex: mock_context_1.DEMO_MEMORY.currentStageIndex,
        currentStageTitle: mock_context_1.DEMO_MEMORY.currentStageTitle,
        currentStageDetail: mock_context_1.DEMO_MEMORY.currentStageDetail,
        nextStageTitle: mock_context_1.DEMO_MEMORY.nextStageTitle,
        nextStageDetail: mock_context_1.DEMO_MEMORY.nextStageDetail,
        stagePlan: mock_context_1.DEMO_MEMORY.stagePlan,
        status: mock_context_1.DEMO_MEMORY.status,
        lastStep: mock_context_1.DEMO_MEMORY.lastStep,
        currentUrl: mock_context_1.DEMO_MEMORY.currentUrl,
        pageTitle: mock_context_1.DEMO_MEMORY.pageTitle,
    };
}
function buildDefaultAppointment() {
    return {
        ...mock_context_1.DEMO_APPOINTMENT,
        connected: Boolean(mock_context_1.DEMO_APPOINTMENT.connected),
    };
}
async function loadStoredTaskMemory(userId) {
    const supabase = (0, supabase_server_1.hasSupabaseConfig)() ? (0, supabase_server_1.createServerSupabaseClient)() : null;
    if (!supabase) {
        return buildDefaultTaskMemory();
    }
    try {
        const { data, error } = await supabase
            .from("task_memory")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();
        if (error || !data) {
            return buildDefaultTaskMemory();
        }
        return {
            currentTask: data.current_task || mock_context_1.DEMO_MEMORY.currentTask,
            taskType: data.task_type || mock_context_1.DEMO_MEMORY.taskType,
            taskGoal: data.task_goal || mock_context_1.DEMO_MEMORY.taskGoal,
            currentStageIndex: typeof data.current_stage_index === "number"
                ? data.current_stage_index
                : mock_context_1.DEMO_MEMORY.currentStageIndex,
            currentStageTitle: data.current_stage_title || mock_context_1.DEMO_MEMORY.currentStageTitle,
            currentStageDetail: data.current_stage_detail || mock_context_1.DEMO_MEMORY.currentStageDetail,
            nextStageTitle: data.next_stage_title || mock_context_1.DEMO_MEMORY.nextStageTitle,
            nextStageDetail: data.next_stage_detail || mock_context_1.DEMO_MEMORY.nextStageDetail,
            stagePlan: Array.isArray(data.stage_plan) ? data.stage_plan : mock_context_1.DEMO_MEMORY.stagePlan,
            status: data.status || mock_context_1.DEMO_MEMORY.status,
            lastStep: data.last_step || mock_context_1.DEMO_MEMORY.lastStep,
            currentUrl: data.current_url || mock_context_1.DEMO_MEMORY.currentUrl,
            pageTitle: data.page_title || mock_context_1.DEMO_MEMORY.pageTitle,
        };
    }
    catch {
        return buildDefaultTaskMemory();
    }
}
async function loadStoredAppointment(cookieStore, userId) {
    const fallback = buildDefaultAppointment();
    try {
        const snapshot = await (0, gcal_1.loadCalendarSnapshot)(cookieStore);
        if (snapshot.connected && snapshot.nextAppointment) {
            return {
                connected: true,
                summary: snapshot.nextAppointment.summary,
                whenLabel: snapshot.nextAppointment.whenLabel,
                timeLabel: snapshot.nextAppointment.timeLabel,
                location: snapshot.nextAppointment.location,
                description: snapshot.nextAppointment.description,
                source: snapshot.source,
            };
        }
    }
    catch {
        // Fallback below.
    }
    const supabase = (0, supabase_server_1.hasSupabaseConfig)() ? (0, supabase_server_1.createServerSupabaseClient)() : null;
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from("appointments")
                .select("*")
                .eq("user_id", userId)
                .gte("start_time", new Date().toISOString())
                .order("start_time", { ascending: true })
                .limit(1)
                .single();
            if (!error && data) {
                return (0, appointment_utils_1.buildAppointmentContextFromRow)(data, { source: "supabase" });
            }
        }
        catch {
            // Fallback below.
        }
    }
    return fallback;
}
function safeParseJson(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : text);
    }
    catch {
        return null;
    }
}
function buildGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey);
}
async function runGeminiPrompt(prompt) {
    const genAI = buildGenAI();
    let lastError = null;
    for (const modelName of FALLBACK_MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            return result.response.text();
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error("Unable to reach Gemini.");
}
function buildContext(input, taskMemory, appointment, userProfile, userContextEntries) {
    const intent = (0, intent_router_1.routeIntent)(input);
    const pageText = [input.pageTitle, input.query, input.visibleText, input.pageSummary, input.url]
        .filter(Boolean)
        .join(" ");
    const suspiciousSignals = (0, safety_rules_1.extractSuspiciousSignals)(pageText, input.url);
    const riskLevel = (0, safety_rules_1.assessRiskLevel)(pageText, input.url);
    return {
        userProfile,
        userContextEntries,
        taskMemory,
        appointment,
        intent,
        suspiciousSignals,
        riskLevel,
    };
}
async function orchestrateCopilot(input) {
    const cookieStore = await (0, headers_1.cookies)();
    const loadedUserContext = input.userProfile
        ? {
            profile: input.userProfile,
            entries: input.userContextEntries || [],
            source: "request",
        }
        : await (0, user_context_1.loadUserContextFromCookies)(cookieStore);
    const userId = input.userId || loadedUserContext.profile.userId || mock_context_1.DEMO_USER_ID;
    const taskMemory = input.taskMemory || (await loadStoredTaskMemory(userId));
    const appointment = input.appointment || (await loadStoredAppointment(cookieStore, userId));
    const context = buildContext(input, taskMemory, appointment, loadedUserContext.profile, loadedUserContext.entries);
    const textToAnalyze = [
        input.pageTitle,
        input.query,
        input.visibleText,
        input.pageSummary,
        input.url,
        (0, safety_rules_1.buildMemorySummary)(taskMemory, appointment),
        (0, user_context_1.summarizeUserContext)(loadedUserContext.entries),
    ]
        .filter(Boolean)
        .join("\n");
    if (context.intent === "scam_check" && context.riskLevel === "risky") {
        return (0, response_schema_1.normalizeCopilotResponse)((0, safety_rules_1.fallbackSafetyResponse)(textToAnalyze, context.intent, input.url), context.intent);
    }
    const prompt = (0, prompts_1.buildCopilotPrompt)({
        mode: context.intent,
        query: input.query,
        url: input.url,
        pageTitle: input.pageTitle,
        visibleText: input.visibleText || input.pageSummary,
        taskMemory,
        appointment,
        userProfile: context.userProfile,
        userContextEntries: context.userContextEntries,
        suspiciousSignals: context.suspiciousSignals,
        riskLevel: context.riskLevel,
    });
    try {
        const rawText = await runGeminiPrompt(prompt);
        const parsed = safeParseJson(rawText);
        const response = (0, response_schema_1.normalizeCopilotResponse)(parsed, context.intent);
        return {
            ...response,
            mode: context.intent,
            riskLevel: response.riskLevel ||
                (context.intent === "scam_check" ? context.riskLevel : undefined),
            suspiciousSignals: response.suspiciousSignals?.length
                ? response.suspiciousSignals
                : context.suspiciousSignals,
            memoryUpdate: response.memoryUpdate || {
                currentTask: taskMemory.currentTask || appointment.summary || "Browsing with SafeStep",
                lastStep: taskMemory.lastStep || "Reviewed the current page and asked SafeStep for help.",
            },
        };
    }
    catch (error) {
        console.error("Copilot orchestration failed:", error);
        const fallback = (0, safety_rules_1.fallbackSafetyResponse)(textToAnalyze, context.intent, input.url);
        return (0, response_schema_1.normalizeCopilotResponse)({
            ...fallback,
            memoryUpdate: {
                currentTask: taskMemory.currentTask || appointment.summary || "Browsing with SafeStep",
                lastStep: taskMemory.lastStep || "Reviewed the current page and asked SafeStep for help.",
            },
        }, context.intent);
    }
}
