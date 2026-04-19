import test from "node:test";
import assert from "node:assert/strict";
import { handleNextStepRequest } from "../src/app/api/next-step/route";
import type { NextStepGuidanceInput } from "../src/app/api/next-step/route";

test("Medicare appointments use the hardcoded medicare next-step flow", async () => {
  const request = new Request("http://localhost/api/next-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "What do I do next?",
      appointment: {
        summary: "Medicare enrollment follow-up",
        description: "Review Medicare form details",
        prepNotes: "Bring your Medicare card.",
      },
      taskMemory: {
        current_task: "Preparing for Medicare enrollment",
      },
    }),
  });

  const response = await handleNextStepRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
      },
    },
    orchestrateCopilot: async () => {
      throw new Error("Generic orchestration should not run for Medicare appointments.");
    },
    runBrowserTask: async () => ({ success: true, task_id: "task-123" }),
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    next_step?: string;
    summary?: string;
    explanation?: string;
    browserUse?: { started?: boolean; taskId?: string | null; error?: string | null };
    browserUseTask?: string;
  };

  assert.match(data.next_step || "", /medicare\.gov/i);
  assert.match(data.summary || "", /medicare-related appointment/i);
  assert.match(data.explanation || "", /stop before any submit/i);
  assert.equal(data.browserUse?.started, true);
  assert.equal(data.browserUse?.taskId, "task-123");
  assert.match(data.browserUseTask || "", /medicare\.gov/i);
});

test("non-Medicare appointments still use the generic planner path", async () => {
  const request = new Request("http://localhost/api/next-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "What do I do next?",
      appointment: {
        summary: "Cardiology follow-up with Dr. Martinez",
        description: "Bring your medication list.",
        prepNotes: "Arrive 15 minutes early.",
      },
      taskMemory: {
        current_task: "Reviewing the upcoming cardiology appointment",
      },
    }),
  });

  const response = await handleNextStepRequest(request, {
    userContext: {
      profile: {
        userId: "demo-user-001",
      },
    },
    orchestrateCopilot: async (input: NextStepGuidanceInput) => ({
      mode: "guidance",
      summary: `Generic guidance for ${input.pageTitle || "the current page"}`,
      nextStep: "Keep going with the normal next step.",
      explanation: "This is the non-Medicare fallback path.",
      riskLevel: "safe",
      suspiciousSignals: [],
    }),
    runBrowserTask: async () => ({ success: true, task_id: "should-not-run" }),
  });

  assert.equal(response.status, 200);
  const data = (await response.json()) as {
    next_step?: string;
    summary?: string;
    explanation?: string;
    browserUse?: { started?: boolean };
  };

  assert.match(data.next_step || "", /normal next step/i);
  assert.match(data.summary || "", /generic guidance/i);
  assert.match(data.explanation || "", /non-Medicare fallback path/i);
  assert.equal(data.browserUse, undefined);
});
