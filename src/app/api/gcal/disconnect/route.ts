import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GCAL_COOKIE_NAMES, deleteCookie } from "@/lib/gcal";

export async function POST() {
  try {
    const cookieStore = await cookies();
    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.tokens);
    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.profile);
    await deleteCookie(cookieStore, GCAL_COOKIE_NAMES.state);

    return NextResponse.json({ connected: false });
  } catch (err) {
    console.error("Google Calendar disconnect error:", err);
    return NextResponse.json(
      { error: "Unable to disconnect Google Calendar." },
      { status: 500 },
    );
  }
}
