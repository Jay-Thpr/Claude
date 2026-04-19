import { updateCallSession, type CallSessionStatus } from "@/lib/call-store";
import { logger } from "@/lib/logger";
import {
  getPublicWebhookUrl,
  requireTwilioAuthToken,
  validateTwilioRequest,
} from "@/lib/twilio-security";

function mapTwilioStatus(status: string | null): CallSessionStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "initiated":
      return "initiated";
    case "ringing":
      return "ringing";
    case "in-progress":
      return "in-progress";
    case "completed":
      return "completed";
    case "busy":
      return "busy";
    case "no-answer":
      return "no-answer";
    case "canceled":
      return "canceled";
    default:
      return "failed";
  }
}

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
    const signatureHeader = request.headers.get("x-twilio-signature");
    const isValid = validateTwilioRequest({
      authToken: requireTwilioAuthToken(),
      signatureHeader,
      url: getPublicWebhookUrl(`/api/calls/${sessionId}/status`),
      formFields: fields,
    });

    if (!isValid) {
      logger.warn("call-status-route", "Rejected Twilio callback with invalid signature", {
        sessionId,
      });
      return Response.json({ error: "Invalid Twilio signature." }, { status: 403 });
    }

    const callStatus = fields.CallStatus || "";
    const callSid = fields.CallSid || "";
    const callDuration = fields.CallDuration ? Number(fields.CallDuration) : null;
    const recordingUrl = fields.RecordingUrl || null;
    const recordingSid = fields.RecordingSid || null;

    const nextStatus = mapTwilioStatus(callStatus || null);
    const patch = {
      twilio_call_sid: callSid || null,
      status: nextStatus,
      call_duration_seconds:
        Number.isFinite(callDuration) && callDuration !== null ? callDuration : null,
      recording_url: recordingUrl,
      recording_sid: recordingSid,
      status_message: callStatus
        ? `Twilio reported ${callStatus}.`
        : "Twilio status callback received.",
      disposition:
        nextStatus === "completed"
          ? "completed"
          : nextStatus === "busy" || nextStatus === "no-answer" || nextStatus === "failed"
            ? "unresolved"
            : undefined,
      outcome_summary:
        nextStatus === "completed"
          ? "Call connected and completed."
          : nextStatus === "busy"
            ? "Provider line was busy."
            : nextStatus === "no-answer"
              ? "Provider did not answer."
              : nextStatus === "failed"
                ? "Call could not be completed."
                : undefined,
    };

    await updateCallSession(sessionId, patch);

    return Response.json({ success: true });
  } catch (err) {
    logger.error("call-status-route", "Failed to process Twilio status callback", err);
    return Response.json({ error: "Failed to update call status." }, { status: 500 });
  }
}
