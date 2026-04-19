import { cookies } from "next/headers";
import {
  GCAL_COOKIE_NAMES,
  loadCalendarSnapshot,
  parseCookieValue,
  type GCalProfile,
} from "@/lib/gcal";

export type GoogleIdentity = {
  userId: string;
  email?: string;
  name?: string;
  connected: boolean;
};

export type ResolvedGoogleAccount = {
  userId: string | null;
  email?: string;
  name?: string;
  connected: boolean;
};

function normalizeEmail(email?: string | null) {
  const trimmed = email?.trim().toLowerCase() || "";
  return trimmed || null;
}

export function normalizeGoogleIdentity(
  profile: GCalProfile | null | undefined,
): GoogleIdentity | null {
  const email = normalizeEmail(profile?.email);
  if (!email) {
    return null;
  }

  return {
    userId: email,
    email,
    name: profile?.name?.trim() || undefined,
    connected: true,
  };
}

export async function loadGoogleIdentityFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<GoogleIdentity | null> {
  try {
    const profile = parseCookieValue<GCalProfile>(
      cookieStore.get(GCAL_COOKIE_NAMES.profile)?.value,
    );
    if (profile) {
      return normalizeGoogleIdentity(profile);
    }

    const snapshot = await loadCalendarSnapshot(cookieStore);
    return normalizeGoogleIdentity(snapshot.profile);
  } catch {
    return null;
  }
}

export function resolveGoogleAccount(
  identity: GoogleIdentity | ResolvedGoogleAccount | null,
  fallback?: { email?: string | null; name?: string | null },
) : ResolvedGoogleAccount {
  const email = normalizeEmail(identity?.email || fallback?.email) || undefined;
  const name = identity?.name?.trim() || fallback?.name?.trim() || undefined;

  return {
    userId: identity?.userId || email || null,
    email,
    name,
    connected: Boolean(identity?.connected),
  };
}
