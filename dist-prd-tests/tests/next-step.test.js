"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const route_1 = require("../src/app/api/next-step/route");
(0, node_test_1.default)("Medicare appointments use the hardcoded medicare next-step flow", async () => {
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
    const response = await (0, route_1.handleNextStepRequest)(request, {
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.match(data.next_step || "", /medicare\.gov/i);
    strict_1.default.match(data.summary || "", /medicare-related appointment/i);
    strict_1.default.match(data.explanation || "", /stop before any submit/i);
    strict_1.default.equal(data.browserUse?.started, true);
    strict_1.default.equal(data.browserUse?.taskId, "task-123");
    strict_1.default.match(data.browserUseTask || "", /medicare\.gov/i);
});
(0, node_test_1.default)("non-Medicare appointments still use the generic planner path", async () => {
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
    const response = await (0, route_1.handleNextStepRequest)(request, {
        userContext: {
            profile: {
                userId: "demo-user-001",
            },
        },
        orchestrateCopilot: async (input) => ({
            mode: "guidance",
            summary: `Generic guidance for ${input.pageTitle || "the current page"}`,
            nextStep: "Keep going with the normal next step.",
            explanation: "This is the non-Medicare fallback path.",
            riskLevel: "safe",
            suspiciousSignals: [],
        }),
        runBrowserTask: async () => ({ success: true, task_id: "should-not-run" }),
    });
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.match(data.next_step || "", /normal next step/i);
    strict_1.default.match(data.summary || "", /generic guidance/i);
    strict_1.default.match(data.explanation || "", /non-Medicare fallback path/i);
    strict_1.default.equal(data.browserUse, undefined);
});
