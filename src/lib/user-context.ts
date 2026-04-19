import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { loadCalendarSnapshot, type GCalProfile } from "@/lib/gcal";
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
  source: "supabase" | "calendar" | "demo";
};

export type GoogleIdentity = {
  userId: string;
  email?: string;
  name?: string;
  connected: boolean;
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

function normalizeGoogleIdentity(profile: GCalProfile | null | undefined): GoogleIdentity | null {
  const email = profile?.email?.trim() || "";
  if (!email) {
    return null;
  }

  return {
    userId: email.toLowerCase(),
    email,
    name: profile?.name || undefined,
    connected: true,
  };
}

export async function loadGoogleIdentityFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<GoogleIdentity | null> {
  try {
    const snapshot = await loadCalendarSnapshot(cookieStore);
    return normalizeGoogleIdentity(snapshot.profile);
  } catch {
    return null;
  }
}

function buildFallbackProfile(identity: GoogleIdentity | null): UserProfileContext {
  const email = identity?.email || DEMO_USER_PROFILE.email;
  const name = identity?.name || DEMO_USER_PROFILE.name;

  return {
    ...DEMO_USER_PROFILE,
    userId: identity?.userId || DEMO_USER_ID,
    googleEmail: email,
    googleName: name,
    name,
    email,
    calendarConnected: Boolean(identity?.connected),
  };
}

function toUserProfileContext(row: Record<string, unknown> | null | undefined): UserProfileContext {
  return {
    userId: String(row?.user_id || DEMO_USER_ID),
    googleEmail: (row?.google_email as string | null | undefined) || null,
    googleName: (row?.google_name as string | null | undefined) || null,
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
    rawIntakeText: (row?.raw_intake_text as string | null | undefined) || DEMO_USER_PROFILE.rawIntakeText,
    onboardingSummary:
      (row?.onboarding_summary as string | null | undefined) || DEMO_USER_PROFILE.onboardingSummary,
    onboardingCompletedAt:
      (row?.onboarding_completed_at as string | null | undefined) || DEMO_USER_PROFILE.onboardingCompletedAt,
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

function buildCalendarIdentityProfile(identity: GoogleIdentity): UserProfileContext {
  return {
    ...buildFallbackProfile(identity),
    userId: identity.userId,
    googleEmail: identity.email || null,
    googleName: identity.name || null,
    name: identity.name || identity.email || DEMO_USER_PROFILE.name,
    email: identity.email || DEMO_USER_PROFILE.email,
    calendarConnected: true,
  };
}

async function loadSupabaseUserContext(
  supabase: SupabaseClient,
  identity: GoogleIdentity,
): Promise<LoadedUserContext | null> {
  const profileResult = await supabase
    .from("user_profiles")
    .select("*")
    .or(`user_id.eq.${identity.userId},google_email.eq.${identity.email}`)
    .maybeSingle();

  if (profileResult.error) {
    return null;
  }

  const entriesResult = await supabase
    .from("user_context_entries")
    .select("*")
    .or(`user_id.eq.${identity.userId},user_id.eq.${identity.email}`)
    .order("priority", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(20);

  if (entriesResult.error) {
    return null;
  }

  return {
    profile: profileResult.data
      ? toUserProfileContext(profileResult.data as Record<string, unknown>)
      : buildCalendarIdentityProfile(identity),
    entries: (entriesResult.data || []).map((row) => toUserContextEntry(row as Record<string, unknown>)),
    source: "supabase",
  };
}

export async function loadUserContextForCurrentAccount(): Promise<LoadedUserContext> {
  const cookieStore = await cookies();
  const identity = await loadGoogleIdentityFromCookies(cookieStore);
  const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;

  if (!identity) {
    return {
      profile: DEMO_USER_PROFILE,
      entries: DEMO_USER_CONTEXT_ENTRIES,
      source: "demo",
    };
  }

  if (!supabase) {
    return {
      profile: buildCalendarIdentityProfile(identity),
      entries: [],
      source: "calendar",
    };
  }

  const loaded = await loadSupabaseUserContext(supabase, identity).catch(() => null);
  if (!loaded) {
    return {
      profile: buildCalendarIdentityProfile(identity),
      entries: [],
      source: "calendar",
    };
  }

  return loaded;
}

export async function loadUserContextByIdentity(identity: GoogleIdentity | null): Promise<LoadedUserContext> {
  const supabase = hasSupabaseConfig() ? createServerSupabaseClient() : null;

  if (!identity) {
    return {
      profile: DEMO_USER_PROFILE,
      entries: DEMO_USER_CONTEXT_ENTRIES,
      source: "demo",
    };
  }

  if (!supabase) {
    return {
      profile: buildCalendarIdentityProfile(identity),
      entries: [],
      source: "calendar",
    };
  }

  const loaded = await loadSupabaseUserContext(supabase, identity).catch(() => null);
  if (!loaded) {
    return {
      profile: buildCalendarIdentityProfile(identity),
      entries: [],
      source: "calendar",
    };
  }

  return loaded;
}

export async function loadUserContextFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<LoadedUserContext> {
  const identity = await loadGoogleIdentityFromCookies(cookieStore);
  return loadUserContextByIdentity(identity);
}

export function summarizeUserContext(entries: UserContextEntry[]) {
  return entries
    .map((entry) => `${entry.title}: ${entry.detail}`)
    .join("\n");
}
