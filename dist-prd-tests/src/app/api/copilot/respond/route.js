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
exports.POST = POST;
exports.handleCopilotRespondRequest = handleCopilotRespondRequest;
const headers_1 = require("next/headers");
const memory_store_1 = require("../../../../lib/memory-store");
const copilot_memory_1 = require("../../../../lib/copilot-memory");
const user_context_1 = require("../../../../lib/user-context");
const task_memory_input_1 = require("../../../../lib/task-memory-input");
async function POST(request) {
    return handleCopilotRespondRequest(request);
}
async function handleCopilotRespondRequest(request, deps = {}) {
    try {
        const body = (await request.json());
        const requestBody = {
            ...body,
            taskMemory: (0, task_memory_input_1.normalizeTaskMemoryInput)(body.taskMemory),
        };
        const cookieStore = deps.userContext || body.userId ? null : await (0, headers_1.cookies)();
        const userContext = deps.userContext ?? (body.userId ? null : await (0, user_context_1.loadUserContextFromCookies)(cookieStore));
        const userId = body.userId || userContext?.profile.userId;
        const orchestrateCopilot = deps.orchestrateCopilot ?? (await Promise.resolve().then(() => __importStar(require("../../../../lib/orchestrator")))).orchestrateCopilot;
        const response = await orchestrateCopilot(requestBody);
        if (userId && response.memoryUpdate) {
            const persistMemoryUpdate = deps.persistCopilotMemoryUpdate ?? copilot_memory_1.persistCopilotMemoryUpdate;
            const currentFlow = await (0, memory_store_1.getTaskFlow)(userId);
            const taskMemory = await persistMemoryUpdate({
                userId,
                response,
                currentFlow,
                taskMemory: requestBody.taskMemory,
                appointment: body.appointment || null,
                currentUrl: body.url,
                pageTitle: body.pageTitle,
            });
            return Response.json({
                ...response,
                task_memory: taskMemory,
            });
        }
        return Response.json(response);
    }
    catch (error) {
        console.error("Copilot respond error:", error);
        return Response.json({
            mode: "guidance",
            summary: "I had a small problem.",
            nextStep: "Please try again in a moment.",
            explanation: "I'm having trouble reading the page right now. Try again in a moment, or ask me to check the safe next step.",
            riskLevel: "uncertain",
            suspiciousSignals: [],
        }, { status: 500 });
    }
}
