import type {
  AppointmentContext,
  CopilotMode,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "@/lib/response-schema";

type PromptInput = {
  mode: CopilotMode;
  query?: string;
  url?: string;
  pageTitle?: string;
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
    section("User query", input.query),
    section("Visible text", input.visibleText),
    "",
    "Memory context:",
    section("Current task", input.taskMemory?.currentTask || null),
    section("Task goal", input.taskMemory?.taskGoal || null),
    section("Last step", input.taskMemory?.lastStep || null),
    section("Current stage", input.taskMemory?.currentStageTitle || null),
    section("Current stage detail", input.taskMemory?.currentStageDetail || null),
    section("Next stage", input.taskMemory?.nextStageTitle || null),
    section("Next stage detail", input.taskMemory?.nextStageDetail || null),
    "",
    "Appointment context:",
    section("Summary", input.appointment?.summary || null),
    section("When", input.appointment?.whenLabel || null),
    section("Time", input.appointment?.timeLabel || null),
    section("Location", input.appointment?.location || null),
    section("Description", input.appointment?.description || null),
    section("Prep notes", input.appointment?.prepNotes || null),
    "",
    "Writing rules:",
    "- summary: one sentence.",
    "- nextStep: the single safest next action.",
    "- explanation: 2 to 3 short sentences.",
    "- riskLevel: match the seriousness of the page.",
    "- suspiciousSignals: list only concrete signals you can justify.",
    "- memoryUpdate: include a currentTask and lastStep when useful.",
  ]
    .filter(Boolean)
    .join("\n");
}
