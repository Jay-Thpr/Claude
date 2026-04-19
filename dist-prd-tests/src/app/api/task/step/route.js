"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const STOP_WORDS = new Set(["stop", "no", "cancel", "quit", "exit", "never mind", "nevermind"]);
function isStopResponse(userResponse) {
    return STOP_WORDS.has(userResponse.trim().toLowerCase());
}
async function POST(request) {
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return Response.json({
            done: true,
            nextStepIndex: 0,
            announcement: "Something went wrong. Let me know if you need help.",
        }, { status: 400 });
    }
    const { steps, currentStepIndex, userResponse } = body;
    // Guard: steps must be an array
    if (!Array.isArray(steps) || steps.length === 0) {
        return Response.json({
            done: true,
            nextStepIndex: 0,
            announcement: "I don't have any steps for this task. Let me know what you need help with.",
        });
    }
    const safeCurrentIndex = Math.max(0, Math.min(currentStepIndex, steps.length - 1));
    const currentStep = steps[safeCurrentIndex];
    // 1. Stop / No response — end the task immediately
    if (isStopResponse(userResponse)) {
        return Response.json({
            done: true,
            nextStepIndex: safeCurrentIndex,
            announcement: "Okay, I'll stop here. Let me know if you need anything.",
        });
    }
    // 2. Task complete — no more steps
    if (safeCurrentIndex + 1 >= steps.length) {
        return Response.json({
            done: true,
            nextStepIndex: safeCurrentIndex,
            announcement: "We're all done! Great job.",
            memoryUpdate: {
                currentTask: "Completed task",
                lastStep: currentStep?.instruction ?? "Finished the last step",
            },
        });
    }
    // 3. Advance to next step
    const nextStepIndex = safeCurrentIndex + 1;
    const nextStep = steps[nextStepIndex];
    return Response.json({
        done: false,
        nextStepIndex,
        announcement: nextStep.voiceAnnouncement,
        instruction: nextStep.instruction,
        memoryUpdate: {
            currentTask: "Task in progress",
            lastStep: currentStep?.instruction ?? `Completed step ${safeCurrentIndex + 1}`,
        },
    });
}
