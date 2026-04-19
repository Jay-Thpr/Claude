import { cookies } from "next/headers";
import {
  loadGoogleIdentityFromCookies,
  resolveGoogleAccount,
} from "@/lib/google-account";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DEMO_USER_ID } from "@/lib/mock-context";
import {
  buildBasicInfoContextEntries,
  buildBasicInfoRawIntakeText,
  replaceOnboardingContextEntries,
  toStringList,
  uniqueStrings,
  upsertOnboardingProfile,
} from "@/lib/onboarding";

type BasicInfoRequest = {
  name?: string;
  email?: string;
  timezone?: string;
  ageGroup?: string;
  supportNeeds?: string[] | string;
  preferences?: string[] | string;
  conditions?: string[] | string;
  notes?: string;
  calendarConnected?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BasicInfoRequest;
    const name = body.name?.trim();
    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const identity = await loadGoogleIdentityFromCookies(cookieStore);
    const googleAccount = resolveGoogleAccount(identity, {
      email: body.email || null,
      name: body.name || null,
    });
    const email = googleAccount.email || null;
    const userId = googleAccount.userId || DEMO_USER_ID;
    const supabase = createServerSupabaseClient();

    if (!supabase) {
      return Response.json(
        {
          error:
            "Supabase is not configured yet. Add the service role key before saving onboarding data.",
        },
        { status: 503 },
      );
    }

    const supportNeeds = uniqueStrings(toStringList(body.supportNeeds));
    const preferences = uniqueStrings(toStringList(body.preferences));
    const conditions = uniqueStrings(toStringList(body.conditions));
    const notes = body.notes?.trim() || null;
    const timezone = body.timezone?.trim() || "America/Los_Angeles";
    const ageGroup = body.ageGroup?.trim() || null;
    const now = new Date().toISOString();

    const contextEntries = [
      ...buildBasicInfoContextEntries(userId, "support", supportNeeds),
      ...buildBasicInfoContextEntries(userId, "preference", preferences),
      ...buildBasicInfoContextEntries(userId, "condition", conditions),
    ];

    await upsertOnboardingProfile(supabase, {
      userId,
      googleEmail: email,
      googleName: googleAccount.name || name,
      name,
      email,
      timezone,
      ageGroup,
      calendarConnected: googleAccount.connected || Boolean(body.calendarConnected),
      loginCompletedAt: googleAccount.connected ? now : null,
      supportNeeds,
      preferences,
      conditions,
      notes,
      rawIntakeText: buildBasicInfoRawIntakeText({
        name,
        email,
        ageGroup,
        supportNeeds,
        preferences,
        conditions,
        notes,
      }),
      onboardingSummary: "Basic information saved from the onboarding form.",
      onboardingCompletedAt: new Date().toISOString(),
    });

    await replaceOnboardingContextEntries(
      supabase,
      userId,
      contextEntries,
      { categories: ["condition", "preference", "support"] },
    );

    return Response.json({
      success: true,
      status: "ok",
      userId,
      profile: {
        userId,
        name,
        email,
        timezone,
        ageGroup,
        supportNeeds,
        preferences,
        conditions,
        notes,
        calendarConnected: googleAccount.connected || Boolean(body.calendarConnected),
      },
      entriesCount: contextEntries.length,
      message: "Your basic information was saved.",
      source: "supabase",
    });
  } catch (error) {
    console.error("Basic info onboarding error:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save basic onboarding information.",
      },
      { status: 500 },
    );
  }
}
