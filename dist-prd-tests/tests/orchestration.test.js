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
(0, node_test_1.default)("chat route answers basic chat with exactly one routing call and one response call", async () => {
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
        classifyChatIntent: async () => {
            classifyCalls += 1;
            return { intent: "basic_chat" };
        },
        generateChatPlan: async (input) => {
            planCalls += 1;
            strict_1.default.equal(input.intent, "basic_chat");
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(classifyCalls, 1);
    strict_1.default.equal(planCalls, 1);
    strict_1.default.equal(data.mode, "chat");
    strict_1.default.equal(data.message, "I’m doing well, thanks for asking.");
    strict_1.default.deepEqual(data.saved_preferences, []);
});
(0, node_test_1.default)("chat route answers page security questions through the same two-step flow", async () => {
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
        classifyChatIntent: async () => {
            classifyCalls += 1;
            return { intent: "page_security" };
        },
        generateChatPlan: async (input) => {
            planCalls += 1;
            strict_1.default.equal(input.intent, "page_security");
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(classifyCalls, 1);
    strict_1.default.equal(planCalls, 1);
    strict_1.default.equal(data.mode, "scam_check");
    strict_1.default.match(data.message || "", /risky/i);
    strict_1.default.equal(data.riskLevel, "risky");
    strict_1.default.deepEqual(data.suspiciousSignals, ["Act now", "password"]);
    strict_1.default.deepEqual(data.saved_preferences, []);
});
(0, node_test_1.default)("chat route answers stage questions without extra LLM hops", async () => {
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
        classifyChatIntent: async () => {
            classifyCalls += 1;
            return { intent: "current_stage" };
        },
        generateChatPlan: async (input) => {
            planCalls += 1;
            strict_1.default.equal(input.intent, "current_stage");
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(classifyCalls, 1);
    strict_1.default.equal(planCalls, 1);
    strict_1.default.equal(data.mode, "memory_recall");
    strict_1.default.match(data.message || "", /check the details/i);
    strict_1.default.match(data.summary || "", /current stage/i);
});
(0, node_test_1.default)("chat route can hand off calendar actions without extra model calls", async () => {
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
        classifyChatIntent: async () => {
            classifyCalls += 1;
            return { intent: "calendar_action" };
        },
        generateChatPlan: async (input) => {
            planCalls += 1;
            strict_1.default.equal(input.intent, "calendar_action");
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
            strict_1.default.equal(input.action.action, "create");
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
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(classifyCalls, 1);
    strict_1.default.equal(planCalls, 1);
    strict_1.default.equal(calendarCalls, 1);
    strict_1.default.equal(data.mode, "appointment");
    strict_1.default.match(data.message || "", /calendar/i);
    strict_1.default.equal(data.calendarEvent?.action, "create");
    strict_1.default.equal(data.calendarEvent?.eventId, "event-123");
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
(0, node_test_1.default)("scam check keeps government pages safe even when the model is cautious", async () => {
    const request = new Request("http://localhost/api/scam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            url: "https://www.medicare.gov",
            pageTitle: "Welcome to Medicare",
            content: "Protect yourself from Medicare fraud. If you get a message asking for your password, do not share it.",
        }),
    });
    const response = await (0, route_3.handleScamCheckRequest)(request, {
        orchestrateCopilot: async () => ({
            mode: "scam_check",
            summary: "This page looks risky.",
            nextStep: "Do not enter personal information.",
            explanation: "It mentions fraud and password language.",
            riskLevel: "risky",
            suspiciousSignals: ["fraud", "password"],
        }),
        logScamCheck: async () => { },
    });
    strict_1.default.equal(response.status, 200);
    const data = (await response.json());
    strict_1.default.equal(data.classification, "safe");
    strict_1.default.equal(data.blocked, false);
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
