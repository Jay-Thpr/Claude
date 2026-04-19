"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.handleTaskFlowGetRequest = handleTaskFlowGetRequest;
exports.POST = POST;
exports.handleTaskFlowPostRequest = handleTaskFlowPostRequest;
const mock_context_1 = require("../../../lib/mock-context");
const memory_store_1 = require("../../../lib/memory-store");
const task_flow_1 = require("../../../lib/task-flow");
async function GET() {
    return handleTaskFlowGetRequest();
}
async function handleTaskFlowGetRequest(deps = {}) {
    const load = deps.getTaskFlow ?? memory_store_1.getTaskFlow;
    const flow = await load(mock_context_1.DEMO_USER_ID);
    return Response.json({
        current_task: flow?.currentTask ?? null,
        task_goal: flow?.taskGoal ?? null,
        task_type: flow?.taskType ?? null,
        current_stage_index: flow?.currentStageIndex ?? null,
        current_stage_title: flow?.currentStageTitle ?? null,
        current_stage_detail: flow?.currentStageDetail ?? null,
        next_stage_title: flow?.nextStageTitle ?? null,
        next_stage_detail: flow?.nextStageDetail ?? null,
        stage_plan: flow?.stagePlan ?? [],
        status: flow?.status ?? null,
        last_step: flow?.lastStep ?? null,
        current_url: flow?.currentUrl ?? null,
        page_title: flow?.pageTitle ?? null,
        message: (0, task_flow_1.buildStageMessage)(flow),
    });
}
async function POST(request) {
    return handleTaskFlowPostRequest(request);
}
async function handleTaskFlowPostRequest(request, deps = {}) {
    try {
        const body = (await request.json());
        const userId = body.user_id?.trim() || mock_context_1.DEMO_USER_ID;
        const load = deps.getTaskFlow ?? memory_store_1.getTaskFlow;
        const save = deps.updateTaskFlow ?? memory_store_1.updateTaskFlow;
        const existing = await load(userId);
        const stagePlan = (0, task_flow_1.normalizeStagePlan)(body.stage_plan ?? existing?.stagePlan ?? []);
        const hasPlan = stagePlan.length > 0;
        const existingIndex = existing?.currentStageIndex ?? 0;
        const requestedIndex = typeof body.current_stage_index === "number" && body.current_stage_index >= 0
            ? body.current_stage_index
            : existingIndex;
        let currentStageIndex = requestedIndex;
        if (body.action === "advance") {
            currentStageIndex = hasPlan ? Math.min(existingIndex + 1, Math.max(stagePlan.length - 1, 0)) : existingIndex + 1;
        }
        if (body.action === "reset") {
            currentStageIndex = 0;
        }
        const { currentStage, nextStage, currentStageIndex: normalizedIndex } = (0, task_flow_1.buildStageStateFromPlan)(stagePlan, currentStageIndex);
        const currentTask = body.current_task ||
            body.task_goal ||
            existing?.currentTask ||
            currentStage?.title ||
            null;
        const status = body.status ||
            (body.action === "complete"
                ? "done"
                : body.action === "pause"
                    ? "paused"
                    : existing?.status || "active");
        const saved = await save(userId, {
            current_task: currentTask,
            task_goal: body.task_goal ?? existing?.taskGoal ?? null,
            task_type: body.task_type ?? existing?.taskType ?? null,
            current_stage_index: hasPlan ? normalizedIndex : currentStageIndex,
            current_stage_title: currentStage?.title ?? null,
            current_stage_detail: currentStage?.detail ?? null,
            next_stage_title: nextStage?.title ?? null,
            next_stage_detail: nextStage?.detail ?? null,
            stage_plan: hasPlan ? stagePlan : existing?.stagePlan ?? [],
            status,
            last_step: body.last_step ??
                (body.action === "advance" && currentStage?.title
                    ? `Finished stage: ${currentStage.title}`
                    : existing?.lastStep ?? null),
            current_url: body.current_url ?? existing?.currentUrl ?? null,
            page_title: body.page_title ?? existing?.pageTitle ?? null,
        });
        return Response.json({
            success: true,
            message: (0, task_flow_1.buildStageMessage)(saved),
            current_task: saved?.currentTask ?? null,
            task_goal: saved?.taskGoal ?? null,
            task_type: saved?.taskType ?? null,
            current_stage_index: saved?.currentStageIndex ?? null,
            current_stage_title: saved?.currentStageTitle ?? null,
            current_stage_detail: saved?.currentStageDetail ?? null,
            next_stage_title: saved?.nextStageTitle ?? null,
            next_stage_detail: saved?.nextStageDetail ?? null,
            stage_plan: saved?.stagePlan ?? [],
            status: saved?.status ?? null,
            last_step: saved?.lastStep ?? null,
            current_url: saved?.currentUrl ?? null,
            page_title: saved?.pageTitle ?? null,
            ...saved,
        });
    }
    catch (error) {
        console.error("Task flow error:", error);
        return Response.json({
            success: false,
            message: "I could not save the stage right now.",
        }, { status: 500 });
    }
}
