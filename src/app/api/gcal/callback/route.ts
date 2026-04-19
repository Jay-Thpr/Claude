import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  GCAL_COOKIE_NAMES,
  deleteCookie,
  exchangeCodeForTokens,
  fetchUserProfile,
  parseCookieValue,
  setJsonCookie,
} from "@/lib/gcal";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = parseCookieValue<{ state: string }>(
    cookieStore.get(GCAL_COOKIE_NAMES.state)?.value,
  );

  try {
    if (error) {
      await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.state);
      return NextResponse.redirect(
        new URL(`/?gcal=${encodeURIComponent(error)}`, url.origin),
      );
    }

    if (!code) {
      throw new Error("Missing authorization code.");
    }

    if (!storedState?.state || storedState.state !== state) {
      throw new Error("OAuth state mismatch. Please try connecting again.");
    }

    const tokenData = await exchangeCodeForTokens(code);
    const profile = await fetchUserProfile(tokenData.access_token).catch(() => null);
    const expiryDate = tokenData.expires_in
      ? Date.now() + tokenData.expires_in * 1000
      : undefined;

    await setJsonCookie(cookieStore, GCAL_COOKIE_NAMES.tokens, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: expiryDate,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
    });

    if (profile) {
      await setJsonCookie(cookieStore, GCAL_COOKIE_NAMES.profile, profile);

      const supabase = createServerSupabaseClient();
      const email = profile.email?.trim().toLowerCase() || null;
      if (supabase && email) {
        const now = new Date().toISOString();
        const baseRow = {
          user_id: email,
          google_email: email,
          google_name: profile.name || null,
          name: profile.name || email,
          email,
          calendar_connected: true,
          login_completed_at: now,
          updated_at: now,
        };

        let upsertResult = await supabase.from("user_profiles").upsert(baseRow, {
          onConflict: "user_id",
        });

        if (
          upsertResult.error &&
          /login_completed_at|column .* does not exist/i.test(upsertResult.error.message || "")
        ) {
          const fallbackRow = { ...baseRow };
          delete fallbackRow.login_completed_at;
          upsertResult = await supabase.from("user_profiles").upsert(fallbackRow, {
            onConflict: "user_id",
          });
        }

        if (upsertResult.error) {
          throw upsertResult.error;
        }
      }
    }

    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.state);

    return NextResponse.redirect(new URL("/onboarding?gcal=connected", url.origin));
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.state);
    return NextResponse.redirect(
      new URL(
        `/?gcal=error&message=${encodeURIComponent(
          err instanceof Error ? err.message : "Unable to connect Google Calendar.",
        )}`,
        url.origin,
      ),
    );
  }
}
