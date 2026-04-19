import { getCallSession } from "@/lib/call-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const session = await getCallSession(sessionId);

  if (!session) {
    return Response.json({ error: "Call session not found." }, { status: 404 });
  }

  return Response.json({
    success: true,
    session,
  });
}
