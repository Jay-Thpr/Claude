"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_APPOINTMENT_STAGE_PLAN = void 0;
exports.normalizeStagePlan = normalizeStagePlan;
exports.buildStageStateFromPlan = buildStageStateFromPlan;
exports.buildStageMessage = buildStageMessage;
exports.DEFAULT_APPOINTMENT_STAGE_PLAN = [
    {
        title: "Check the doctor website",
        detail: "Open the hospital portal and confirm the visit details.",
    },
    {
        title: "Pack what you need",
        detail: "Put the medication list, insurance card, and notes in a bag.",
    },
    {
        title: "Leave the house",
        detail: "Grab your keys and leave 15 minutes early.",
    },
];
function normalizeStagePlan(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((stage) => {
        if (!stage || typeof stage !== "object") {
            return null;
        }
        const title = "title" in stage ? String(stage.title || "").trim() : "";
        if (!title) {
            return null;
        }
        const detail = "detail" in stage ? stage.detail ?? null : null;
        return { title, detail };
    })
        .filter((stage) => Boolean(stage))
        .map((stage) => ({ title: stage.title, detail: stage.detail }));
}
function buildStageStateFromPlan(stagePlan, currentStageIndex) {
    const normalizedPlan = normalizeStagePlan(stagePlan ?? []);
    const index = typeof currentStageIndex === "number" && currentStageIndex >= 0 ? currentStageIndex : 0;
    const currentStage = normalizedPlan[index] ?? null;
    const nextStage = normalizedPlan[index + 1] ?? null;
    return {
        stagePlan: normalizedPlan,
        currentStageIndex: normalizedPlan.length ? Math.min(index, normalizedPlan.length - 1) : 0,
        currentStage,
        nextStage,
    };
}
function buildStageMessage(flow) {
    if (!flow || !flow.stagePlan.length) {
        return "No staged flow is saved yet.";
    }
    const current = flow.currentStageTitle || flow.currentTask || "the current step";
    const next = flow.nextStageTitle ? ` Next, ${flow.nextStageTitle.toLowerCase()}.` : "";
    return `You are on stage ${Math.max((flow.currentStageIndex ?? 0) + 1, 1)} of ${flow.stagePlan.length}: ${current}.${next}`;
}
