import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveGoogleAccount,
  type GoogleIdentity,
  type ResolvedGoogleAccount,
} from "@/lib/google-account";
import type { UserContextEntry } from "@/lib/response-schema";

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

export type OnboardingContextEntryInput = Pick<
  UserContextEntry,
  "category" | "title" | "detail" | "tags" | "priority"
>;

export type OnboardingProfileUpsert = {
  userId: string;
  googleEmail: string | null;
  googleName: string | null;
  name: string;
  email: string | null;
  timezone: string | null;
  ageGroup: string | null;
  calendarConnected: boolean;
  loginCompletedAt: string | null;
  supportNeeds: string[];
  preferences: string[];
  conditions: string[];
  notes: string | null;
  rawIntakeText: string;
  onboardingSummary: string | null;
  onboardingCompletedAt: string | null;
};

const DEFAULT_MODEL = process.env.SAFESTEP_GEMINI_MODEL || "gemini-3.1-flash-lite";

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return new GoogleGenerativeAI(apiKey);
}

export function toStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function buildBasicInfoContextEntries(
  userId: string,
  category: "condition" | "preference" | "support",
  items: string[],
) {
  return items.map((item, index) => ({
    user_id: userId,
    category,
    title: item.slice(0, 48),
    detail: item,
    tags: item
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
      .slice(0, 4),
    priority: index < 2 ? 1 : 2,
  }));
}

export function buildBasicInfoRawIntakeText(params: {
  name: string;
  email: string | null;
  ageGroup: string | null;
  supportNeeds: string[];
  preferences: string[];
  conditions: string[];
  notes: string | null;
}) {
  return [
    `Name: ${params.name}`,
    params.email ? `Email: ${params.email}` : null,
    params.ageGroup ? `Age group: ${params.ageGroup}` : null,
    `Support needs: ${params.supportNeeds.join(", ") || "None"}`,
    `Preferences: ${params.preferences.join(", ") || "None"}`,
    `Conditions: ${params.conditions.join(", ") || "None"}`,
    params.notes ? `Notes: ${params.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function upsertOnboardingProfile(
  supabase: SupabaseClient,
  profile: OnboardingProfileUpsert,
) {
  const now = new Date().toISOString();
  const buildRow = (includeLoginCompletedAt: boolean) => ({
    user_id: profile.userId,
    google_email: profile.googleEmail,
    google_name: profile.googleName,
    name: profile.name,
    email: profile.email,
    timezone: profile.timezone,
    age_group: profile.ageGroup,
    calendar_connected: profile.calendarConnected,
    ...(includeLoginCompletedAt && profile.loginCompletedAt
      ? { login_completed_at: profile.loginCompletedAt }
      : {}),
    support_needs: profile.supportNeeds,
    preferences: profile.preferences,
    conditions: profile.conditions,
    notes: profile.notes,
    raw_intake_text: profile.rawIntakeText,
    onboarding_summary: profile.onboardingSummary,
    onboarding_completed_at: profile.onboardingCompletedAt,
    updated_at: now,
  });

  const attempt = async (includeLoginCompletedAt: boolean) =>
    supabase.from("user_profiles").upsert(buildRow(includeLoginCompletedAt), {
      onConflict: "user_id",
    });

  let { error } = await attempt(true);
  if (error && /login_completed_at|column .* does not exist/i.test(error.message || "")) {
    ({ error } = await attempt(false));
  }

  if (error) {
    throw error;
  }
}

export async function replaceOnboardingContextEntries(
  supabase: SupabaseClient,
  userId: string,
  entries: OnboardingContextEntryInput[],
  options?: { categories?: ("condition" | "preference" | "support")[] },
) {
  let deleteQuery = supabase.from("user_context_entries").delete().eq("user_id", userId);
  if (options?.categories?.length) {
    deleteQuery = deleteQuery.in("category", options.categories);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw deleteError;
  }

  if (!entries.length) {
    return;
  }

  const { error: insertError } = await supabase.from("user_context_entries").insert(
    entries.map((entry) => ({
      user_id: userId,
      category: entry.category,
      title: entry.title,
      detail: entry.detail,
      tags: entry.tags,
      priority: entry.priority ?? null,
    })),
  );

  if (insertError) {
    throw insertError;
  }
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
  identity: GoogleIdentity | ResolvedGoogleAccount,
  draft: OnboardingProfileDraft,
  intakeText: string,
): OnboardingProfileUpsert {
  const googleAccount = resolveGoogleAccount(identity);
  return {
    userId: googleAccount.userId || identity.userId || googleAccount.email || "safestep-user",
    googleEmail: googleAccount.email || null,
    googleName: googleAccount.name || null,
    name: draft.name || googleAccount.name || googleAccount.email || "SafeStep user",
    email: googleAccount.email || null,
    timezone: draft.timezone || "America/Los_Angeles",
    ageGroup: draft.ageGroup || null,
    calendarConnected: googleAccount.connected,
    loginCompletedAt: new Date().toISOString(),
    supportNeeds: draft.supportNeeds,
    preferences: draft.preferences,
    conditions: draft.conditions,
    notes: draft.notes || null,
    rawIntakeText: intakeText,
    onboardingSummary: draft.summary,
    onboardingCompletedAt: new Date().toISOString(),
  };
}
