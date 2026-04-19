import { DEMO_USER_ID } from "@/lib/mock-context";
import { loadUserContext } from "@/lib/user-context";

export async function GET() {
  try {
    const context = await loadUserContext(DEMO_USER_ID);
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
