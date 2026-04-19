import { cookies } from "next/headers";
import { loadGoogleIdentityFromCookies, type GoogleIdentity } from "@/lib/google-account";
import { createServerSupabaseClient, hasSupabaseConfig } from "@/lib/supabase-server";

export type AppAccessState = {
  identity: GoogleIdentity | null;
  loginCompletedAt: string | null;
  onboarded: boolean;
  profileCompletedAt: string | null;
};

type PersistedAccessState = {
  loginCompletedAt: string | null;
  profileCompletedAt: string | null;
};

async function loadPersistedAccessState(identity: GoogleIdentity): Promise<PersistedAccessState> {
  if (!hasSupabaseConfig()) {
    return {
      loginCompletedAt: null,
      profileCompletedAt: null,
    };
  }

  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      loginCompletedAt: null,
      profileCompletedAt: null,
    };
  }

  const query = () =>
    supabase
      .from("user_profiles")
      .select("login_completed_at, onboarding_completed_at")
      .or(`user_id.eq.${identity.userId},google_email.eq.${identity.email}`)
      .maybeSingle();

  let { data, error } = await query();
  if (error && /login_completed_at|column .* does not exist/i.test(error.message || "")) {
    ({ data, error } = await supabase
      .from("user_profiles")
      .select("onboarding_completed_at")
      .or(`user_id.eq.${identity.userId},google_email.eq.${identity.email}`)
      .maybeSingle());
  }

  if (error) {
    return {
      loginCompletedAt: null,
      profileCompletedAt: null,
    };
  }

  return {
    loginCompletedAt: (data?.login_completed_at as string | null | undefined) || null,
    profileCompletedAt: (data?.onboarding_completed_at as string | null | undefined) || null,
  };
}

export async function loadAppAccessState(): Promise<AppAccessState> {
  const cookieStore = await cookies();
  const identity = await loadGoogleIdentityFromCookies(cookieStore);

  if (!identity) {
    return {
      identity: null,
      loginCompletedAt: null,
      onboarded: false,
      profileCompletedAt: null,
    };
  }

  const persisted = await loadPersistedAccessState(identity);

  return {
    identity,
    loginCompletedAt: persisted.loginCompletedAt,
    onboarded: Boolean(persisted.profileCompletedAt),
    profileCompletedAt: persisted.profileCompletedAt,
  };
}
