export type CopilotMode =
  | "guidance"
  | "scam_check"
  | "appointment"
  | "memory_recall";

export type RiskLevel = "safe" | "uncertain" | "risky";

export type CopilotResponse = {
  mode: CopilotMode;
  summary?: string;
  nextStep?: string;
  explanation?: string;
  riskLevel?: RiskLevel;
  suspiciousSignals?: string[];
  memoryUpdate?: {
    currentTask?: string;
    lastStep?: string;
  };
};

export type TaskMemoryState = {
  currentTask?: string | null;
  lastStep?: string | null;
  currentUrl?: string | null;
  pageTitle?: string | null;
};

export type AppointmentContext = {
  connected?: boolean;
  summary?: string | null;
  whenLabel?: string | null;
  timeLabel?: string | null;
  location?: string | null;
  description?: string | null;
  source?: string | null;
};

export type UserProfileContext = {
  userId: string;
  name: string;
  email?: string | null;
  timezone?: string | null;
  ageGroup?: string | null;
  calendarConnected?: boolean | null;
  supportNeeds: string[];
  preferences: string[];
  conditions: string[];
  notes?: string | null;
};

export type UserContextEntry = {
  id: string;
  category: "condition" | "preference" | "routine" | "support" | "alert";
  title: string;
  detail: string;
  tags: string[];
  priority?: number | null;
};

export type CopilotRequest = {
  mode?: CopilotMode | "auto";
  query?: string;
  url?: string;
  pageTitle?: string;
  visibleText?: string;
  pageSummary?: string;
  taskMemory?: TaskMemoryState | null;
  appointment?: AppointmentContext | null;
  userProfile?: UserProfileContext | null;
  userContextEntries?: UserContextEntry[];
};

export const DEFAULT_COPILOT_RESPONSE: CopilotResponse = {
  mode: "guidance",
  summary: "I’m ready to help.",
  nextStep: "Tell me what page you are on or what you want to do next.",
  explanation: "I can look at the page, help you stay safe, and remind you what comes next.",
  riskLevel: "uncertain",
  suspiciousSignals: [],
};

export function normalizeCopilotResponse(
  value: Partial<CopilotResponse> | null | undefined,
  fallbackMode: CopilotResponse["mode"],
): CopilotResponse {
  return {
    mode: value?.mode || fallbackMode,
    summary: value?.summary || DEFAULT_COPILOT_RESPONSE.summary,
    nextStep: value?.nextStep || DEFAULT_COPILOT_RESPONSE.nextStep,
    explanation: value?.explanation || DEFAULT_COPILOT_RESPONSE.explanation,
    riskLevel: value?.riskLevel || DEFAULT_COPILOT_RESPONSE.riskLevel,
    suspiciousSignals: Array.isArray(value?.suspiciousSignals)
      ? value!.suspiciousSignals
      : [],
    memoryUpdate: value?.memoryUpdate
      ? {
          currentTask: value.memoryUpdate.currentTask || undefined,
          lastStep: value.memoryUpdate.lastStep || undefined,
        }
      : undefined,
  };
}
