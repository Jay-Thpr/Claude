"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const appointment_reminders_1 = require("../src/lib/appointment-reminders");
const safety_rules_1 = require("../src/lib/safety-rules");
const task_flow_1 = require("../src/lib/task-flow");
(0, node_test_1.default)("appointment reminders stay calm and include practical prep", () => {
    const reminder = (0, appointment_reminders_1.buildAppointmentReminder)({
        appointment: {
            summary: "Cardiology follow-up with Dr. Martinez",
            whenLabel: "tomorrow",
            timeLabel: "10:30 AM",
            location: "UCSD Medical Center",
            description: "Bring your medication list, insurance card, and a note of any new symptoms.",
            prepNotes: "Arrive 15 minutes early.",
        },
        profile: {
            userId: "demo-user-001",
            name: "Maria Garcia",
            supportNeeds: ["Needs short, plain-language directions", "Benefits from reminders about the last step"],
            preferences: ["One step at a time", "Simple wording"],
            conditions: ["Mild memory and task-sequencing difficulty"],
        },
        entries: [
            {
                id: "condition-memory",
                category: "condition",
                title: "Memory support",
                detail: "Needs reminders of the current task and the last step.",
                tags: ["memory"],
                priority: 1,
            },
        ],
    });
    strict_1.default.match(reminder.message, /tomorrow/i);
    strict_1.default.match(reminder.message, /cardiology follow-up/i);
    strict_1.default.match(reminder.message, /location: ucsd medical center/i);
    strict_1.default.match(reminder.message, /calm pace/i);
    strict_1.default.ok(reminder.reminders.some((item) => /appointment note/i.test(item)));
});
(0, node_test_1.default)("staged next-task flow keeps the user on the current and next stage", () => {
    const normalizedPlan = (0, task_flow_1.normalizeStagePlan)([
        {
            title: "Check the doctor website",
            detail: "Open the hospital portal and confirm the visit details.",
        },
        {
            title: "Pack what you need",
            detail: "Put the medication list, insurance card, and notes in a bag.",
        },
        { title: "Leave the house", detail: "Grab your keys and leave 15 minutes early." },
        { title: "   ", detail: "Ignore empty stages." },
    ]);
    strict_1.default.equal(normalizedPlan.length, 3);
    strict_1.default.deepEqual(normalizedPlan, task_flow_1.DEFAULT_APPOINTMENT_STAGE_PLAN);
    const firstStage = (0, task_flow_1.buildStageStateFromPlan)(normalizedPlan, 0);
    strict_1.default.equal(firstStage.currentStage?.title, "Check the doctor website");
    strict_1.default.equal(firstStage.nextStage?.title, "Pack what you need");
    strict_1.default.equal(firstStage.currentStageIndex, 0);
    strict_1.default.match((0, task_flow_1.buildStageMessage)({
        currentTask: "Reviewing the appointment",
        taskGoal: "Get ready for the appointment",
        taskType: "appointment-prep",
        currentStageIndex: 0,
        currentStageTitle: firstStage.currentStage?.title ?? null,
        currentStageDetail: firstStage.currentStage?.detail ?? null,
        nextStageTitle: firstStage.nextStage?.title ?? null,
        nextStageDetail: firstStage.nextStage?.detail ?? null,
        stagePlan: normalizedPlan,
        status: "active",
        lastStep: "Opened the portal.",
        currentUrl: "https://myhealth.ucsd.edu",
        pageTitle: "MyChart - Appointments",
    }), /stage 1 of 3/i);
    const secondStage = (0, task_flow_1.buildStageStateFromPlan)(normalizedPlan, 1);
    strict_1.default.equal(secondStage.currentStage?.title, "Pack what you need");
    strict_1.default.equal(secondStage.nextStage?.title, "Leave the house");
});
(0, node_test_1.default)("memory summary explains what the user is doing and what comes next", () => {
    const summary = (0, safety_rules_1.buildMemorySummary)({
        currentTask: "Getting ready for the cardiology appointment",
        taskGoal: "Finish the appointment prep steps",
        currentStageTitle: "Check the doctor website",
        nextStageTitle: "Pack what you need",
        lastStep: "Opened the portal and checked the visit details.",
    }, {
        summary: "Cardiology follow-up with Dr. Martinez",
    });
    strict_1.default.match(summary, /Current task: Getting ready for the cardiology appointment/i);
    strict_1.default.match(summary, /Task goal: Finish the appointment prep steps/i);
    strict_1.default.match(summary, /Current stage: Check the doctor website/i);
    strict_1.default.match(summary, /Next stage: Pack what you need/i);
    strict_1.default.match(summary, /Next appointment: Cardiology follow-up with Dr. Martinez/i);
});
