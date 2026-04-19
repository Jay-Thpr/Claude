"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeTaskFlowSnapshot = serializeTaskFlowSnapshot;
exports.buildTaskFlowMessage = buildTaskFlowMessage;
exports.getTaskMemory = getTaskMemory;
exports.getTaskFlow = getTaskFlow;
exports.updateTaskMemory = updateTaskMemory;
exports.updateTaskFlow = updateTaskFlow;
exports.buildStageStateFromPlan = buildStageStateFromPlan;
const supabase_server_1 = require("./supabase-server");
const logger_1 = require("./logger");
const task_flow_1 = require("./task-flow");
function serializeTaskFlowSnapshot(memory) {
    if (!memory) {
        return null;
    }
    return {
        currentTask: memory.current_task ?? null,
        taskType: memory.task_type ?? null,
        taskGoal: memory.task_goal ?? null,
        currentStageIndex: memory.current_stage_index ?? null,
        currentStageTitle: memory.current_stage_title ?? null,
        currentStageDetail: memory.current_stage_detail ?? null,
        nextStageTitle: memory.next_stage_title ?? null,
        nextStageDetail: memory.next_stage_detail ?? null,
        stagePlan: (0, task_flow_1.normalizeStagePlan)(memory.stage_plan ?? []),
        status: memory.status ?? null,
        lastStep: memory.last_step ?? null,
        currentUrl: memory.current_url ?? null,
        pageTitle: memory.page_title ?? null,
    };
}
function buildTaskFlowMessage(flow) {
    if (!flow || !flow.stagePlan.length) {
        return "No staged flow is saved yet.";
    }
    const current = flow.currentStageTitle || flow.currentTask || "the current step";
    const next = flow.nextStageTitle ? ` Next, ${flow.nextStageTitle.toLowerCase()}.` : "";
    return `You are on stage ${Math.max((flow.currentStageIndex ?? 0) + 1, 1)} of ${flow.stagePlan.length}: ${current}.${next}`;
}
function toSnapshot(memory) {
    return serializeTaskFlowSnapshot(memory) || {
        currentTask: null,
        taskType: null,
        taskGoal: null,
        currentStageIndex: null,
        currentStageTitle: null,
        currentStageDetail: null,
        nextStageTitle: null,
        nextStageDetail: null,
        stagePlan: [],
        status: null,
        lastStep: null,
        currentUrl: null,
        pageTitle: null,
    };
}
async function getTaskMemory(userId) {
    try {
        const supabase = (0, supabase_server_1.createServerSupabaseClient)();
        if (!supabase)
            return null;
        const { data, error } = await supabase
            .from("task_memory")
            .select("*")
            .eq("user_id", userId)
            .single();
        if (error && error.code !== "PGRST116") {
            logger_1.logger.error("memory-store", "getTaskMemory failed", error);
            return null;
        }
        return data ?? null;
    }
    catch (err) {
        logger_1.logger.error("memory-store", "getTaskMemory threw", err);
        return null;
    }
}
async function getTaskFlow(userId) {
    const memory = await getTaskMemory(userId);
    return memory ? toSnapshot(memory) : null;
}
async function updateTaskMemory(userId, patch) {
    try {
        const supabase = (0, supabase_server_1.createServerSupabaseClient)();
        if (!supabase)
            return;
        const { error } = await supabase.from("task_memory").upsert({
            user_id: userId,
            ...patch,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) {
            logger_1.logger.error("memory-store", "updateTaskMemory failed", error);
        }
    }
    catch (err) {
        logger_1.logger.error("memory-store", "updateTaskMemory threw", err);
    }
}
async function updateTaskFlow(userId, patch) {
    await updateTaskMemory(userId, patch);
    return getTaskFlow(userId);
}
function buildStageStateFromPlan(stagePlan, currentStageIndex) {
    const normalizedPlan = (0, task_flow_1.normalizeStagePlan)(stagePlan ?? []);
    const index = typeof currentStageIndex === "number" && currentStageIndex >= 0
        ? currentStageIndex
        : 0;
    const currentStage = normalizedPlan[index] ?? null;
    const nextStage = normalizedPlan[index + 1] ?? null;
    return {
        stagePlan: normalizedPlan,
        currentStageIndex: normalizedPlan.length ? Math.min(index, normalizedPlan.length - 1) : 0,
        currentStage,
        nextStage,
    };
}
