import { getCallSession, updateCallSession } from "@/lib/call-store";
import { logger } from "@/lib/logger";

type VoiceEventPayload = {
  disposition?: string | null;
  callback_requested?: boolean | null;
  appointment_confirmed?: boolean | null;
  voicemail_detected?: boolean | null;
  transcript_excerpt?: string | null;
  outcome_summary?: string | null;
  status_message?: string | null;
};

function isAuthorized(request: Request) {
  const expectedSecret = process.env.TWILIO_VOICE_EVENTS_SECRET;
  if (!expectedSecret) {
    throw new Error("TWILIO_VOICE_EVENTS_SECRET is not configured.");
  }

  const header = request.headers.get("x-safestep-voice-secret");
  return header === expectedSecret;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Unauthorized voice runtime event." }, { status: 401 });
    }

    const { sessionId } = await context.params;
    const session = await getCallSession(sessionId);

    if (!session) {
      return Response.json({ error: "Call session not found." }, { status: 404 });
    }

    const body = (await request.json()) as VoiceEventPayload;

    await updateCallSession(sessionId, {
      disposition: body.disposition ?? session.disposition ?? null,
      callback_requested: body.callback_requested ?? session.callback_requested ?? null,
      appointment_confirmed: body.appointment_confirmed ?? session.appointment_confirmed ?? null,
      voicemail_detected: body.voicemail_detected ?? session.voicemail_detected ?? null,
      transcript_excerpt: body.transcript_excerpt ?? session.transcript_excerpt ?? null,
      outcome_summary: body.outcome_summary ?? session.outcome_summary ?? null,
      status_message: body.status_message ?? session.status_message ?? null,
    });

    return Response.json({ success: true });
  } catch (err) {
    logger.error("call-voice-events-route", "Failed to process voice runtime event", err);
    if (err instanceof Error && err.message.includes("TWILIO_VOICE_EVENTS_SECRET")) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json({ error: "Failed to persist voice runtime event." }, { status: 500 });
  }
}
