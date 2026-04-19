"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTaskMemoryInput = normalizeTaskMemoryInput;
function asString(value) {
    return typeof value === "string" && value.trim() ? value : null;
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function normalizeTaskMemoryInput(taskMemory) {
    if (!taskMemory || typeof taskMemory !== "object") {
        return null;
    }
    const memory = taskMemory;
    return {
        currentTask: asString(memory.currentTask ?? memory.current_task),
        taskType: asString(memory.taskType ?? memory.task_type),
        taskGoal: asString(memory.taskGoal ?? memory.task_goal),
        currentStageIndex: asNumber(memory.currentStageIndex ?? memory.current_stage_index),
        currentStageTitle: asString(memory.currentStageTitle ?? memory.current_stage_title),
        currentStageDetail: asString(memory.currentStageDetail ?? memory.current_stage_detail),
        nextStageTitle: asString(memory.nextStageTitle ?? memory.next_stage_title),
        nextStageDetail: asString(memory.nextStageDetail ?? memory.next_stage_detail),
        stagePlan: Array.isArray(memory.stagePlan ?? memory.stage_plan)
            ? (memory.stagePlan ?? memory.stage_plan)
            : null,
        status: asString(memory.status),
        lastStep: asString(memory.lastStep ?? memory.last_step),
        currentUrl: asString(memory.currentUrl ?? memory.current_url),
        pageTitle: asString(memory.pageTitle ?? memory.page_title),
    };
}
