import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasSupabaseConfig } from "@/lib/supabase-server";
import {
  DEMO_USER_CONTEXT_ENTRIES,
  DEMO_USER_ID,
  DEMO_USER_PROFILE,
} from "@/lib/mock-context";
import type {
  UserContextEntry,
  UserProfileContext,
} from "@/lib/response-schema";

export type LoadedUserContext = {
  profile: UserProfileContext;
  entries: UserContextEntry[];
  source: "supabase" | "demo";
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function fallbackStringArray(value: unknown, fallback: string[]) {
  const items = toStringArray(value);
  return items.length > 0 ? items : fallback;
}

function toUserProfileContext(row: Record<string, unknown> | null | undefined): UserProfileContext {
  return {
    userId: String(row?.user_id || DEMO_USER_ID),
    name: String(row?.name || DEMO_USER_PROFILE.name),
    email: (row?.email as string | null | undefined) || DEMO_USER_PROFILE.email,
    timezone: (row?.timezone as string | null | undefined) || DEMO_USER_PROFILE.timezone,
    ageGroup: (row?.age_group as string | null | undefined) || DEMO_USER_PROFILE.ageGroup,
    calendarConnected:
      typeof row?.calendar_connected === "boolean"
        ? row.calendar_connected
        : DEMO_USER_PROFILE.calendarConnected,
    supportNeeds: fallbackStringArray(row?.support_needs, DEMO_USER_PROFILE.supportNeeds),
    preferences: fallbackStringArray(row?.preferences, DEMO_USER_PROFILE.preferences),
    conditions: fallbackStringArray(row?.conditions, DEMO_USER_PROFILE.conditions),
    notes: (row?.notes as string | null | undefined) || DEMO_USER_PROFILE.notes,
  };
}

function toUserContextEntry(row: Record<string, unknown>): UserContextEntry {
  return {
    id: String(row.id || crypto.randomUUID()),
    category:
      row.category === "condition" ||
      row.category === "preference" ||
      row.category === "routine" ||
      row.category === "support" ||
      row.category === "alert"
        ? row.category
        : "support",
    title: String(row.title || "Untitled"),
    detail: String(row.detail || ""),
    tags: toStringArray(row.tags),
    priority:
      typeof row.priority === "number"
        ? row.priority
        : typeof row.priority === "string" && !Number.isNaN(Number(row.priority))
          ? Number(row.priority)
          : null,
  };
}

async function loadSupabaseUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedUserContext | null> {
  const profileResult = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileResult.error) {
    return null;
  }

  const entriesResult = await supabase
    .from("user_context_entries")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(20);

  if (entriesResult.error) {
    return null;
  }

  return {
    profile: toUserProfileContext(profileResult.data as Record<string, unknown> | null),
    entries: (entriesResult.data || []).map((row) => toUserContextEntry(row as Record<string, unknown>)),
    source: "supabase",
  };
}

export async function loadUserContext(userId = DEMO_USER_ID): Promise<LoadedUserContext> {
  const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;
  if (!supabase) {
    return {
      profile: DEMO_USER_PROFILE,
      entries: DEMO_USER_CONTEXT_ENTRIES,
      source: "demo",
    };
  }

  const loaded = await loadSupabaseUserContext(supabase, userId).catch(() => null);
  if (!loaded) {
    return {
      profile: DEMO_USER_PROFILE,
      entries: DEMO_USER_CONTEXT_ENTRIES,
      source: "demo",
    };
  }

  return loaded;
}

export function summarizeUserContext(entries: UserContextEntry[]) {
  return entries
    .map((entry) => `${entry.title}: ${entry.detail}`)
    .join("\n");
}
