import { cookies } from "next/headers";
import { loadUserContextFromCookies } from "@/lib/user-context";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const context = await loadUserContextFromCookies(cookieStore);
    return Response.json(context);
  } catch (error) {
    console.error("User context error:", error);
    return Response.json(
      {
        profile: null,
        entries: [],
        source: "demo",
      },
      { status: 500 },
    );
  }
}
