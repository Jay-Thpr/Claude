import { logger } from "@/lib/logger";
import { updateCallSession } from "@/lib/call-store";
import {
  getPublicWebhookUrl,
  requireTwilioAuthToken,
  validateTwilioRequest,
} from "@/lib/twilio-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const formData = await request.formData();
    const fields = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
    );

    const isValid = validateTwilioRequest({
      authToken: requireTwilioAuthToken(),
      signatureHeader: request.headers.get("x-twilio-signature"),
      url: getPublicWebhookUrl(`/api/calls/${sessionId}/stream-status`),
      formFields: fields,
    });

    if (!isValid) {
      return Response.json({ error: "Invalid Twilio signature." }, { status: 403 });
    }

    const streamEvent = fields.StreamEvent || "stream-update";
    const streamError = fields.StreamError || null;
    const streamSid = fields.StreamSid || null;

    await updateCallSession(sessionId, {
      status_message: streamError
        ? `Voice stream error: ${streamError}`
        : `Voice stream event: ${streamEvent}.`,
      transcript_excerpt: streamSid
        ? `Twilio stream ${streamEvent}: ${streamSid}`
        : undefined,
    });

    return Response.json({ success: true });
  } catch (err) {
    logger.error("call-stream-status-route", "Failed to process Twilio stream status", err);
    return Response.json({ error: "Failed to update stream status." }, { status: 500 });
  }
}
