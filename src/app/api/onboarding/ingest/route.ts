import { cookies } from "next/headers";
import { loadGoogleIdentityFromCookies } from "@/lib/user-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildProfileUpsertValues,
  extractOnboardingDraft,
} from "@/lib/onboarding";

type OnboardingRequest = {
  intakeText?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OnboardingRequest;
    const intakeText = body.intakeText?.trim();
    if (!intakeText) {
      return Response.json(
        { error: "Please paste your medical history or background notes first." },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const identity = await loadGoogleIdentityFromCookies(cookieStore);
    if (!identity?.email) {
      return Response.json(
        {
          error:
            "Connect Google Calendar first so SafeStep can associate this profile with your Google account.",
        },
        { status: 409 },
      );
    }

    const supabase = createServerSupabaseClient();
    if (!supabase) {
      return Response.json(
        {
          error:
            "Supabase is not configured yet. Add the service role key before importing onboarding data.",
        },
        { status: 503 },
      );
    }

    const draft = await extractOnboardingDraft(intakeText, identity);
    const profileValues = buildProfileUpsertValues(identity, draft, intakeText);

    const { error: profileError } = await supabase.from("user_profiles").upsert(
      {
        user_id: profileValues.userId,
        google_email: profileValues.googleEmail,
        google_name: profileValues.googleName,
        name: profileValues.name,
        email: profileValues.email,
        timezone: profileValues.timezone,
        age_group: profileValues.ageGroup,
        calendar_connected: true,
        support_needs: profileValues.supportNeeds,
        preferences: profileValues.preferences,
        conditions: profileValues.conditions,
        notes: profileValues.notes,
        raw_intake_text: profileValues.rawIntakeText,
        onboarding_summary: profileValues.onboardingSummary,
        onboarding_completed_at: profileValues.onboardingCompletedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (profileError) {
      throw profileError;
    }

    const { error: deleteError } = await supabase
      .from("user_context_entries")
      .delete()
      .eq("user_id", identity.userId);

    if (deleteError) {
      throw deleteError;
    }

    if (draft.contextEntries.length > 0) {
      const { error: entriesError } = await supabase.from("user_context_entries").insert(
        draft.contextEntries.map((entry) => ({
          user_id: identity.userId,
          category: entry.category,
          title: entry.title,
          detail: entry.detail,
          tags: entry.tags,
          priority: entry.priority ?? null,
        })),
      );

      if (entriesError) {
        throw entriesError;
      }
    }

    return Response.json({
      success: true,
      userId: identity.userId,
      googleEmail: identity.email,
      profile: profileValues,
      summary: draft.summary,
      entriesCount: draft.contextEntries.length,
      source: "supabase",
    });
  } catch (error) {
    console.error("Onboarding ingest error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import onboarding information.",
      },
      { status: 500 },
    );
  }
}
