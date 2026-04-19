import { NextResponse } from "next/server";
import {
  GCAL_COOKIE_NAMES,
  buildGoogleAuthUrl,
  createStateValue,
  setJsonCookie,
} from "@/lib/gcal";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const state = createStateValue();
    await setJsonCookie(cookieStore, GCAL_COOKIE_NAMES.state, { state }, 10 * 60);

    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    console.error("Google Calendar connect error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to start the Google Calendar connection flow.",
      },
      { status: 500 },
    );
  }
}
