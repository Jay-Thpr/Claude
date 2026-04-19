import type { CopilotMode, CopilotRequest } from "./response-schema";

type OrchestrationMode = Exclude<CopilotMode, "chat">;

const SCAM_HINTS = [
  "scam",
  "safe",
  "safe to",
  "is this real",
  "phishing",
  "fraud",
  "payment",
  "billing",
  "urgent",
  "suspicious",
  "password",
];

const APPOINTMENT_HINTS = [
  "appointment",
  "portal",
  "doctor",
  "hospital",
  "clinic",
  "refill",
  "medicine",
  "prescription",
  "calendar",
];

const MEMORY_HINTS = [
  "what was i doing",
  "what am i doing",
  "where was i",
  "remember",
  "last step",
  "continue",
  "next step",
];

function score(text: string, hints: string[]) {
  return hints.reduce((total, hint) => total + (text.includes(hint) ? 1 : 0), 0);
}

function isGovernmentUrl(url?: string | null) {
  if (!url) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith(".gov");
  } catch {
    return false;
  }
}

function hasExplicitSafetyQuestion(query?: string | null) {
  if (!query) {
    return false;
  }

  return /\b(safe|scam|phishing|fraud|suspicious|is this real|legit|secure|security|warning)\b/i.test(
    query,
  );
}

export function routeIntent(input: CopilotRequest): OrchestrationMode {
  const haystack = [
    input.query,
    input.pageTitle,
    input.visibleText,
    input.pageSummary,
    input.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (input.mode && input.mode !== "auto") {
    return input.mode === "chat" ? "guidance" : input.mode;
  }

  const scamScore = score(haystack, SCAM_HINTS);
  const appointmentScore = score(haystack, APPOINTMENT_HINTS);
  const memoryScore = score(haystack, MEMORY_HINTS);
  const officialGovernmentSite = isGovernmentUrl(input.url);
  const explicitSafetyQuestion = hasExplicitSafetyQuestion(input.query);

  if (memoryScore >= appointmentScore && memoryScore >= scamScore && memoryScore > 0) {
    return "memory_recall";
  }

  if (officialGovernmentSite && !explicitSafetyQuestion) {
    if (appointmentScore > 0) {
      return "appointment";
    }

    return "guidance";
  }

  if (scamScore >= appointmentScore && scamScore > 0) {
    return "scam_check";
  }

  if (appointmentScore > 0) {
    return "appointment";
  }

  return "guidance";
}

export function shouldUseBrowserUse(input: CopilotRequest, intent: OrchestrationMode) {
  const text = [
    input.query,
    input.pageTitle,
    input.visibleText,
    input.pageSummary,
    input.url,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (intent === "scam_check") {
    return false;
  }

  return /sign in|log in|fill|submit|book|refill|change|update|click|open|continue|next/i.test(
    text,
  );
}
