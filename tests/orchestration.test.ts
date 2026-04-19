import test from "node:test";
import assert from "node:assert/strict";
import { handleChatRequest } from "../src/app/api/chat/route";
import { handleCopilotRespondRequest } from "../src/app/api/copilot/respond/route";
import { handleScamCheckRequest } from "../src/app/api/scam-check/route";
import { handleMemoryRequest, handleMemoryPostRequest } from "../src/app/api/memory/route";
import { handleTaskFlowGetRequest, handleTaskFlowPostRequest } from "../src/app/api/task-flow/route";

test("chat route answers basic chat with exactly one routing call and one response call", async () => {
  let classifyCalls = 0;
  let planCalls = 0;
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "How are you today?",
      url: "https://example.com",
      pageTitle: "Home",
    }),
  });

  const response = await handleChatRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
        name: "Maria Garcia",
        supportNeeds: [],
        preferences: [],
        conditions: [],
      },
      entries: [],
    },
    classifyChatIntent: async () => {
      classifyCalls += 1;
      return { intent: "basic_chat" as const };
    },
    generateChatPlan: async (input) => {
      planCalls += 1;
      assert.equal(input.intent, "basic_chat");
      return {
        message: "I’m doing well, thanks for asking.",
        summary: "I’m doing well, thanks for asking.",
        nextStep: "Keep chatting if you want.",
        explanation: "A simple friendly reply is enough here.",
        riskLevel: "safe",
        suspiciousSignals: [],
        calendarAction: null,
      };
    },
    persistPreferenceSignals: async () => [],
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    mode?: string;
    message?: string;
    saved_preferences?: string[];
  };

  assert.equal(classifyCalls, 1);
  assert.equal(planCalls, 1);
  assert.equal(data.mode, "chat");
  assert.equal(data.message, "I’m doing well, thanks for asking.");
  assert.deepEqual(data.saved_preferences, []);
});

test("chat route answers page security questions through the same two-step flow", async () => {
  let classifyCalls = 0;
  let planCalls = 0;
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Is this page safe?",
      url: "https://example.com/billing",
      pageTitle: "Urgent account warning",
      visibleText: "Act now to avoid suspension. Enter your password.",
    }),
  });

  const response = await handleChatRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
        name: "Maria Garcia",
        supportNeeds: [],
        preferences: [],
        conditions: [],
      },
      entries: [],
    },
    classifyChatIntent: async () => {
      classifyCalls += 1;
      return { intent: "page_security" as const };
    },
    generateChatPlan: async (input) => {
      planCalls += 1;
      assert.equal(input.intent, "page_security");
      return {
        message: "This page looks risky.",
        summary: "This page looks risky.",
        nextStep: "Do not enter personal information.",
        explanation: "It is asking for sensitive information too quickly.",
        riskLevel: "risky",
        suspiciousSignals: ["Act now", "password"],
        calendarAction: null,
      };
    },
    persistPreferenceSignals: async () => [],
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    mode?: string;
    message?: string;
    riskLevel?: string;
    suspiciousSignals?: string[];
    saved_preferences?: string[];
  };

  assert.equal(classifyCalls, 1);
  assert.equal(planCalls, 1);
  assert.equal(data.mode, "scam_check");
  assert.match(data.message || "", /risky/i);
  assert.equal(data.riskLevel, "risky");
  assert.deepEqual(data.suspiciousSignals, ["Act now", "password"]);
  assert.deepEqual(data.saved_preferences, []);
});

test("chat route answers stage questions without extra LLM hops", async () => {
  let classifyCalls = 0;
  let planCalls = 0;
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "What is my current action stage?",
      url: "https://example.com",
      pageTitle: "Home",
      taskMemory: {
        current_task: "Reviewing the page",
        current_stage_title: "Check the details",
        current_stage_detail: "Read the main instructions carefully.",
        next_stage_title: "Continue if it looks right",
        next_stage_detail: "Move on only if the details match.",
        last_step: "Opened the page.",
      },
    }),
  });

  const response = await handleChatRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
        name: "Maria Garcia",
        supportNeeds: [],
        preferences: [],
        conditions: [],
      },
      entries: [],
    },
    classifyChatIntent: async () => {
      classifyCalls += 1;
      return { intent: "current_stage" as const };
    },
    generateChatPlan: async (input) => {
      planCalls += 1;
      assert.equal(input.intent, "current_stage");
      return {
        message: "Your current stage is Check the details.",
        summary: "Your current stage is Check the details.",
        nextStep: "Read the main instructions carefully.",
        explanation: "Your last step was Opened the page.",
        riskLevel: "safe",
        suspiciousSignals: [],
        calendarAction: null,
      };
    },
    persistPreferenceSignals: async () => [],
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    mode?: string;
    message?: string;
    summary?: string;
  };

  assert.equal(classifyCalls, 1);
  assert.equal(planCalls, 1);
  assert.equal(data.mode, "memory_recall");
  assert.match(data.message || "", /check the details/i);
  assert.match(data.summary || "", /current stage/i);
});

test("chat route can hand off calendar actions without extra model calls", async () => {
  let classifyCalls = 0;
  let planCalls = 0;
  let calendarCalls = 0;
  const request = new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Please add this appointment to my calendar.",
      url: "https://example.com/appointment",
      pageTitle: "Appointment details",
    }),
  });

  const response = await handleChatRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
        name: "Maria Garcia",
        supportNeeds: [],
        preferences: [],
        conditions: [],
      },
      entries: [],
    },
    classifyChatIntent: async () => {
      classifyCalls += 1;
      return { intent: "calendar_action" as const };
    },
    generateChatPlan: async (input) => {
      planCalls += 1;
      assert.equal(input.intent, "calendar_action");
      return {
        message: "I added the appointment to your calendar.",
        summary: "I added the appointment to your calendar.",
        nextStep: "Check your calendar for the new event.",
        explanation: "The event was created successfully.",
        riskLevel: "safe",
        suspiciousSignals: [],
        calendarAction: {
          action: "create",
          title: "Doctor appointment",
          scheduledAt: "2026-04-20T10:00:00.000Z",
          durationMinutes: 30,
          notes: "Bring your insurance card.",
          location: "Clinic",
        },
      };
    },
    runCalendarAction: async (input) => {
      calendarCalls += 1;
      assert.equal(input.action.action, "create");
      return {
        calendarEvent: {
          action: "create",
          eventId: "event-123",
          title: input.action.title || "Doctor appointment",
          scheduledAt: input.action.scheduledAt,
          durationMinutes: input.action.durationMinutes,
        },
        appointment: null,
      };
    },
    persistPreferenceSignals: async () => [],
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    mode?: string;
    message?: string;
    calendarEvent?: { action?: string; eventId?: string };
  };

  assert.equal(classifyCalls, 1);
  assert.equal(planCalls, 1);
  assert.equal(calendarCalls, 1);
  assert.equal(data.mode, "appointment");
  assert.match(data.message || "", /calendar/i);
  assert.equal(data.calendarEvent?.action, "create");
  assert.equal(data.calendarEvent?.eventId, "event-123");
});

test("copilot/respond persists memory updates when the model returns one", async () => {
  const request = new Request("http://localhost/api/copilot/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "guidance",
      query: "What now?",
      url: "https://example.com",
      pageTitle: "Home",
      userId: "demo-user-001",
      taskMemory: {
        current_task: "Reviewing the page",
        last_step: "Opened the page.",
      },
      appointment: {
        summary: "Cardiology follow-up",
      },
    }),
  });

  const response = await handleCopilotRespondRequest(request, {
    userContext: {
      profile: { userId: "demo-user-001" },
    },
    orchestrateCopilot: async () => ({
      mode: "guidance",
      summary: "Generic guidance",
      nextStep: "Keep going.",
      explanation: "Do the safe next step.",
      riskLevel: "safe",
      suspiciousSignals: [],
      memoryUpdate: {
        currentTask: "Reviewing the page",
        lastStep: "Kept the user on track.",
      },
    }),
    persistCopilotMemoryUpdate: async () => ({
      currentTask: "Reviewing the page",
      taskType: "guidance",
      taskGoal: null,
      currentStageIndex: null,
      currentStageTitle: null,
      currentStageDetail: null,
      nextStageTitle: null,
      nextStageDetail: null,
      stagePlan: [],
      status: "active",
      lastStep: "Kept the user on track.",
      currentUrl: "https://example.com",
      pageTitle: "Home",
    }),
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    task_memory?: { currentTask?: string | null; lastStep?: string | null };
  };

  assert.equal(data.task_memory?.currentTask, "Reviewing the page");
  assert.equal(data.task_memory?.lastStep, "Kept the user on track.");
});

test("scam check classifies risky pages and logs the result", async () => {
  const logged: Array<{ user_id: string; classification: string }> = [];
  const request = new Request("http://localhost/api/scam-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://example.com/billing",
      pageTitle: "Urgent account warning",
      content: "Act now to avoid suspension. Enter your password.",
    }),
  });

  const response = await handleScamCheckRequest(request, {
    orchestrateCopilot: async () => ({
      mode: "scam_check",
      summary: "This page looks risky.",
      nextStep: "Do not enter personal information.",
      explanation: "It is asking for sensitive information too quickly.",
      riskLevel: "risky",
      suspiciousSignals: ["Act now", "password"],
    }),
    logScamCheck: async (record) => {
      logged.push({
        user_id: record.user_id,
        classification: record.classification,
      });
    },
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    classification?: string;
    suspicious_signals?: string[];
  };

  assert.equal(data.classification, "risky");
  assert.deepEqual(data.suspicious_signals, ["Act now", "password"]);
  assert.deepEqual(logged, [{ user_id: "demo-user-001", classification: "risky" }]);
});

test("scam check keeps government pages safe even when the model is cautious", async () => {
  const request = new Request("http://localhost/api/scam-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: "https://www.medicare.gov",
      pageTitle: "Welcome to Medicare",
      content: "Protect yourself from Medicare fraud. If you get a message asking for your password, do not share it.",
    }),
  });

  const response = await handleScamCheckRequest(request, {
    orchestrateCopilot: async () => ({
      mode: "scam_check",
      summary: "This page looks risky.",
      nextStep: "Do not enter personal information.",
      explanation: "It mentions fraud and password language.",
      riskLevel: "risky",
      suspiciousSignals: ["fraud", "password"],
    }),
    logScamCheck: async () => {},
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    classification?: string;
    blocked?: boolean;
  };

  assert.equal(data.classification, "safe");
  assert.equal(data.blocked, false);
});

test("memory routes read and write planner state through the injected store", async () => {
  const stored = {
    current_task: "Reviewing the page",
    task_type: "guidance",
    task_goal: "Finish the form later",
    current_stage_index: 1,
    current_stage_title: "Review details",
    current_stage_detail: "Read the key fields.",
    next_stage_title: "Stop before submit",
    next_stage_detail: "Wait before submitting.",
    stage_plan: [{ title: "Review details", detail: "Read the key fields." }],
    status: "active",
    last_step: "Checked the details.",
    current_url: "https://example.com",
    page_title: "Example",
  };

  const getResponse = await handleMemoryRequest(new Request("http://localhost/api/memory"), {
    getTaskMemory: async () => ({
      user_id: "demo-user-001",
      updated_at: new Date().toISOString(),
      ...stored,
    }),
  });

  assert.equal(getResponse.status, 200);
  const snapshot = (await getResponse.json()) as { current_task?: string; next_stage_title?: string };
  assert.equal(snapshot.current_task, "Reviewing the page");
  assert.equal(snapshot.next_stage_title, "Stop before submit");

  let savedUserId = "";
  let savedPatch: Record<string, unknown> | null = null;
  const postResponse = await handleMemoryPostRequest(
    new Request("http://localhost/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "user-123",
        current_task: "Updated task",
        last_step: "Advanced one step.",
      }),
    }),
    {
      updateTaskMemory: async (userId: string, patch: Record<string, unknown>) => {
        savedUserId = userId;
        savedPatch = patch;
      },
    },
  );

  assert.equal(postResponse.status, 200);
  assert.equal(savedUserId, "user-123");
  assert.equal(savedPatch?.["current_task"], "Updated task");
  assert.equal(savedPatch?.["last_step"], "Advanced one step.");
});

test("task flow routes keep stage state and message text in sync", async () => {
  const existingFlow = {
    currentTask: "Reviewing the page",
    taskType: "guidance",
    taskGoal: "Finish the flow",
    currentStageIndex: 0,
    currentStageTitle: "Open the form",
    currentStageDetail: "Find the correct page.",
    nextStageTitle: "Review details",
    nextStageDetail: "Check the fields carefully.",
    stagePlan: [
      { title: "Open the form", detail: "Find the correct page." },
      { title: "Review details", detail: "Check the fields carefully." },
    ],
    status: "active",
    lastStep: "Opened the page.",
    currentUrl: "https://example.com",
    pageTitle: "Example",
  };

  const getResponse = await handleTaskFlowGetRequest({
    getTaskFlow: async () => existingFlow,
  });

  assert.equal(getResponse.status, 200);
  const snapshot = (await getResponse.json()) as { message?: string; current_stage_title?: string };
  assert.match(snapshot.message || "", /stage 1 of 2/i);
  assert.equal(snapshot.current_stage_title, "Open the form");

  const postResponse = await handleTaskFlowPostRequest(
    new Request("http://localhost/api/task-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "advance",
        user_id: "user-123",
      }),
    }),
    {
      getTaskFlow: async () => existingFlow,
      updateTaskFlow: async (_userId, patch) => ({
        currentTask: patch.current_task ?? null,
        taskType: patch.task_type ?? null,
        taskGoal: patch.task_goal ?? null,
        currentStageIndex: patch.current_stage_index ?? null,
        currentStageTitle: patch.current_stage_title ?? null,
        currentStageDetail: patch.current_stage_detail ?? null,
        nextStageTitle: patch.next_stage_title ?? null,
        nextStageDetail: patch.next_stage_detail ?? null,
        stagePlan: Array.isArray(patch.stage_plan) ? patch.stage_plan : [],
        status: patch.status ?? null,
        lastStep: patch.last_step ?? null,
        currentUrl: patch.current_url ?? null,
        pageTitle: patch.page_title ?? null,
      }),
    },
  );

  assert.equal(postResponse.status, 200);
  const saved = (await postResponse.json()) as {
    current_stage_index?: number;
    current_stage_title?: string | null;
    next_stage_title?: string | null;
    message?: string;
  };

  assert.equal(saved.current_stage_index, 1);
  assert.equal(saved.current_stage_title, "Review details");
  assert.equal(saved.next_stage_title, null);
  assert.match(saved.message || "", /stage 2 of 2/i);
});
