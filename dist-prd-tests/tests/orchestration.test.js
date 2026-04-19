"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const route_1 = require("../src/app/api/chat/route");
const route_2 = require("../src/app/api/copilot/respond/route");
const route_3 = require("../src/app/api/scam-check/route");
const route_4 = require("../src/app/api/memory/route");
const route_5 = require("../src/app/api/task-flow/route");
(0, node_test_1.default)("chat route returns planner-aware guidance and persists memory updates", async () => {
    const request = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: "What should I do next?",
            url: "https://example.com/medicare",
            pageTitle: "Medicare help",
            taskMemory: {
                current_task: "Preparing for Medicare",
                last_step: "Opened the Medicare page.",
            },
            appointment: {
                summary: "Medicare enrollment follow-up",
                description: "Review the form",
                prepNotes: "Stop before submitting anything.",
            },
        }),
    });
    const response = await (0, route_1.handleChatRequest)(request, {
        userContext: {
            profile: {
                userId: "demo-user-001",
                name: "Maria Garcia",
                supportNeeds: ["One step at a time"],
                preferences: ["Simple wording"],
                conditions: ["Memory support"],
            },
            entries: [],
        },
        appointment: {
            connected: true,
            summary: "Medicare enrollment follow-up",
            description: "Review the form",
            prepNotes: "Stop before submitting anything.",
        },
        orchestrateCopilot: async () => ({
            mode: "guidance",
            summary: "Here is the next small step.",
            nextStep: "Open the form and review it.",
            explanation: "Stay on the page and check the details carefully.",
            riskLevel: "uncertain",
            suspiciousSignals: ["Form fields"],
            memoryUpdate: {
                currentTask: "Preparing for Medicare",
                lastStep: "Reviewed the page and stopped before submitting.",
            },
        }),
        persistPreferenceSignals: async () => ["Simple wording"],
        persistCopilotMemoryUpdate: async () => ({
            currentTask: "Preparing for Medicare",
            taskType: "appointment-prep",
            taskGoal: "Review the Medicare form",
            currentStageIndex: 0,
            currentStageTitle: "Open the form",
            currentStageDetail: "Find the right Medicare form.",
            nextStageTitle: "Review details",
            nextStageDetail: "Check the fields carefully.",
            stagePlan: [],
            status: "active",
            lastStep: "Reviewed the page and stopped before submitting.",
            currentUrl: "https://example.com/medicare",
            pageTitle: "Medicare help",
        }),
    });
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.match(data.message || "", /next small step/i);
    strict_1.default.deepEqual(data.saved_preferences, ["Simple wording"]);
    strict_1.default.equal(data.task_memory?.currentTask, "Preparing for Medicare");
    strict_1.default.equal(data.task_memory?.lastStep, "Reviewed the page and stopped before submitting.");
    strict_1.default.match(data.reminder?.message || "", /Medicare enrollment follow-up/i);
});
(0, node_test_1.default)("chat route answers casual questions directly without orchestration", async () => {
    let orchestrated = false;
    const request = new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: "How are you today?",
            url: "https://example.com",
            pageTitle: "Home",
        }),
    });
    const response = await (0, route_1.handleChatRequest)(request, {
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
        generateGeneralChatReply: async () => ({
            message: "I’m doing well, thanks for asking.",
        }),
        orchestrateCopilot: async () => {
            orchestrated = true;
            throw new Error("orchestrator should not run for casual chat");
        },
        persistPreferenceSignals: async () => [],
    });
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(orchestrated, false);
    strict_1.default.equal(data.mode, "chat");
    strict_1.default.equal(data.message, "I’m doing well, thanks for asking.");
    strict_1.default.deepEqual(data.saved_preferences, []);
});
(0, node_test_1.default)("copilot/respond persists memory updates when the model returns one", async () => {
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
    const response = await (0, route_2.handleCopilotRespondRequest)(request, {
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(data.task_memory?.currentTask, "Reviewing the page");
    strict_1.default.equal(data.task_memory?.lastStep, "Kept the user on track.");
});
(0, node_test_1.default)("scam check classifies risky pages and logs the result", async () => {
    const logged = [];
    const request = new Request("http://localhost/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: "https://example.com/billing",
            pageTitle: "Urgent account warning",
            content: "Act now to avoid suspension. Enter your password.",
        }),
    });
    const response = await (0, route_3.handleScamCheckRequest)(request, {
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(data.classification, "risky");
    strict_1.default.deepEqual(data.suspicious_signals, ["Act now", "password"]);
    strict_1.default.deepEqual(logged, [{ user_id: "demo-user-001", classification: "risky" }]);
});
(0, node_test_1.default)("memory routes read and write planner state through the injected store", async () => {
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
    const getResponse = await (0, route_4.handleMemoryRequest)(new Request("http://localhost/api/memory"), {
        getTaskMemory: async () => ({
            user_id: "demo-user-001",
            updated_at: new Date().toISOString(),
            ...stored,
        }),
    });
    strict_1.default.equal(getResponse.status, 200);
    const snapshot = (await getResponse.json());
    strict_1.default.equal(snapshot.current_task, "Reviewing the page");
    strict_1.default.equal(snapshot.next_stage_title, "Stop before submit");
    let savedUserId = "";
    let savedPatch = null;
    const postResponse = await (0, route_4.handleMemoryPostRequest)(new Request("http://localhost/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: "user-123",
            current_task: "Updated task",
            last_step: "Advanced one step.",
        }),
    }), {
        updateTaskMemory: async (userId, patch) => {
            savedUserId = userId;
            savedPatch = patch;
        },
    });
    strict_1.default.equal(postResponse.status, 200);
    strict_1.default.equal(savedUserId, "user-123");
    strict_1.default.equal(savedPatch?.["current_task"], "Updated task");
    strict_1.default.equal(savedPatch?.["last_step"], "Advanced one step.");
});
(0, node_test_1.default)("task flow routes keep stage state and message text in sync", async () => {
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
    const getResponse = await (0, route_5.handleTaskFlowGetRequest)({
        getTaskFlow: async () => existingFlow,
    });
    strict_1.default.equal(getResponse.status, 200);
    const snapshot = (await getResponse.json());
    strict_1.default.match(snapshot.message || "", /stage 1 of 2/i);
    strict_1.default.equal(snapshot.current_stage_title, "Open the form");
    const postResponse = await (0, route_5.handleTaskFlowPostRequest)(new Request("http://localhost/api/task-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "advance",
            user_id: "user-123",
        }),
    }), {
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
    });
    strict_1.default.equal(postResponse.status, 200);
    const saved = (await postResponse.json());
    strict_1.default.equal(saved.current_stage_index, 1);
    strict_1.default.equal(saved.current_stage_title, "Review details");
    strict_1.default.equal(saved.next_stage_title, null);
    strict_1.default.match(saved.message || "", /stage 2 of 2/i);
});
