import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    }

    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.state);

    return NextResponse.redirect(new URL("/?gcal=connected", url.origin));
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
