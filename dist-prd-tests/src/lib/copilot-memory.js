"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistCopilotMemoryUpdate = persistCopilotMemoryUpdate;
const memory_store_1 = require("./memory-store");
async function persistCopilotMemoryUpdate({ userId, response, currentFlow, taskMemory, appointment, currentUrl, pageTitle, }) {
    if (!response.memoryUpdate) {
        return currentFlow || null;
    }
    const flow = currentFlow || (await (0, memory_store_1.getTaskFlow)(userId));
    const nextFlow = {
        current_task: response.memoryUpdate.currentTask || flow?.currentTask || taskMemory?.currentTask || appointment?.summary || "Browsing with SafeStep",
        task_type: flow?.taskType ?? taskMemory?.taskType ?? null,
        task_goal: flow?.taskGoal ?? taskMemory?.taskGoal ?? appointment?.summary ?? null,
        current_stage_index: flow?.currentStageIndex ?? taskMemory?.currentStageIndex ?? null,
        current_stage_title: flow?.currentStageTitle ?? taskMemory?.currentStageTitle ?? null,
        current_stage_detail: flow?.currentStageDetail ?? taskMemory?.currentStageDetail ?? null,
        next_stage_title: flow?.nextStageTitle ?? taskMemory?.nextStageTitle ?? null,
        next_stage_detail: flow?.nextStageDetail ?? taskMemory?.nextStageDetail ?? null,
        stage_plan: flow?.stagePlan ?? taskMemory?.stagePlan ?? [],
        status: flow?.status ?? taskMemory?.status ?? "active",
        last_step: response.memoryUpdate.lastStep || flow?.lastStep || taskMemory?.lastStep || "Reviewed the current page and asked SafeStep for help.",
        current_url: currentUrl ?? flow?.currentUrl ?? taskMemory?.currentUrl ?? null,
        page_title: pageTitle ?? flow?.pageTitle ?? taskMemory?.pageTitle ?? null,
    };
    await (0, memory_store_1.updateTaskMemory)(userId, nextFlow);
    return (0, memory_store_1.getTaskFlow)(userId);
}
