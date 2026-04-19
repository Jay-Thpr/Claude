import test from "node:test";
import assert from "node:assert/strict";
import { routeIntent, shouldUseBrowserUse } from "../src/lib/intent-router";
import { assessRiskLevel, extractSuspiciousSignals } from "../src/lib/safety-rules";
import { handleOrientRequest } from "../src/app/api/orient/route";
import { handleGCalUpcomingRequest } from "../src/app/api/gcal/upcoming/route";
import { handleTaskStartRequest } from "../src/app/api/task/start/route";
import { POST as taskStepPOST } from "../src/app/api/task/step/route";
import type { CalendarSnapshot } from "../src/lib/gcal";

// ---------------------------------------------------------------------------
// intent-router
// ---------------------------------------------------------------------------

test("routeIntent sends scam keywords to scam_check", () => {
  assert.equal(
    routeIntent({ mode: "auto", query: "is this page a scam?", url: "https://example.com" }),
    "scam_check",
  );
});

test("routeIntent sends appointment keywords to appointment", () => {
  assert.equal(
    routeIntent({ mode: "auto", query: "I have a doctor appointment", url: "https://example.com" }),
    "appointment",
  );
});

test("routeIntent sends memory keywords to memory_recall", () => {
  assert.equal(
    routeIntent({ mode: "auto", query: "what was I doing?", url: "https://example.com" }),
    "memory_recall",
  );
});

test("routeIntent falls back to guidance for generic queries", () => {
  assert.equal(
    routeIntent({ mode: "auto", query: "hello", url: "https://example.com" }),
    "guidance",
  );
});

test("routeIntent respects explicit mode override", () => {
  assert.equal(
    routeIntent({ mode: "scam_check", query: "hello", url: "https://example.com" }),
    "scam_check",
  );
});

test("shouldUseBrowserUse returns false for scam_check intent", () => {
  const input = { mode: "auto" as const, query: "fill out this form", url: "https://example.com" };
  assert.equal(shouldUseBrowserUse(input, "scam_check"), false);
});

test("shouldUseBrowserUse returns true for action verbs in query", () => {
  const input = { mode: "auto" as const, query: "click next and sign in", url: "https://example.com" };
  assert.equal(shouldUseBrowserUse(input, "guidance"), true);
});

// ---------------------------------------------------------------------------
// safety-rules
// ---------------------------------------------------------------------------

test("assessRiskLevel marks urgent payment pages as risky", () => {
  assert.equal(
    assessRiskLevel("URGENT: your account is suspended. Enter your credit card now."),
    "risky",
  );
});

test("assessRiskLevel marks login pages as uncertain", () => {
  const level = assessRiskLevel("Please enter your username and password to continue.");
  assert.ok(level === "uncertain" || level === "risky");
});

test("assessRiskLevel marks plain news articles as safe", () => {
  assert.equal(
    assessRiskLevel("The weather today is sunny with a high of 72 degrees."),
    "safe",
  );
});

test("extractSuspiciousSignals finds pressure phrases", () => {
  const signals = extractSuspiciousSignals("Act now or your account will be deleted!");
  assert.ok(signals.length > 0, "Expected at least one suspicious signal");
});

test("extractSuspiciousSignals returns empty for safe text", () => {
  const signals = extractSuspiciousSignals("Today is a sunny day in the park.");
  assert.equal(signals.length, 0);
});

// ---------------------------------------------------------------------------
// orient route
// ---------------------------------------------------------------------------

function makeOrientRequest(body: object): Request {
  return new Request("http://localhost/api/orient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function disconnectedSnapshot(): CalendarSnapshot {
  return { connected: false, profile: null, nextAppointment: null, upcomingAppointments: [], message: "", source: "none" };
}

test("orient: safe page returns safetyTone=safe and autoOpen=false", async () => {
  const res = await handleOrientRequest(
    makeOrientRequest({ url: "https://nytimes.com/article/weather", pageTitle: "Today's Weather" }),
    { loadCalendarSnapshot: async () => disconnectedSnapshot() },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { safetyTone: string; autoOpen: boolean };
  assert.equal(data.safetyTone, "safe");
  assert.equal(data.autoOpen, false);
});

test("orient: risky page sets autoOpen=true and proactiveTip mentions danger", async () => {
  const res = await handleOrientRequest(
    makeOrientRequest({
      url: "https://fake-bank.com/billing",
      pageTitle: "URGENT: account suspended",
      pageText: "Act now! Enter your password and credit card to avoid suspension.",
    }),
    { loadCalendarSnapshot: async () => disconnectedSnapshot() },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { safetyTone: string; autoOpen: boolean; proactiveTip: string | null; suggestedActions: string[] };
  assert.equal(data.safetyTone, "risky");
  assert.equal(data.autoOpen, true);
  assert.ok(data.proactiveTip !== null, "Expected a proactive tip for risky page");
  assert.ok(data.suggestedActions.some((a) => /leave/i.test(a)), "Expected a leave action");
});

test("orient: ongoing task on same hostname triggers autoOpen and continuation tip", async () => {
  const res = await handleOrientRequest(
    makeOrientRequest({
      url: "https://myhealth.ucsd.edu/portal",
      pageTitle: "MyChart",
      taskMemory: {
        currentTask: "Refill my prescription",
        currentUrl: "https://myhealth.ucsd.edu/appointments",
      },
    }),
    { loadCalendarSnapshot: async () => disconnectedSnapshot() },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { autoOpen: boolean; proactiveTip: string | null };
  assert.equal(data.autoOpen, true);
  assert.match(data.proactiveTip ?? "", /refill my prescription/i);
});

test("orient: no calendar connection means no appointment-based autoOpen", async () => {
  const res = await handleOrientRequest(
    makeOrientRequest({ url: "https://example.com", pageTitle: "Home" }),
    { loadCalendarSnapshot: async () => disconnectedSnapshot() },
  );
  const data = await res.json() as { autoOpen: boolean };
  assert.equal(data.autoOpen, false);
});

test("orient: malformed request body returns safe default", async () => {
  const res = await handleOrientRequest(
    new Request("http://localhost/api/orient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    }),
    { loadCalendarSnapshot: async () => disconnectedSnapshot() },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { safetyTone: string; autoOpen: boolean };
  assert.equal(data.safetyTone, "safe");
  assert.equal(data.autoOpen, false);
});

// ---------------------------------------------------------------------------
// gcal/upcoming route
// ---------------------------------------------------------------------------

test("gcal/upcoming: returns empty list when calendar not connected", async () => {
  const res = await handleGCalUpcomingRequest({
    loadCalendarSnapshot: async () => disconnectedSnapshot(),
  });
  assert.equal(res.status, 200);
  const data = await res.json() as { connected: boolean; appointments: unknown[] };
  assert.equal(data.connected, false);
  assert.deepEqual(data.appointments, []);
});

test("gcal/upcoming: filters appointments beyond 4 hours", async () => {
  const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour away
  const far = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(); // 5 hours away

  const snapshot: CalendarSnapshot = {
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

  const res = await handleGCalUpcomingRequest({ loadCalendarSnapshot: async () => snapshot });
  assert.equal(res.status, 200);
  const data = await res.json() as { connected: boolean; appointments: Array<{ summary: string; minutesUntil: number }> };
  assert.equal(data.connected, true);
  assert.equal(data.appointments.length, 1);
  assert.equal(data.appointments[0].summary, "Doctor visit");
  assert.ok(data.appointments[0].minutesUntil > 0 && data.appointments[0].minutesUntil <= 240);
});

test("gcal/upcoming: includes all appointments within 4 hours", async () => {
  const t1 = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const t2 = new Date(Date.now() + 90 * 60 * 1000).toISOString();

  const snapshot: CalendarSnapshot = {
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

  const res = await handleGCalUpcomingRequest({ loadCalendarSnapshot: async () => snapshot });
  const data = await res.json() as { appointments: Array<{ summary: string }> };
  assert.equal(data.appointments.length, 2);
});

test("gcal/upcoming: handles loadCalendarSnapshot throwing", async () => {
  const res = await handleGCalUpcomingRequest({
    loadCalendarSnapshot: async () => { throw new Error("network failure"); },
  });
  const data = await res.json() as { connected: boolean };
  assert.equal(data.connected, false);
});

// ---------------------------------------------------------------------------
// task/start route
// ---------------------------------------------------------------------------

function makeTaskStartRequest(body: object): Request {
  return new Request("http://localhost/api/task/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("task/start: uses fallback plan when Gemini throws", async () => {
  const res = await handleTaskStartRequest(
    makeTaskStartRequest({ intent: "refill my prescription", url: "https://myhealth.ucsd.edu" }),
    { runGeminiPrompt: async () => { throw new Error("no API key"); } },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { steps: unknown[]; announcement: string; totalSteps: number };
  assert.ok(data.steps.length >= 1);
  assert.ok(data.announcement.length > 0);
  assert.equal(data.totalSteps, data.steps.length);
});

test("task/start: parses valid Gemini JSON response into step plan", async () => {
  const geminiResponse = JSON.stringify({
    steps: [
      { index: 0, instruction: "Click 'Refill'", voiceAnnouncement: "First, find the Refill button." },
      { index: 1, instruction: "Select your medication", voiceAnnouncement: "Now choose which medication to refill." },
      { index: 2, instruction: "Confirm the order", voiceAnnouncement: "Finally, press Confirm." },
    ],
    openingAnnouncement: "Let's refill your prescription together.",
  });

  const res = await handleTaskStartRequest(
    makeTaskStartRequest({ intent: "refill my prescription", url: "https://myhealth.ucsd.edu" }),
    { runGeminiPrompt: async () => geminiResponse },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { steps: Array<{ instruction: string }>; announcement: string; totalSteps: number };
  assert.equal(data.totalSteps, 3);
  assert.equal(data.steps[0].instruction, "Click 'Refill'");
  assert.match(data.announcement, /refill your prescription/i);
});

test("task/start: falls back when Gemini returns malformed JSON", async () => {
  const res = await handleTaskStartRequest(
    makeTaskStartRequest({ intent: "check my messages", url: "https://myhealth.ucsd.edu" }),
    { runGeminiPrompt: async () => "Sorry, I cannot help with that right now." },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { steps: unknown[] };
  assert.ok(data.steps.length >= 1);
});

test("task/start: falls back when intent or url is missing", async () => {
  const res = await handleTaskStartRequest(
    makeTaskStartRequest({ url: "https://example.com" }),
    { runGeminiPrompt: async () => { throw new Error("should not be called"); } },
  );
  assert.equal(res.status, 200);
  const data = await res.json() as { steps: unknown[] };
  assert.ok(data.steps.length >= 1);
});

// ---------------------------------------------------------------------------
// task/step route (pure state machine — no external deps)
// ---------------------------------------------------------------------------

const SAMPLE_STEPS = [
  { index: 0, instruction: "Click 'Sign In'", voiceAnnouncement: "First, click the Sign In button." },
  { index: 1, instruction: "Enter your username", voiceAnnouncement: "Now type your username." },
  { index: 2, instruction: "Click 'Submit'", voiceAnnouncement: "Finally, click Submit." },
];

function makeTaskStepRequest(body: object): Request {
  return new Request("http://localhost/api/task/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("task/step: stop word ends the task immediately", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: SAMPLE_STEPS,
    currentStepIndex: 0,
    userResponse: "stop",
    url: "https://example.com",
  }));
  assert.equal(res.status, 200);
  const data = await res.json() as { done: boolean; announcement: string };
  assert.equal(data.done, true);
  assert.match(data.announcement, /stop/i);
});

test("task/step: 'no' is treated as a stop word", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: SAMPLE_STEPS,
    currentStepIndex: 1,
    userResponse: "no",
    url: "https://example.com",
  }));
  const data = await res.json() as { done: boolean };
  assert.equal(data.done, true);
});

test("task/step: completing the last step marks done and announces success", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: SAMPLE_STEPS,
    currentStepIndex: 2,
    userResponse: "ok done",
    url: "https://example.com",
  }));
  assert.equal(res.status, 200);
  const data = await res.json() as { done: boolean; announcement: string; memoryUpdate?: { currentTask: string } };
  assert.equal(data.done, true);
  assert.match(data.announcement, /done/i);
  assert.equal(data.memoryUpdate?.currentTask, "Completed task");
});

test("task/step: mid-task response advances to next step", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: SAMPLE_STEPS,
    currentStepIndex: 0,
    userResponse: "ok I clicked it",
    url: "https://example.com",
  }));
  assert.equal(res.status, 200);
  const data = await res.json() as {
    done: boolean;
    nextStepIndex: number;
    announcement: string;
    instruction: string;
    memoryUpdate?: { lastStep: string };
  };
  assert.equal(data.done, false);
  assert.equal(data.nextStepIndex, 1);
  assert.match(data.announcement, /username/i);
  assert.match(data.instruction, /username/i);
  assert.match(data.memoryUpdate?.lastStep ?? "", /sign in/i);
});

test("task/step: empty steps array returns done immediately", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: [],
    currentStepIndex: 0,
    userResponse: "hello",
    url: "https://example.com",
  }));
  const data = await res.json() as { done: boolean };
  assert.equal(data.done, true);
});

test("task/step: out-of-bounds index is clamped to last step", async () => {
  const res = await taskStepPOST(makeTaskStepRequest({
    steps: SAMPLE_STEPS,
    currentStepIndex: 99,
    userResponse: "ok",
    url: "https://example.com",
  }));
  const data = await res.json() as { done: boolean };
  assert.equal(data.done, true);
});
