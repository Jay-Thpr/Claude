import { cookies } from "next/headers";
import { DEMO_USER_ID } from "@/lib/mock-context";
import {
  type GoogleIdentity,
  loadGoogleIdentityFromCookies,
  resolveGoogleAccount,
} from "@/lib/google-account";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  buildProfileUpsertValues,
  extractOnboardingDraft,
  replaceOnboardingContextEntries,
  upsertOnboardingProfile,
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
    const googleAccount = resolveGoogleAccount(identity);
    if (!googleAccount.email) {
      return Response.json(
        {
          error:
            "Connect Google Calendar first so SafeStep can associate this profile with your Google account.",
        },
        { status: 409 },
      );
    }

    const safeGoogleAccount: GoogleIdentity = {
      userId: googleAccount.userId || googleAccount.email?.toLowerCase() || DEMO_USER_ID,
      email: googleAccount.email || undefined,
      name: googleAccount.name || undefined,
      connected: googleAccount.connected,
    };

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
    const profileValues = buildProfileUpsertValues(safeGoogleAccount, draft, intakeText);
    const userId = profileValues.userId;

    await upsertOnboardingProfile(supabase, profileValues);
    await replaceOnboardingContextEntries(supabase, userId, draft.contextEntries);

    return Response.json({
      success: true,
      userId,
      googleEmail: googleAccount.email,
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
