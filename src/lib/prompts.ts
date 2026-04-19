import type {
  AppointmentContext,
  CopilotMode,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "./response-schema";

type PromptInput = {
  mode: CopilotMode;
  query?: string;
  url?: string;
  pageTitle?: string;
  pageSummary?: string;
  visibleText?: string;
  taskMemory?: TaskMemoryState | null;
  appointment?: AppointmentContext | null;
  userProfile?: {
    name?: string;
    ageGroup?: string;
    supportNeeds?: string[];
    preferences?: string[];
    conditions?: string[];
    notes?: string | null;
  } | UserProfileContext;
  userContextEntries?: UserContextEntry[];
  suspiciousSignals?: string[];
  riskLevel?: string;
};

function section(label: string, value?: string | null) {
  if (!value) {
    return "";
  }
  return `- ${label}: ${value}\n`;
}

export function buildCopilotPrompt(input: PromptInput) {
  const userProfile = input.userProfile
    ? [
        `- Name: ${input.userProfile.name || "Unknown"}`,
        `- Age group: ${input.userProfile.ageGroup || "Unknown"}`,
        ...(input.userProfile.supportNeeds || []).map((item) => `- Support need: ${item}`),
        ...(input.userProfile.preferences || []).map((item) => `- Preference: ${item}`),
        ...(input.userProfile.conditions || []).map((item) => `- Condition: ${item}`),
        input.userProfile.notes ? `- Notes: ${input.userProfile.notes}` : "",
      ].join("\n")
    : "- User profile: Not available";

  const contextEntries = input.userContextEntries?.length
    ? input.userContextEntries
        .map((entry) => `- ${entry.category}: ${entry.title} — ${entry.detail}`)
        .join("\n")
    : "- User context entries: Not available";

  return [
    "You are SafeStep, a calm browser copilot for an older adult with memory support needs.",
    "Use very simple language. Short sentences. One idea at a time.",
    "Never shame the user. Never rush them.",
    "If the page looks suspicious, say so plainly and recommend pausing before sharing information.",
    "Always return valid JSON only, with no markdown and no code fences.",
    "",
    "Return an object with these fields:",
    '{ "mode": "guidance | scam_check | appointment | memory_recall", "summary": "string", "nextStep": "string", "explanation": "string", "riskLevel": "safe | uncertain | risky", "suspiciousSignals": ["string"], "memoryUpdate": { "currentTask": "string", "lastStep": "string" } }',
    "",
    `Requested mode: ${input.mode}`,
    `Risk hint: ${input.riskLevel || "unknown"}`,
    input.suspiciousSignals?.length
      ? `Known suspicious signals: ${input.suspiciousSignals.join(", ")}`
      : "Known suspicious signals: none",
    "",
    "User profile:",
    userProfile,
    "",
    "User context entries:",
    contextEntries,
    "",
    "Visible browser context:",
    section("URL", input.url),
    section("Page title", input.pageTitle),
    section("Page summary", input.pageSummary),
    section("User query", input.query),
    section("Visible text", input.visibleText),
    "",
    ...(input.mode !== "scam_check" ? [
      "Memory context:",
      section("Current task", input.taskMemory?.currentTask || null),
      section("Task goal", input.taskMemory?.taskGoal || null),
      section("Last step", input.taskMemory?.lastStep || null),
      section("Current stage", input.taskMemory?.currentStageTitle || null),
      section("Next stage", input.taskMemory?.nextStageTitle || null),
      "",
      "Appointment context:",
      section("Summary", input.appointment?.summary || null),
      section("When", input.appointment?.whenLabel || null),
      section("Location", input.appointment?.location || null),
    ] : []),
    "",
    "Writing rules:",
    "- summary: one short sentence describing the page and whether it seems safe.",
    "- nextStep: the main answer. Say exactly what the user should do next on this page, ideally the exact button or link label to press.",
    "- explanation: 2 to 3 short sentences. Be specific — name actual words, phrases, buttons, or links you see on the page. Do not give generic advice.",
    "- riskLevel: safe if the page seems legitimate, uncertain if anything is odd, risky if it pressures the user or asks for sensitive info.",
    "- suspiciousSignals: quote specific words or phrases from the page that seem pressuring, unusual, or risky. Include notable features (login forms, payment fields, countdown timers, prize claims). If the page seems safe, still list 1-2 notable features you observe. Never leave this array empty.",
    "- memoryUpdate: include a currentTask and lastStep when useful.",
    input.mode === "scam_check"
      ? "\nIMPORTANT for scam_check: Read the visible text carefully. Your response must reference actual content from the page. Do not give a generic answer. If the page is safe, say what makes it look legitimate. If it is risky, quote the specific words that concern you."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
