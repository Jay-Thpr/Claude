import test from "node:test";
import assert from "node:assert/strict";
import { buildAppointmentReminder } from "../src/lib/appointment-reminders";
import { buildMemorySummary } from "../src/lib/safety-rules";
import {
  DEFAULT_APPOINTMENT_STAGE_PLAN,
  buildStageMessage,
  buildStageStateFromPlan,
  normalizeStagePlan,
} from "../src/lib/task-flow";

test("appointment reminders stay calm and include practical prep", () => {
  const reminder = buildAppointmentReminder({
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

  assert.match(reminder.message, /tomorrow/i);
  assert.match(reminder.message, /cardiology follow-up/i);
  assert.match(reminder.message, /location: ucsd medical center/i);
  assert.match(reminder.message, /calm pace/i);
  assert.ok(reminder.reminders.some((item) => /appointment note/i.test(item)));
});

test("staged next-task flow keeps the user on the current and next stage", () => {
  const normalizedPlan = normalizeStagePlan([
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

  assert.equal(normalizedPlan.length, 3);
  assert.deepEqual(normalizedPlan, DEFAULT_APPOINTMENT_STAGE_PLAN);

  const firstStage = buildStageStateFromPlan(normalizedPlan, 0);
  assert.equal(firstStage.currentStage?.title, "Check the doctor website");
  assert.equal(firstStage.nextStage?.title, "Pack what you need");
  assert.equal(firstStage.currentStageIndex, 0);
  assert.match(buildStageMessage({
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

  const secondStage = buildStageStateFromPlan(normalizedPlan, 1);
  assert.equal(secondStage.currentStage?.title, "Pack what you need");
  assert.equal(secondStage.nextStage?.title, "Leave the house");
});

test("memory summary explains what the user is doing and what comes next", () => {
  const summary = buildMemorySummary(
    {
      currentTask: "Getting ready for the cardiology appointment",
      taskGoal: "Finish the appointment prep steps",
      currentStageTitle: "Check the doctor website",
      nextStageTitle: "Pack what you need",
      lastStep: "Opened the portal and checked the visit details.",
    },
    {
      summary: "Cardiology follow-up with Dr. Martinez",
    },
  );

  assert.match(summary, /Current task: Getting ready for the cardiology appointment/i);
  assert.match(summary, /Task goal: Finish the appointment prep steps/i);
  assert.match(summary, /Current stage: Check the doctor website/i);
  assert.match(summary, /Next stage: Pack what you need/i);
  assert.match(summary, /Next appointment: Cardiology follow-up with Dr. Martinez/i);
});
