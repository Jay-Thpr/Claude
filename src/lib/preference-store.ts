import { createServerSupabaseClient } from "./supabase-server";
import type { UserContextEntry, UserProfileContext } from "./response-schema";

type PreferenceSignal = {
  preference: string;
  title: string;
  detail: string;
  tags: string[];
};

const PREFERENCE_SIGNALS: Array<{ pattern: RegExp; signal: PreferenceSignal }> = [
  {
    pattern: /\bcalm\b|\bcalming\b|\bsteady tone\b|\bgentle tone\b/i,
    signal: {
      preference: "Calm wording",
      title: "Calm wording",
      detail: "Wants calm, gentle wording and a steady tone.",
      tags: ["calm", "tone", "gentle"],
    },
  },
  {
    pattern: /\bone step at a time\b|\bstep by step\b|\bslowly\b|\bnot rushed\b/i,
    signal: {
      preference: "One step at a time",
      title: "One step at a time",
      detail: "Prefers short, step-by-step instructions without rushing.",
      tags: ["steps", "pace", "clarity"],
    },
  },
  {
    pattern: /\bshort sentences\b|\bsimple wording\b|\bplain language\b|\bsimple language\b/i,
    signal: {
      preference: "Simple wording",
      title: "Simple wording",
      detail: "Prefers short sentences and plain language.",
      tags: ["simple", "language", "clarity"],
    },
  },
  {
    pattern: /\bremind me\b|\breminders?\b/i,
    signal: {
      preference: "Gentle reminders",
      title: "Gentle reminders",
      detail: "Wants reminders about important steps and follow-ups.",
      tags: ["reminders", "support"],
    },
  },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

export function inferPreferenceSignals(text: string): PreferenceSignal[] {
  if (!text.trim()) {
    return [];
  }

  return PREFERENCE_SIGNALS.filter(({ pattern }) => pattern.test(text)).map(({ signal }) => signal);
}

export async function persistPreferenceSignals(
  userId: string,
  inputText: string,
  profile?: UserProfileContext | null,
) {
  const signals = inferPreferenceSignals(inputText);
  if (!signals.length) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return signals.map((signal) => signal.preference);
  }

  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  const existingPreferences = Array.isArray(profileRow?.preferences)
    ? profileRow.preferences.filter((item): item is string => typeof item === "string")
    : profile?.preferences || [];

  const mergedPreferences = uniqueStrings([
    ...existingPreferences,
    ...signals.map((signal) => signal.preference),
  ]);

  const { error: updateError } = await supabase.from("user_profiles").upsert(
    {
      user_id: userId,
      google_email: profile?.googleEmail || null,
      google_name: profile?.googleName || profile?.name || null,
      name: profile?.name || profile?.googleName || "Unknown user",
      email: profile?.email || profile?.googleEmail || null,
      timezone: profile?.timezone || null,
      age_group: profile?.ageGroup || null,
      calendar_connected: Boolean(profile?.calendarConnected),
      support_needs: profile?.supportNeeds || [],
      preferences: mergedPreferences,
      conditions: profile?.conditions || [],
      notes: profile?.notes || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (updateError) {
    throw updateError;
  }

  const { data: existingEntries } = await supabase
    .from("user_context_entries")
    .select("title, detail")
    .eq("user_id", userId)
    .eq("category", "preference");

  const existingKeys = new Set(
    (existingEntries || []).map((entry) =>
      normalizeText(`${(entry as UserContextEntry).title} ${(entry as UserContextEntry).detail}`),
    ),
  );

  const entriesToInsert = signals.filter((signal) => {
    const key = normalizeText(`${signal.title} ${signal.detail}`);
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  if (entriesToInsert.length > 0) {
    const { error: entriesError } = await supabase.from("user_context_entries").insert(
      entriesToInsert.map((signal) => ({
        user_id: userId,
        category: "preference",
        title: signal.title,
        detail: signal.detail,
        tags: signal.tags,
        priority: 2,
      })),
    );

    if (entriesError) {
      throw entriesError;
    }
  }

  return signals.map((signal) => signal.preference);
}
