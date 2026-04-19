"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTaskStartRequest = handleTaskStartRequest;
exports.POST = POST;
const generative_ai_1 = require("@google/generative-ai");
const FALLBACK_MODELS = [
    process.env.SAFESTEP_GEMINI_MODEL || "gemini-2.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.1-flash-lite-preview",
];
function getAnthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY;
}
function buildGenAI() {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey);
}
async function runAnthropicPrompt(prompt) {
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
    throw lastError || new Error("Unable to reach Anthropic.");
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
function buildFallbackPlan(intent) {
    const steps = [
        {
            index: 0,
            instruction: "Look for the button or link that matches what you need.",
            voiceAnnouncement: "Let's take this one step at a time. First, look for the button or link that matches what you're trying to do.",
            pageSummary: "The page is waiting for the first button or link you need.",
            nextButton: "Look for the main button or link that matches your goal.",
        },
        {
            index: 1,
            instruction: "Click it and I'll check if it worked.",
            voiceAnnouncement: "When you find it, go ahead and click it. I'll be right here to help with the next step.",
            pageSummary: "The next page should confirm whether the action worked.",
            nextButton: "Press the button that confirms or continues the task.",
        },
    ];
    return {
        steps,
        announcement: `I'll help you with: ${intent}. Let's take it one small step at a time.`,
        totalSteps: steps.length,
    };
}
function buildPrompt(body) {
    const appointmentContext = body.appointment?.summary
        ? `Appointment context: ${body.appointment.summary}${body.appointment.whenLabel ? ` (${body.appointment.whenLabel})` : ""}${body.appointment.location ? ` at ${body.appointment.location}` : ""}.`
        : "No appointment context.";
    const pageContext = [
        body.pageTitle ? `Page title: ${body.pageTitle}` : null,
        body.pageSummary ? `Page summary: ${body.pageSummary}` : null,
        body.visibleText ? `Visible text: ${body.visibleText}` : null,
    ]
        .filter(Boolean)
        .join("\n");
    return `You are SafeStep, a browser assistant for elderly adults with dementia.
The user wants to: ${body.intent}
They are currently on: ${body.url}${body.pageTitle ? ` (${body.pageTitle})` : ""}
${appointmentContext}
${pageContext}

Create a step-by-step plan (3-7 steps) to help them accomplish this.
Each step must be very simple — one small action.
Use plain, friendly language as if you are speaking to an elderly person.
Treat each step like the user has moved onto a new page.
For every step, include:
- pageSummary: one short sentence describing what the page shows right now.
- nextButton: the exact next button or link label to press, if you can see it.
- instruction: one tiny action to take.
- voiceAnnouncement: one or two short spoken sentences.
- Keep the wording calm and specific. Mention the actual button or link if it is visible.
- If a next button is not obvious, describe what to look for instead.

Return valid JSON only — no extra text, no markdown code fences:
{
  "steps": [
    {
      "index": 0,
      "instruction": "Click the button that says 'Sign In'",
      "voiceAnnouncement": "First, let's sign in to your account. Look for a button that says Sign In.",
      "pageSummary": "The page is asking you to sign in.",
      "nextButton": "Sign In"
    }
  ],
  "openingAnnouncement": "I'll help you refill your prescription. We'll do this together, step by step."
}`;
}
async function handleTaskStartRequest(request, deps = {}) {
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return Response.json(buildFallbackPlan("your task"));
    }
    if (!body.intent || !body.url) {
        return Response.json(buildFallbackPlan(body.intent || "your task"));
    }
    const anthropic = deps.runAnthropicPrompt ?? deps.runGeminiPrompt ?? runAnthropicPrompt;
    try {
        const prompt = buildPrompt(body);
        const rawText = await anthropic(prompt);
        const parsed = safeParseJson(rawText);
        if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
            return Response.json(buildFallbackPlan(body.intent));
        }
        const steps = parsed.steps
            .slice(0, 7)
            .map((s, i) => ({
            index: typeof s.index === "number" ? s.index : i,
            instruction: s.instruction || `Step ${i + 1}`,
            voiceAnnouncement: s.voiceAnnouncement || `Now, ${s.instruction || `do step ${i + 1}`}.`,
            pageSummary: s.pageSummary ||
                body.pageSummary ||
                body.pageTitle ||
                `This is the current page for step ${i + 1}.`,
            nextButton: s.nextButton || "Look for the next button or link on the page.",
        }));
        const result = {
            steps,
            announcement: parsed.openingAnnouncement ||
                `I'll help you with: ${body.intent}. We'll do this together, step by step.`,
            totalSteps: steps.length,
        };
        return Response.json(result);
    }
    catch {
        return Response.json(buildFallbackPlan(body.intent));
    }
}
async function POST(request) {
    return handleTaskStartRequest(request);
}
