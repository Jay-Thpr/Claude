import type { AppointmentContext, CopilotResponse } from "./response-schema";

const MEDICARE_KEYWORD = /medicare/i;

export const MEDICARE_NEXT_STEP_SUMMARY =
  "You have a Medicare-related appointment, so I’m using the Medicare guide.";

export const MEDICARE_NEXT_STEP_EXPLANATION =
  "Open medicare.gov, look for the form or contact flow that matches your appointment, and fill in only the safe fields you are certain about. Stop before any submit, confirm, or final review button.";

export const MEDICARE_NEXT_STEP = "Go to medicare.gov and start the form, but stop before submitting anything.";

export const MEDICARE_BROWSER_TASK =
  "Open medicare.gov. Find the Medicare-related form or contact flow that matches the appointment. Fill in only safe fields if needed, but stop before submitting, confirming, or placing anything.";

export function containsMedicareText(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).some((part) => MEDICARE_KEYWORD.test(part as string));
}

export function isMedicareAppointment(appointment: Pick<
  AppointmentContext,
  "summary" | "description" | "prepNotes"
> | null | undefined) {
  if (!appointment) {
    return false;
  }

  return containsMedicareText(appointment.summary, appointment.description, appointment.prepNotes);
}

export function buildMedicareNextStepResponse(
  appointment?: Pick<AppointmentContext, "summary" | "description" | "prepNotes"> | null,
): CopilotResponse & { browserUseTask: string } {
  const appointmentLabel = appointment?.summary ? ` for ${appointment.summary}` : "";
  const currentTask = appointment?.summary || "Preparing for Medicare";

  return {
    mode: "guidance",
    summary: `${MEDICARE_NEXT_STEP_SUMMARY}${appointmentLabel}.`,
    nextStep: MEDICARE_NEXT_STEP,
    explanation: MEDICARE_NEXT_STEP_EXPLANATION,
    riskLevel: "uncertain",
    suspiciousSignals: [
      "Medicare appointment detected in calendar context",
      "Stop before submitting anything",
    ],
    memoryUpdate: {
      currentTask,
      lastStep: "Reviewed the Medicare next step and stopped before submitting anything.",
    },
    browserUseTask: MEDICARE_BROWSER_TASK,
  };
}
