"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDICARE_BROWSER_TASK = exports.MEDICARE_NEXT_STEP = exports.MEDICARE_NEXT_STEP_EXPLANATION = exports.MEDICARE_NEXT_STEP_SUMMARY = void 0;
exports.containsMedicareText = containsMedicareText;
exports.isMedicareAppointment = isMedicareAppointment;
exports.buildMedicareNextStepResponse = buildMedicareNextStepResponse;
const MEDICARE_KEYWORD = /medicare/i;
exports.MEDICARE_NEXT_STEP_SUMMARY = "You have a Medicare-related appointment, so I’m using the Medicare guide.";
exports.MEDICARE_NEXT_STEP_EXPLANATION = "Open medicare.gov, look for the form or contact flow that matches your appointment, and fill in only the safe fields you are certain about. Stop before any submit, confirm, or final review button.";
exports.MEDICARE_NEXT_STEP = "Go to medicare.gov and start the form, but stop before submitting anything.";
exports.MEDICARE_BROWSER_TASK = "Open medicare.gov. Find the Medicare-related form or contact flow that matches the appointment. Fill in only safe fields if needed, but stop before submitting, confirming, or placing anything.";
function containsMedicareText(...parts) {
    return parts.filter(Boolean).some((part) => MEDICARE_KEYWORD.test(part));
}
function isMedicareAppointment(appointment) {
    if (!appointment) {
        return false;
    }
    return containsMedicareText(appointment.summary, appointment.description, appointment.prepNotes);
}
function buildMedicareNextStepResponse(appointment) {
    const appointmentLabel = appointment?.summary ? ` for ${appointment.summary}` : "";
    const currentTask = appointment?.summary || "Preparing for Medicare";
    return {
        mode: "guidance",
        summary: `${exports.MEDICARE_NEXT_STEP_SUMMARY}${appointmentLabel}.`,
        nextStep: exports.MEDICARE_NEXT_STEP,
        explanation: exports.MEDICARE_NEXT_STEP_EXPLANATION,
        riskLevel: "uncertain",
        suspiciousSignals: [
            "Medicare appointment detected in calendar context",
            "Stop before submitting anything",
        ],
        memoryUpdate: {
            currentTask,
            lastStep: "Reviewed the Medicare next step and stopped before submitting anything.",
        },
        browserUseTask: exports.MEDICARE_BROWSER_TASK,
    };
}
