"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadUserContextForCurrentAccount = loadUserContextForCurrentAccount;
exports.loadUserContextByIdentity = loadUserContextByIdentity;
exports.loadUserContextFromCookies = loadUserContextFromCookies;
exports.summarizeUserContext = summarizeUserContext;
const headers_1 = require("next/headers");
const google_account_1 = require("./google-account");
const supabase_server_1 = require("./supabase-server");
const mock_context_1 = require("./mock-context");
function toStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === "string");
}
function fallbackStringArray(value, fallback) {
    const items = toStringArray(value);
    return items.length > 0 ? items : fallback;
}
function buildFallbackProfile(identity) {
    const email = identity?.email || mock_context_1.DEMO_USER_PROFILE.email;
    const name = identity?.name || mock_context_1.DEMO_USER_PROFILE.name;
    return {
        ...mock_context_1.DEMO_USER_PROFILE,
        userId: identity?.userId || mock_context_1.DEMO_USER_ID,
        googleEmail: email,
        googleName: name,
        name,
        email,
        calendarConnected: Boolean(identity?.connected),
    };
}
function toUserProfileContext(row) {
    return {
        userId: String(row?.user_id || mock_context_1.DEMO_USER_ID),
        googleEmail: row?.google_email || null,
        googleName: row?.google_name || null,
        name: String(row?.name || mock_context_1.DEMO_USER_PROFILE.name),
        email: row?.email || mock_context_1.DEMO_USER_PROFILE.email,
        timezone: row?.timezone || mock_context_1.DEMO_USER_PROFILE.timezone,
        ageGroup: row?.age_group || mock_context_1.DEMO_USER_PROFILE.ageGroup,
        calendarConnected: typeof row?.calendar_connected === "boolean"
            ? row.calendar_connected
            : mock_context_1.DEMO_USER_PROFILE.calendarConnected,
        supportNeeds: fallbackStringArray(row?.support_needs, mock_context_1.DEMO_USER_PROFILE.supportNeeds),
        preferences: fallbackStringArray(row?.preferences, mock_context_1.DEMO_USER_PROFILE.preferences),
        conditions: fallbackStringArray(row?.conditions, mock_context_1.DEMO_USER_PROFILE.conditions),
        notes: row?.notes || mock_context_1.DEMO_USER_PROFILE.notes,
        rawIntakeText: row?.raw_intake_text || mock_context_1.DEMO_USER_PROFILE.rawIntakeText,
        onboardingSummary: row?.onboarding_summary || mock_context_1.DEMO_USER_PROFILE.onboardingSummary,
        onboardingCompletedAt: row?.onboarding_completed_at || mock_context_1.DEMO_USER_PROFILE.onboardingCompletedAt,
    };
}
function toUserContextEntry(row) {
    return {
        id: String(row.id || crypto.randomUUID()),
        category: row.category === "condition" ||
            row.category === "preference" ||
            row.category === "routine" ||
            row.category === "support" ||
            row.category === "alert"
            ? row.category
            : "support",
        title: String(row.title || "Untitled"),
        detail: String(row.detail || ""),
        tags: toStringArray(row.tags),
        priority: typeof row.priority === "number"
            ? row.priority
            : typeof row.priority === "string" && !Number.isNaN(Number(row.priority))
                ? Number(row.priority)
                : null,
    };
}
function buildCalendarIdentityProfile(identity) {
    return {
        ...buildFallbackProfile(identity),
        userId: identity.userId,
        googleEmail: identity.email || null,
        googleName: identity.name || null,
        name: identity.name || identity.email || mock_context_1.DEMO_USER_PROFILE.name,
        email: identity.email || mock_context_1.DEMO_USER_PROFILE.email,
        calendarConnected: true,
    };
}
async function loadSupabaseUserContext(supabase, identity) {
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
            ? toUserProfileContext(profileResult.data)
            : buildCalendarIdentityProfile(identity),
        entries: (entriesResult.data || []).map((row) => toUserContextEntry(row)),
        source: "supabase",
    };
}
async function loadUserContextForCurrentAccount() {
    const cookieStore = await (0, headers_1.cookies)();
    const identity = await (0, google_account_1.loadGoogleIdentityFromCookies)(cookieStore);
    const supabase = (0, supabase_server_1.hasSupabaseConfig)() ? (0, supabase_server_1.createServerSupabaseClient)() : null;
    if (!identity) {
        return {
            profile: mock_context_1.DEMO_USER_PROFILE,
            entries: mock_context_1.DEMO_USER_CONTEXT_ENTRIES,
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
async function loadUserContextByIdentity(identity) {
    const supabase = (0, supabase_server_1.hasSupabaseConfig)() ? (0, supabase_server_1.createServerSupabaseClient)() : null;
    if (!identity) {
        return {
            profile: mock_context_1.DEMO_USER_PROFILE,
            entries: mock_context_1.DEMO_USER_CONTEXT_ENTRIES,
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
async function loadUserContextFromCookies(cookieStore) {
    const identity = await (0, google_account_1.loadGoogleIdentityFromCookies)(cookieStore);
    return loadUserContextByIdentity(identity);
}
function summarizeUserContext(entries) {
    return entries
        .map((entry) => `${entry.title}: ${entry.detail}`)
        .join("\n");
}
