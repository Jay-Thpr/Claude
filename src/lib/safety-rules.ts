import type { AppointmentContext, CopilotResponse, TaskMemoryState } from "@/lib/response-schema";

const RISKY_PATTERNS = [
  /act now/i,
  /urgent/i,
  /suspend/i,
  /password/i,
  /gift card/i,
  /wire transfer/i,
  /medicare number/i,
  /credit card/i,
  /debit card/i,
  /verify your account/i,
  /final notice/i,
  /download/i,
];

const UNCERTAIN_PATTERNS = [
  /billing/i,
  /payment/i,
  /account/i,
  /login/i,
  /sign in/i,
  /update/i,
];

export function extractSuspiciousSignals(text: string) {
  const normalized = text.trim();
  const signals = new Set<string>();

  if (!normalized) {
    return [];
  }

  for (const pattern of RISKY_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.add(pattern.source.replace(/\\/g, ""));
    }
  }

  for (const pattern of UNCERTAIN_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.add(pattern.source.replace(/\\/g, ""));
    }
  }

  return Array.from(signals);
}

export function assessRiskLevel(text: string): CopilotResponse["riskLevel"] {
  const riskyHits = RISKY_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (riskyHits >= 2) {
    return "risky";
  }
  if (riskyHits === 1) {
    return "uncertain";
  }
  if (UNCERTAIN_PATTERNS.some((pattern) => pattern.test(text))) {
    return "uncertain";
  }
  return "safe";
}

export function buildMemorySummary(
  taskMemory: TaskMemoryState | null | undefined,
  appointment: AppointmentContext | null | undefined,
) {
  const parts = [
    taskMemory?.currentTask ? `Current task: ${taskMemory.currentTask}` : null,
    taskMemory?.lastStep ? `Last step: ${taskMemory.lastStep}` : null,
    appointment?.summary ? `Next appointment: ${appointment.summary}` : null,
  ].filter(Boolean);

  return parts.join(". ");
}

export function fallbackSafetyResponse(
  text: string,
  mode: "scam_check" | "guidance" | "appointment" | "memory_recall",
) {
  const riskLevel = assessRiskLevel(text);
  const suspiciousSignals = extractSuspiciousSignals(text);

  if (mode === "scam_check") {
    return {
      mode,
      summary:
        riskLevel === "risky"
          ? "This page has a few serious warning signs."
          : "I found a few signs worth checking carefully.",
      nextStep:
        riskLevel === "risky"
          ? "Do not enter personal information yet. Ask someone you trust to review it with you."
          : "Pause before sharing anything and compare the page with the official website you expect.",
      explanation:
        riskLevel === "risky"
          ? "The page is asking for sensitive information too quickly. It is safer to stop and verify it through a known phone number or official portal."
          : "The page has some warning signs, so it is safer to pause and verify the source before typing personal details.",
      riskLevel,
      suspiciousSignals,
    };
  }

  return {
    mode,
    summary: "I can help you stay oriented and safe.",
    nextStep: "Check the page details and only continue if it matches the official site you expect.",
    explanation:
      "I am keeping the language simple and the next step small on purpose. If anything asks for money, passwords, or a rushed decision, pause and verify it first.",
    riskLevel,
    suspiciousSignals,
  };
}
