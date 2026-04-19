"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyChatIntent = classifyChatIntent;
exports.generateChatPlan = generateChatPlan;
const generative_ai_1 = require("@google/generative-ai");
const safety_rules_1 = require("./safety-rules");
const MODEL_NAME = process.env.SAFESTEP_GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
function buildGenAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey);
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
function section(label, value) {
    if (!value) {
        return "";
    }
    return `- ${label}: ${value}`;
}
function buildContextText(input) {
    return [
        section("URL", input.url),
        section("Page title", input.pageTitle),
        section("User message", input.query),
        section("Visible text", input.visibleText),
        section("Page summary", input.pageSummary),
        section("Current task", input.taskMemory?.currentTask || null),
        section("Task goal", input.taskMemory?.taskGoal || null),
        section("Current stage", input.taskMemory?.currentStageTitle || null),
        section("Next stage", input.taskMemory?.nextStageTitle || null),
        section("Appointment", input.appointment?.summary || null),
        section("User name", input.userProfile?.name || null),
        input.userContextEntries?.length
            ? `- Context entries: ${input.userContextEntries
                .map((entry) => `${entry.category}: ${entry.title} - ${entry.detail}`)
                .join(" | ")}`
            : "",
    ]
        .filter(Boolean)
        .join("\n");
}
async function runPrompt(prompt) {
    const genAI = buildGenAI();
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    return result.response.text();
}
function fallbackIntent(input) {
    const text = [
        input.query,
        input.pageTitle,
        input.visibleText,
        input.pageSummary,
        input.url,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (/\b(?:safe|scam|phishing|fraud|suspicious|legit|secure|security|warning)\b/.test(text)) {
        return "page_security";
    }
    if (/\b(?:current stage|current step|where am i|what am i doing|what stage am i on)\b/.test(text)) {
        return "current_stage";
    }
    if (/\b(?:next stage|next step|what's next|whats next|what do i do next|continue)\b/.test(text)) {
        return "next_stage";
    }
    if (/\b(?:calendar|appointment|event|meeting|schedule|book|add|create|reschedule|update|cancel)\b/.test(text)) {
        return "calendar_action";
    }
    return "basic_chat";
}
function fallbackPlan(input, intent) {
    const baseContext = buildContextText(input);
    if (intent === "page_security") {
        const safety = (0, safety_rules_1.fallbackSafetyResponse)(baseContext, "scam_check", input.url);
        return {
            message: [safety.summary, safety.nextStep, safety.explanation].filter(Boolean).join(" "),
            summary: safety.summary,
            nextStep: safety.nextStep,
            explanation: safety.explanation,
            riskLevel: safety.riskLevel || "uncertain",
            suspiciousSignals: safety.suspiciousSignals,
            calendarAction: null,
        };
    }
    if (intent === "current_stage") {
        const currentStage = input.taskMemory?.currentStageTitle || input.taskMemory?.currentTask;
        const summary = currentStage
            ? `Your current stage is ${currentStage}.`
            : "I do not have a saved current stage yet.";
        return {
            message: currentStage
                ? [summary, input.taskMemory?.currentStageDetail, input.taskMemory?.lastStep ? `Last step: ${input.taskMemory.lastStep}.` : null]
                    .filter(Boolean)
                    .join(" ")
                : summary,
            summary,
            nextStep: currentStage
                ? input.taskMemory?.currentStageDetail || "Keep following the current stage."
                : "Tell me what task you are working on, and I will keep track of the stage.",
            explanation: input.taskMemory?.lastStep ? `Your last step was ${input.taskMemory.lastStep}.` : "I do not have a saved last step yet.",
            riskLevel: "safe",
            suspiciousSignals: [],
            calendarAction: null,
        };
    }
    if (intent === "next_stage") {
        const nextStage = input.taskMemory?.nextStageTitle;
        const currentStage = input.taskMemory?.currentStageTitle || input.taskMemory?.currentTask || null;
        const summary = nextStage
            ? `The next stage is ${nextStage}.`
            : "I do not have a saved next stage yet.";
        return {
            message: nextStage
                ? [summary, input.taskMemory?.nextStageDetail, currentStage ? `You are currently on ${currentStage}.` : null]
                    .filter(Boolean)
                    .join(" ")
                : summary,
            summary,
            nextStep: nextStage
                ? input.taskMemory?.nextStageDetail || "Move to the next stage when you are ready."
                : "Tell me what task you are working on, and I will keep track of the next stage.",
            explanation: currentStage ? `You are currently on ${currentStage}.` : "I do not have a saved current stage yet.",
            riskLevel: "safe",
            suspiciousSignals: [],
            calendarAction: null,
        };
    }
    if (intent === "calendar_action") {
        return {
            message: "I can help with the calendar item, but I need a date and time before I can add it.",
            summary: "I can help with the calendar item.",
            nextStep: "Tell me when it should happen, and I will handle the calendar action.",
            explanation: "I do not have enough calendar details yet to create or update the event safely.",
            riskLevel: "uncertain",
            suspiciousSignals: [],
            calendarAction: null,
        };
    }
    return {
        message: "I’m here with you. Tell me what you want to do, and I’ll keep it simple.",
        summary: "I’m here with you.",
        nextStep: "Tell me what page you are on or what you want to do next.",
        explanation: "I can look at the page, help you stay safe, and remind you what comes next.",
        riskLevel: "uncertain",
        suspiciousSignals: [],
        calendarAction: null,
    };
}
async function classifyChatIntent(input) {
    const prompt = [
        "You are SafeStep's router.",
        "Choose exactly one intent: basic_chat, calendar_action, page_security, current_stage, next_stage.",
        "Return JSON only with keys: intent, reason.",
        "Use calendar_action when the user wants to create, update, reschedule, cancel, or manage a calendar item or appointment.",
        "Use page_security when the user asks whether the page, site, or current page looks safe or suspicious.",
        "Use current_stage when the user asks what current action stage or step they are on.",
        "Use next_stage when the user asks what the next action stage or next step is.",
        "Use basic_chat for everything else.",
        "",
        buildContextText(input),
    ]
        .filter(Boolean)
        .join("\n");
    try {
        const rawText = await runPrompt(prompt);
        const parsed = safeParseJson(rawText);
        if (parsed?.intent) {
            return {
                intent: parsed.intent,
                reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
            };
        }
    }
    catch {
        // Fallback below.
    }
    return { intent: fallbackIntent(input) };
}
async function generateChatPlan(input) {
    const prompt = [
        "You are SafeStep, a calm assistant for a chrome extension.",
        "Return JSON only with keys: message, summary, nextStep, explanation, riskLevel, suspiciousSignals, calendarAction.",
        "riskLevel must be safe, uncertain, or risky.",
        "suspiciousSignals must always be an array of strings.",
        "calendarAction is optional. When present, include action, eventId, title, scheduledAt, durationMinutes, notes, and location if helpful.",
        "Do not invent missing calendar details. If you cannot safely act, set calendarAction to null and ask one short question.",
        "",
        `Selected intent: ${input.intent}`,
        "",
        buildContextText(input),
        "",
        input.intent === "basic_chat"
            ? "Write a warm, plain-language reply using the user's context."
            : "",
        input.intent === "page_security"
            ? "Focus on whether the page looks safe. Mention concrete page wording or signals."
            : "",
        input.intent === "current_stage"
            ? "Answer with the user's current action stage using the saved task memory."
            : "",
        input.intent === "next_stage"
            ? "Answer with the next action stage using the saved task memory."
            : "",
        input.intent === "calendar_action"
            ? "If there is enough information to create or update a calendar event, include a calendarAction object. Otherwise ask for the missing date or time in one short sentence."
            : "",
    ]
        .filter(Boolean)
        .join("\n");
    try {
        const rawText = await runPrompt(prompt);
        const parsed = safeParseJson(rawText);
        if (parsed?.message && parsed?.summary && parsed?.nextStep && parsed?.explanation) {
            return {
                message: parsed.message,
                summary: parsed.summary,
                nextStep: parsed.nextStep,
                explanation: parsed.explanation,
                riskLevel: parsed.riskLevel || "uncertain",
                suspiciousSignals: Array.isArray(parsed.suspiciousSignals)
                    ? parsed.suspiciousSignals.filter((item) => typeof item === "string")
                    : [],
                calendarAction: parsed.calendarAction ?? null,
            };
        }
    }
    catch {
        // Fallback below.
    }
    return fallbackPlan(input, input.intent);
}
