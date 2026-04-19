import { cancelTwilioCall } from "@/lib/twilio";
import { getCallSession, updateCallSession } from "@/lib/call-store";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = await getCallSession(sessionId);

    if (!session) {
      return Response.json({ error: "Call session not found." }, { status: 404 });
    }

    if (!session.twilio_call_sid) {
      return Response.json(
        { error: "Cannot cancel a call that does not have a Twilio call SID yet." },
        { status: 400 }
      );
    }

    const canceled = await cancelTwilioCall(session.twilio_call_sid);

    await updateCallSession(sessionId, {
      status: canceled.status === "completed" ? "canceled" : "canceled",
      disposition: "canceled-by-user",
      status_message: "Call was canceled from the SafeStep UI.",
      outcome_summary: "Call was stopped before the workflow finished.",
    });

    return Response.json({
      success: true,
      call_session_id: sessionId,
      twilio_call_sid: canceled.sid,
      status: canceled.status,
    });
  } catch (err) {
    logger.error("call-cancel-route", "Failed to cancel Twilio call", err);
    return Response.json({ error: "Failed to cancel call." }, { status: 500 });
  }
}
