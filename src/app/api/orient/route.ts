import { cookies } from "next/headers";
import { extractSuspiciousSignals, assessRiskLevel } from "../../../lib/safety-rules";
import { loadCalendarSnapshot, type CalendarSnapshot } from "../../../lib/gcal";

type OrientDeps = {
  loadCalendarSnapshot?: () => Promise<CalendarSnapshot | null>;
};

export interface OrientRequest {
  url: string;
  pageTitle?: string;
  pageText?: string;
  taskMemory?: {
    currentTask?: string;
    lastStep?: string;
    currentUrl?: string;
  } | null;
}

export interface OrientResponse {
  safetyTone: "safe" | "uncertain" | "risky";
  safetyExplanation: string;
  proactiveTip: string | null;
  autoOpen: boolean;
  suggestedActions: string[];
  bullets: string[];
}

const SAFE_DEFAULT: OrientResponse = {
  safetyTone: "safe",
  safetyExplanation: "This page looks safe.",
  proactiveTip: null,
  autoOpen: false,
  suggestedActions: ["I'm fine", "Help me with something"],
  bullets: [],
};

function isRelatedUrl(taskUrl: string | undefined, currentUrl: string): boolean {
  if (!taskUrl) return false;
  try {
    const taskHost = new URL(taskUrl).hostname;
    const currentHost = new URL(currentUrl).hostname;
    return taskHost === currentHost;
  } catch {
    return false;
  }
}

function appointmentWithinMinutes(whenLabel: string | null | undefined, timeLabel: string | null | undefined, minutes: number): boolean {
  if (!whenLabel || !timeLabel) return false;
  try {
    const isToday = whenLabel.toLowerCase() === "today";
    if (!isToday) return false;

    // Parse time like "2:30 PM"
    const now = new Date();
    const [timePart, meridiem] = timeLabel.split(" ");
    const [hourStr, minuteStr] = timePart.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr || "0", 10);
    if (meridiem?.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (meridiem?.toUpperCase() === "AM" && hour === 12) hour = 0;

    const apptTime = new Date(now);
    apptTime.setHours(hour, minute, 0, 0);

    const diffMs = apptTime.getTime() - now.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes >= 0 && diffMinutes <= minutes;
  } catch {
    return false;
  }
}

export async function handleOrientRequest(request: Request, deps: OrientDeps = {}): Promise<Response> {
  let body: OrientRequest;
  try {
    body = (await request.json()) as OrientRequest;
  } catch {
    return Response.json(SAFE_DEFAULT);
  }

  const { url, pageTitle, pageText, taskMemory } = body;

  try {
    // 1. Safety signals
    const textToCheck = [url, pageTitle, pageText].filter(Boolean).join(" ");
    const suspiciousSignals = extractSuspiciousSignals(textToCheck);
    const riskLevel = assessRiskLevel(textToCheck);

    const safetyTone: OrientResponse["safetyTone"] =
      riskLevel === "risky" ? "risky" : riskLevel === "uncertain" ? "uncertain" : "safe";

    let safetyExplanation = "This page looks safe.";
    if (riskLevel === "risky") {
      safetyExplanation =
        "This page has some warning signs. Please be careful before entering any personal information.";
    } else if (riskLevel === "uncertain") {
      safetyExplanation =
        "This page is asking for information. Make sure you recognize this website before continuing.";
    }

    // 2. Calendar snapshot
    let snapshot;
    try {
      if (deps.loadCalendarSnapshot) {
        snapshot = await deps.loadCalendarSnapshot();
      } else {
        const cookieStore = await cookies();
        snapshot = await loadCalendarSnapshot(cookieStore);
      }
    } catch {
      snapshot = null;
    }

    const nextAppt = snapshot?.connected ? snapshot.nextAppointment : null;
    const apptSoon =
      nextAppt !== null && nextAppt !== undefined &&
      appointmentWithinMinutes(nextAppt.whenLabel, nextAppt.timeLabel, 120);

    // 3. Task memory — was the user in the middle of something on this domain?
    const hasOngoingTask =
      taskMemory?.currentTask != null &&
      taskMemory.currentTask.trim() !== "" &&
      isRelatedUrl(taskMemory.currentUrl, url);

    // 4. autoOpen logic
    const autoOpen = riskLevel === "risky" || apptSoon || hasOngoingTask;

    // 5. Build proactiveTip
    let proactiveTip: string | null = null;

    if (riskLevel === "risky") {
      const signalList = suspiciousSignals.slice(0, 2).join(", ");
      proactiveTip = `This page may not be safe${signalList ? ` (noticed: ${signalList})` : ""}. Would you like help checking it?`;
    } else if (apptSoon && nextAppt) {
      const timePart = nextAppt.timeLabel ? ` at ${nextAppt.timeLabel}` : "";
      const minutesAway = (() => {
        try {
          const now = new Date();
          const [timePt, mer] = (nextAppt.timeLabel ?? "").split(" ");
          const [h, m] = timePt.split(":");
          let hour = parseInt(h, 10);
          const minute = parseInt(m || "0", 10);
          if (mer?.toUpperCase() === "PM" && hour !== 12) hour += 12;
          if (mer?.toUpperCase() === "AM" && hour === 12) hour = 0;
          const apptDate = new Date(now);
          apptDate.setHours(hour, minute, 0, 0);
          return Math.round((apptDate.getTime() - now.getTime()) / 60000);
        } catch {
          return null;
        }
      })();

      const timeHint =
        minutesAway !== null && minutesAway > 0
          ? `in ${minutesAway} minute${minutesAway === 1 ? "" : "s"}`
          : `today${timePart}`;

      proactiveTip = `Your appointment "${nextAppt.summary}" is ${timeHint}. Would you like help preparing?`;
    } else if (hasOngoingTask && taskMemory?.currentTask) {
      proactiveTip = `You were working on "${taskMemory.currentTask}" here. Would you like to continue where you left off?`;
    }

    // 6. suggestedActions
    let suggestedActions: string[];
    if (riskLevel === "risky") {
      suggestedActions = ["Yes, check this page", "Leave this page", "I'm fine"];
    } else if (apptSoon) {
      suggestedActions = ["Yes, help me prepare", "Remind me later", "I'm fine"];
    } else if (hasOngoingTask) {
      suggestedActions = ["Yes, continue task", "Start something new", "I'm fine"];
    } else {
      suggestedActions = ["I need help", "I'm fine"];
    }

    // 7. bullets — surface suspicious signals as readable notes
    const bullets: string[] = suspiciousSignals.map((s) => `Noticed: "${s}" on this page`);

    const result: OrientResponse = {
      safetyTone,
      safetyExplanation,
      proactiveTip,
      autoOpen,
      suggestedActions,
      bullets,
    };

    return Response.json(result);
  } catch {
    return Response.json(SAFE_DEFAULT);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleOrientRequest(request);
}
