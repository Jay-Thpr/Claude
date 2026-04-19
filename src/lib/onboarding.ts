import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GoogleIdentity } from "@/lib/user-context";
import type {
  UserContextEntry,
  UserProfileContext,
} from "@/lib/response-schema";

export type OnboardingProfileDraft = {
  name?: string;
  ageGroup?: string;
  timezone?: string;
  supportNeeds: string[];
  preferences: string[];
  conditions: string[];
  notes?: string;
  summary: string;
  contextEntries: UserContextEntry[];
};

const DEFAULT_MODEL = process.env.SAFESTEP_GEMINI_MODEL || "gemini-2.5-flash-lite";

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return new GoogleGenerativeAI(apiKey);
}

function safeParseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}

function fallbackDraft(intakeText: string, identity: GoogleIdentity | null): OnboardingProfileDraft {
  const lines = intakeText
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean)
    .slice(0, 5);

  const entries: UserContextEntry[] = lines.map((line, index) => ({
    id: crypto.randomUUID(),
    category: /medication|prescription|condition|diagnos|memory|appointment/i.test(line)
      ? "condition"
      : "support",
    title: line.slice(0, 48),
    detail: line,
    tags: line
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)
      .slice(0, 4),
    priority: index < 2 ? 1 : 2,
  }));

  return {
    name: identity?.name || undefined,
    ageGroup: "older adult",
    timezone: "America/Los_Angeles",
    supportNeeds: ["Needs simple, calm instructions"],
    preferences: ["One step at a time"],
    conditions: [],
    notes: "Imported from onboarding intake text.",
    summary: "Imported onboarding information from the pasted medical history.",
    contextEntries: entries,
  };
}

export async function extractOnboardingDraft(
  intakeText: string,
  identity: GoogleIdentity | null,
): Promise<OnboardingProfileDraft> {
  const genAI = buildGenAI();
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `You are helping SafeStep turn a pasted medical-history intake into a structured user profile.

Return valid JSON only with these fields:
{
  "name": "string or null",
  "ageGroup": "string or null",
  "timezone": "string or null",
  "supportNeeds": ["short phrases"],
  "preferences": ["short phrases"],
  "conditions": ["short phrases"],
  "notes": "short note or null",
  "summary": "one sentence summary",
  "contextEntries": [
    {
      "category": "condition | preference | routine | support | alert",
      "title": "short title",
      "detail": "one sentence detail",
      "tags": ["short tags"],
      "priority": 1
    }
  ]
}

Rules:
- Be conservative and only extract what is supported by the text.
- Do not invent a diagnosis.
- Prefer short, plain-language labels.
- If a field is unknown, use null or an empty array.
- Create 3 to 6 contextEntries if possible.

Google account identity:
- Email: ${identity?.email || "unknown"}
- Name: ${identity?.name || "unknown"}

Pasted intake text:
${intakeText}`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = safeParseJson<Partial<OnboardingProfileDraft>>(result.response.text());
    if (!parsed) {
      return fallbackDraft(intakeText, identity);
    }

    const contextEntries = Array.isArray(parsed.contextEntries)
      ? parsed.contextEntries
          .filter(Boolean)
          .map((entry) => ({
            id: crypto.randomUUID(),
            category:
              entry.category === "condition" ||
              entry.category === "preference" ||
              entry.category === "routine" ||
              entry.category === "support" ||
              entry.category === "alert"
                ? entry.category
                : "support",
            title: String(entry.title || "Imported note"),
            detail: String(entry.detail || ""),
            tags: Array.isArray(entry.tags)
              ? entry.tags.filter((tag): tag is string => typeof tag === "string")
              : [],
            priority:
              typeof entry.priority === "number"
                ? entry.priority
                : entry.priority === null
                  ? null
                  : 2,
          }))
      : [];

    return {
      name: parsed.name || identity?.name || undefined,
      ageGroup: parsed.ageGroup || undefined,
      timezone: parsed.timezone || "America/Los_Angeles",
      supportNeeds: Array.isArray(parsed.supportNeeds) ? parsed.supportNeeds.filter((item): item is string => typeof item === "string") : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences.filter((item): item is string => typeof item === "string") : [],
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions.filter((item): item is string => typeof item === "string") : [],
      notes: parsed.notes || undefined,
      summary: parsed.summary || "Imported onboarding information from the pasted medical history.",
      contextEntries,
    };
  } catch {
    return fallbackDraft(intakeText, identity);
  }
}

export function buildProfileUpsertValues(
  identity: GoogleIdentity,
  draft: OnboardingProfileDraft,
  intakeText: string,
): Partial<UserProfileContext> & { userId: string } {
  return {
    userId: identity.userId,
    googleEmail: identity.email || null,
    googleName: identity.name || null,
    name: draft.name || identity.name || identity.email || "SafeStep user",
    email: identity.email || null,
    timezone: draft.timezone || "America/Los_Angeles",
    ageGroup: draft.ageGroup || null,
    calendarConnected: true,
    supportNeeds: draft.supportNeeds,
    preferences: draft.preferences,
    conditions: draft.conditions,
    notes: draft.notes || null,
    rawIntakeText: intakeText,
    onboardingSummary: draft.summary,
    onboardingCompletedAt: new Date().toISOString(),
  };
}
