"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COPILOT_RESPONSE = void 0;
exports.normalizeCopilotResponse = normalizeCopilotResponse;
exports.DEFAULT_COPILOT_RESPONSE = {
    mode: "guidance",
    summary: "I’m ready to help.",
    nextStep: "Tell me what page you are on or what you want to do next.",
    explanation: "I can look at the page, help you stay safe, and remind you what comes next.",
    riskLevel: "uncertain",
    suspiciousSignals: [],
};
function normalizeCopilotResponse(value, fallbackMode) {
    return {
        mode: value?.mode || fallbackMode,
        summary: value?.summary || exports.DEFAULT_COPILOT_RESPONSE.summary,
        nextStep: value?.nextStep || exports.DEFAULT_COPILOT_RESPONSE.nextStep,
        explanation: value?.explanation || exports.DEFAULT_COPILOT_RESPONSE.explanation,
        riskLevel: value?.riskLevel || exports.DEFAULT_COPILOT_RESPONSE.riskLevel,
        suspiciousSignals: Array.isArray(value?.suspiciousSignals)
            ? value.suspiciousSignals
            : [],
        memoryUpdate: value?.memoryUpdate
            ? {
                currentTask: value.memoryUpdate.currentTask || undefined,
                lastStep: value.memoryUpdate.lastStep || undefined,
            }
            : undefined,
    };
}
