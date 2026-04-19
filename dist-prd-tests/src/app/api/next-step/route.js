"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNextStepRequest = handleNextStepRequest;
exports.POST = POST;
const headers_1 = require("next/headers");
const appointment_context_1 = require("../../../lib/appointment-context");
const user_context_1 = require("../../../lib/user-context");
const mock_context_1 = require("../../../lib/mock-context");
const medicare_next_step_1 = require("../../../lib/medicare-next-step");
const browser_use_1 = require("../../../lib/browser-use");
const memory_store_1 = require("../../../lib/memory-store");
const copilot_memory_1 = require("../../../lib/copilot-memory");
function mapTaskMemory(taskMemory) {
    const memory = taskMemory;
    if (!memory) {
        return undefined;
    }
    return {
        currentTask: memory.current_task ?? null,
        taskType: memory.task_type ?? null,
        taskGoal: memory.task_goal ?? null,
        currentStageIndex: typeof memory.current_stage_index === "number" ? memory.current_stage_index : undefined,
        currentStageTitle: memory.current_stage_title ?? null,
        currentStageDetail: memory.current_stage_detail ?? null,
        nextStageTitle: memory.next_stage_title ?? null,
        nextStageDetail: memory.next_stage_detail ?? null,
        stagePlan: Array.isArray(memory.stage_plan) ? memory.stage_plan : undefined,
        status: memory.status ?? null,
        lastStep: memory.last_step ?? null,
        currentUrl: memory.current_url ?? null,
        pageTitle: memory.page_title ?? null,
    };
}
async function loadAppointmentForNextStep(body, cookieStore, userId) {
    if (body.appointment && typeof body.appointment === "object") {
        return body.appointment;
    }
    return (0, appointment_context_1.loadCurrentAppointmentContext)(cookieStore ?? (await (0, headers_1.cookies)()), userId);
}
async function maybeStartMedicareTask(appointment, deps) {
    const browserTask = (0, medicare_next_step_1.buildMedicareNextStepResponse)(appointment).browserUseTask;
    const runTask = deps.runBrowserTask ?? browser_use_1.runBrowserTask;
    const result = await runTask(browserTask, {
        url: "https://www.medicare.gov",
        title: appointment?.summary || "Medicare",
    });
    return {
        browserUseTask: browserTask,
        browserUse: {
            started: result.success,
            taskId: result.task_id || null,
            error: result.success ? null : result.error || "Unable to reach browser agent backend",
        },
    };
}
async function handleNextStepRequest(request, deps = {}) {
    try {
        const body = (await request.json());
        const cookieStore = deps.userContext ? null : await (0, headers_1.cookies)();
        const userContext = deps.userContext ?? (await (0, user_context_1.loadUserContextFromCookies)(cookieStore));
        const userId = userContext.profile.userId || mock_context_1.DEMO_USER_ID;
        const currentFlowPromise = (0, memory_store_1.getTaskFlow)(userId);
        const appointmentPromise = loadAppointmentForNextStep(body, cookieStore, userId);
        const [currentFlow, appointment] = await Promise.all([currentFlowPromise, appointmentPromise]);
        const taskMemory = mapTaskMemory(body.taskMemory);
        if ((0, medicare_next_step_1.isMedicareAppointment)(appointment)) {
            const browserUse = await maybeStartMedicareTask(appointment, deps).catch(() => ({
                browserUseTask: (0, medicare_next_step_1.buildMedicareNextStepResponse)(appointment).browserUseTask,
                browserUse: {
                    started: false,
                    taskId: null,
                    error: "Unable to start the Medicare browser task right now.",
                },
            }));
            const response = (0, medicare_next_step_1.buildMedicareNextStepResponse)(appointment);
            const task_memory = await (deps.persistCopilotMemoryUpdate ?? copilot_memory_1.persistCopilotMemoryUpdate)({
                userId,
                response,
                currentFlow,
                taskMemory,
                appointment,
                currentUrl: body.url,
                pageTitle: body.pageTitle,
            });
            return Response.json({
                ...response,
                ...browserUse,
                task_memory,
                message: response.summary || response.explanation || response.nextStep,
                next_step: response.nextStep,
            });
        }
        const orchestrateCopilot = deps.orchestrateCopilot ??
            (await Promise.resolve().then(() => __importStar(require("../../../lib/orchestrator")))).orchestrateCopilot;
        const response = await orchestrateCopilot({
            mode: "guidance",
            query: body.question,
            url: body.url,
            pageTitle: body.pageTitle,
            visibleText: body.visibleText || body.content,
            taskMemory,
            appointment,
        });
        const task_memory = await (deps.persistCopilotMemoryUpdate ?? copilot_memory_1.persistCopilotMemoryUpdate)({
            userId,
            response,
            currentFlow,
            taskMemory,
            appointment,
            currentUrl: body.url,
            pageTitle: body.pageTitle,
        });
        return Response.json({
            ...response,
            task_memory,
            message: response.summary || response.explanation || response.nextStep,
            next_step: response.nextStep,
        });
    }
    catch (err) {
        console.error("Next-step error:", err);
        return Response.json({
            summary: "I had a small problem.",
            next_step: "Please try again in a moment.",
            explanation: "I'm having a little trouble right now, but don't worry. Please click the button again in a moment.",
        }, { status: 500 });
    }
}
async function POST(request) {
    return handleNextStepRequest(request);
}
