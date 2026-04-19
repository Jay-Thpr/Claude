"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const intent_router_1 = require("../src/lib/intent-router");
const safety_rules_1 = require("../src/lib/safety-rules");
const route_1 = require("../src/app/api/orient/route");
const route_2 = require("../src/app/api/gcal/upcoming/route");
const route_3 = require("../src/app/api/task/start/route");
const route_4 = require("../src/app/api/task/step/route");
// ---------------------------------------------------------------------------
// intent-router
// ---------------------------------------------------------------------------
(0, node_test_1.default)("routeIntent sends scam keywords to scam_check", () => {
    strict_1.default.equal((0, intent_router_1.routeIntent)({ mode: "auto", query: "is this page a scam?", url: "https://example.com" }), "scam_check");
});
(0, node_test_1.default)("routeIntent sends appointment keywords to appointment", () => {
    strict_1.default.equal((0, intent_router_1.routeIntent)({ mode: "auto", query: "I have a doctor appointment", url: "https://example.com" }), "appointment");
});
(0, node_test_1.default)("routeIntent sends memory keywords to memory_recall", () => {
    strict_1.default.equal((0, intent_router_1.routeIntent)({ mode: "auto", query: "what was I doing?", url: "https://example.com" }), "memory_recall");
});
(0, node_test_1.default)("routeIntent falls back to guidance for generic queries", () => {
    strict_1.default.equal((0, intent_router_1.routeIntent)({ mode: "auto", query: "hello", url: "https://example.com" }), "guidance");
});
(0, node_test_1.default)("routeIntent respects explicit mode override", () => {
    strict_1.default.equal((0, intent_router_1.routeIntent)({ mode: "scam_check", query: "hello", url: "https://example.com" }), "scam_check");
});
(0, node_test_1.default)("shouldUseBrowserUse returns false for scam_check intent", () => {
    const input = { mode: "auto", query: "fill out this form", url: "https://example.com" };
    strict_1.default.equal((0, intent_router_1.shouldUseBrowserUse)(input, "scam_check"), false);
});
(0, node_test_1.default)("shouldUseBrowserUse returns true for action verbs in query", () => {
    const input = { mode: "auto", query: "click next and sign in", url: "https://example.com" };
    strict_1.default.equal((0, intent_router_1.shouldUseBrowserUse)(input, "guidance"), true);
});
// ---------------------------------------------------------------------------
// safety-rules
// ---------------------------------------------------------------------------
(0, node_test_1.default)("assessRiskLevel marks urgent payment pages as risky", () => {
    strict_1.default.equal((0, safety_rules_1.assessRiskLevel)("URGENT: your account is suspended. Enter your credit card now."), "risky");
});
(0, node_test_1.default)("assessRiskLevel marks login pages as uncertain", () => {
    const level = (0, safety_rules_1.assessRiskLevel)("Please enter your username and password to continue.");
    strict_1.default.ok(level === "uncertain" || level === "risky");
});
(0, node_test_1.default)("assessRiskLevel marks plain news articles as safe", () => {
    strict_1.default.equal((0, safety_rules_1.assessRiskLevel)("The weather today is sunny with a high of 72 degrees."), "safe");
});
(0, node_test_1.default)("extractSuspiciousSignals finds pressure phrases", () => {
    const signals = (0, safety_rules_1.extractSuspiciousSignals)("Act now or your account will be deleted!");
    strict_1.default.ok(signals.length > 0, "Expected at least one suspicious signal");
});
(0, node_test_1.default)("extractSuspiciousSignals returns empty for safe text", () => {
    const signals = (0, safety_rules_1.extractSuspiciousSignals)("Today is a sunny day in the park.");
    strict_1.default.equal(signals.length, 0);
});
// ---------------------------------------------------------------------------
// orient route
// ---------------------------------------------------------------------------
function makeOrientRequest(body) {
    return new Request("http://localhost/api/orient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
function disconnectedSnapshot() {
    return { connected: false, profile: null, nextAppointment: null, upcomingAppointments: [], message: "", source: "none" };
}
(0, node_test_1.default)("orient: safe page returns safetyTone=safe and autoOpen=false", async () => {
    const res = await (0, route_1.handleOrientRequest)(makeOrientRequest({ url: "https://nytimes.com/article/weather", pageTitle: "Today's Weather" }), { loadCalendarSnapshot: async () => disconnectedSnapshot() });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.safetyTone, "safe");
    strict_1.default.equal(data.autoOpen, false);
});
(0, node_test_1.default)("orient: risky page sets autoOpen=true and proactiveTip mentions danger", async () => {
    const res = await (0, route_1.handleOrientRequest)(makeOrientRequest({
        url: "https://fake-bank.com/billing",
        pageTitle: "URGENT: account suspended",
        pageText: "Act now! Enter your password and credit card to avoid suspension.",
    }), { loadCalendarSnapshot: async () => disconnectedSnapshot() });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.safetyTone, "risky");
    strict_1.default.equal(data.autoOpen, true);
    strict_1.default.ok(data.proactiveTip !== null, "Expected a proactive tip for risky page");
    strict_1.default.ok(data.suggestedActions.some((a) => /leave/i.test(a)), "Expected a leave action");
});
(0, node_test_1.default)("orient: ongoing task on same hostname triggers autoOpen and continuation tip", async () => {
    const res = await (0, route_1.handleOrientRequest)(makeOrientRequest({
        url: "https://myhealth.ucsd.edu/portal",
        pageTitle: "MyChart",
        taskMemory: {
            currentTask: "Refill my prescription",
            currentUrl: "https://myhealth.ucsd.edu/appointments",
        },
    }), { loadCalendarSnapshot: async () => disconnectedSnapshot() });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.autoOpen, true);
    strict_1.default.match(data.proactiveTip ?? "", /refill my prescription/i);
});
(0, node_test_1.default)("orient: no calendar connection means no appointment-based autoOpen", async () => {
    const res = await (0, route_1.handleOrientRequest)(makeOrientRequest({ url: "https://example.com", pageTitle: "Home" }), { loadCalendarSnapshot: async () => disconnectedSnapshot() });
    const data = await res.json();
    strict_1.default.equal(data.autoOpen, false);
});
(0, node_test_1.default)("orient: malformed request body returns safe default", async () => {
    const res = await (0, route_1.handleOrientRequest)(new Request("http://localhost/api/orient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
    }), { loadCalendarSnapshot: async () => disconnectedSnapshot() });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.safetyTone, "safe");
    strict_1.default.equal(data.autoOpen, false);
});
// ---------------------------------------------------------------------------
// gcal/upcoming route
// ---------------------------------------------------------------------------
(0, node_test_1.default)("gcal/upcoming: returns empty list when calendar not connected", async () => {
    const res = await (0, route_2.handleGCalUpcomingRequest)({
        loadCalendarSnapshot: async () => disconnectedSnapshot(),
    });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.connected, false);
    strict_1.default.deepEqual(data.appointments, []);
});
(0, node_test_1.default)("gcal/upcoming: filters appointments beyond 4 hours", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour away
    const far = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours away
    const snapshot = {
        connected: true,
        profile: null,
        message: "",
        source: "google-calendar",
        nextAppointment: null,
        upcomingAppointments: [
            { id: "1", summary: "Doctor visit", start: soon, whenLabel: "today", timeLabel: "soon" },
            { id: "2", summary: "Dinner with family", start: far, whenLabel: "today", timeLabel: "later" },
        ],
    };
    const res = await (0, route_2.handleGCalUpcomingRequest)({ loadCalendarSnapshot: async () => snapshot });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.connected, true);
    strict_1.default.equal(data.appointments.length, 1);
    strict_1.default.equal(data.appointments[0].summary, "Doctor visit");
    strict_1.default.ok(data.appointments[0].minutesUntil > 0 && data.appointments[0].minutesUntil <= 240);
});
(0, node_test_1.default)("gcal/upcoming: includes all appointments within 4 hours", async () => {
    const t1 = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const t2 = new Date(Date.now() + 90 * 60 * 1000).toISOString();
    const snapshot = {
        connected: true,
        profile: null,
        message: "",
        source: "google-calendar",
        nextAppointment: null,
        upcomingAppointments: [
            { id: "1", summary: "Lab work", start: t1, whenLabel: "today", timeLabel: "soon" },
            { id: "2", summary: "Follow-up", start: t2, whenLabel: "today", timeLabel: "later" },
        ],
    };
    const res = await (0, route_2.handleGCalUpcomingRequest)({ loadCalendarSnapshot: async () => snapshot });
    const data = await res.json();
    strict_1.default.equal(data.appointments.length, 2);
});
(0, node_test_1.default)("gcal/upcoming: handles loadCalendarSnapshot throwing", async () => {
    const res = await (0, route_2.handleGCalUpcomingRequest)({
        loadCalendarSnapshot: async () => { throw new Error("network failure"); },
    });
    const data = await res.json();
    strict_1.default.equal(data.connected, false);
});
// ---------------------------------------------------------------------------
// task/start route
// ---------------------------------------------------------------------------
function makeTaskStartRequest(body) {
    return new Request("http://localhost/api/task/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
(0, node_test_1.default)("task/start: uses fallback plan when Anthropic throws", async () => {
    const res = await (0, route_3.handleTaskStartRequest)(makeTaskStartRequest({ intent: "refill my prescription", url: "https://myhealth.ucsd.edu" }), { runAnthropicPrompt: async () => { throw new Error("no API key"); } });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.ok(data.steps.length >= 1);
    strict_1.default.ok(data.announcement.length > 0);
    strict_1.default.equal(data.totalSteps, data.steps.length);
});
(0, node_test_1.default)("task/start: parses valid Anthropic JSON response into step plan", async () => {
    const anthropicResponse = JSON.stringify({
        steps: [
            { index: 0, instruction: "Click 'Refill'", voiceAnnouncement: "First, find the Refill button." },
            { index: 1, instruction: "Select your medication", voiceAnnouncement: "Now choose which medication to refill." },
            { index: 2, instruction: "Confirm the order", voiceAnnouncement: "Finally, press Confirm." },
        ],
        openingAnnouncement: "Let's refill your prescription together.",
    });
    const res = await (0, route_3.handleTaskStartRequest)(makeTaskStartRequest({ intent: "refill my prescription", url: "https://myhealth.ucsd.edu" }), { runAnthropicPrompt: async () => anthropicResponse });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.totalSteps, 3);
    strict_1.default.equal(data.steps[0].instruction, "Click 'Refill'");
    strict_1.default.match(data.announcement, /refill your prescription/i);
});
(0, node_test_1.default)("task/start: falls back when Anthropic returns malformed JSON", async () => {
    const res = await (0, route_3.handleTaskStartRequest)(makeTaskStartRequest({ intent: "check my messages", url: "https://myhealth.ucsd.edu" }), { runAnthropicPrompt: async () => "Sorry, I cannot help with that right now." });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.ok(data.steps.length >= 1);
});
(0, node_test_1.default)("task/start: falls back when intent or url is missing", async () => {
    const res = await (0, route_3.handleTaskStartRequest)(makeTaskStartRequest({ url: "https://example.com" }), { runAnthropicPrompt: async () => { throw new Error("should not be called"); } });
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.ok(data.steps.length >= 1);
});
// ---------------------------------------------------------------------------
// task/step route (pure state machine — no external deps)
// ---------------------------------------------------------------------------
const SAMPLE_STEPS = [
    { index: 0, instruction: "Click 'Sign In'", voiceAnnouncement: "First, click the Sign In button." },
    { index: 1, instruction: "Enter your username", voiceAnnouncement: "Now type your username." },
    { index: 2, instruction: "Click 'Submit'", voiceAnnouncement: "Finally, click Submit." },
];
function makeTaskStepRequest(body) {
    return new Request("http://localhost/api/task/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
(0, node_test_1.default)("task/step: stop word ends the task immediately", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: SAMPLE_STEPS,
        currentStepIndex: 0,
        userResponse: "stop",
        url: "https://example.com",
    }));
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.done, true);
    strict_1.default.match(data.announcement, /stop/i);
});
(0, node_test_1.default)("task/step: 'no' is treated as a stop word", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: SAMPLE_STEPS,
        currentStepIndex: 1,
        userResponse: "no",
        url: "https://example.com",
    }));
    const data = await res.json();
    strict_1.default.equal(data.done, true);
});
(0, node_test_1.default)("task/step: completing the last step marks done and announces success", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: SAMPLE_STEPS,
        currentStepIndex: 2,
        userResponse: "ok done",
        url: "https://example.com",
    }));
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.done, true);
    strict_1.default.match(data.announcement, /done/i);
    strict_1.default.equal(data.memoryUpdate?.currentTask, "Completed task");
});
(0, node_test_1.default)("task/step: mid-task response advances to next step", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: SAMPLE_STEPS,
        currentStepIndex: 0,
        userResponse: "ok I clicked it",
        url: "https://example.com",
    }));
    strict_1.default.equal(res.status, 200);
    const data = await res.json();
    strict_1.default.equal(data.done, false);
    strict_1.default.equal(data.nextStepIndex, 1);
    strict_1.default.match(data.announcement, /username/i);
    strict_1.default.match(data.instruction, /username/i);
    strict_1.default.match(data.memoryUpdate?.lastStep ?? "", /sign in/i);
});
(0, node_test_1.default)("task/step: empty steps array returns done immediately", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: [],
        currentStepIndex: 0,
        userResponse: "hello",
        url: "https://example.com",
    }));
    const data = await res.json();
    strict_1.default.equal(data.done, true);
});
(0, node_test_1.default)("task/step: out-of-bounds index is clamped to last step", async () => {
    const res = await (0, route_4.POST)(makeTaskStepRequest({
        steps: SAMPLE_STEPS,
        currentStepIndex: 99,
        userResponse: "ok",
        url: "https://example.com",
    }));
    const data = await res.json();
    strict_1.default.equal(data.done, true);
});
