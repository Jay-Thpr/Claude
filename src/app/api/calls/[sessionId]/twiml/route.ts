import { getCallSession } from "@/lib/call-store";
import { buildProviderIntroTwiml, buildProviderVoiceStreamTwiml } from "@/lib/twilio";
import {
  getPublicWebhookUrl,
  requireTwilioAuthToken,
  validateTwilioRequest,
} from "@/lib/twilio-security";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const formData = await request.formData();
  const fields = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  );
  const isValid = validateTwilioRequest({
    authToken: requireTwilioAuthToken(),
    signatureHeader: request.headers.get("x-twilio-signature"),
    url: getPublicWebhookUrl(`/api/calls/${sessionId}/twiml`),
    formFields: fields,
  });

  if (!isValid) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Request could not be verified.</Say><Hangup/></Response>`,
      {
        status: 403,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      }
    );
  }

  const session = await getCallSession(sessionId);

  if (!session) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">The call session could not be found.</Say><Hangup/></Response>`,
      {
        status: 404,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      }
    );
  }

  const mediaStreamUrl = process.env.TWILIO_MEDIA_STREAM_URL;
  const appBaseUrl = process.env.APP_BASE_URL;
  if (mediaStreamUrl && !appBaseUrl) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">SafeStep voice runtime is misconfigured. Application base URL is missing.</Say><Hangup/></Response>`,
      {
        status: 500,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      }
    );
  }

  if (mediaStreamUrl && appBaseUrl) {
    return new Response(
      buildProviderVoiceStreamTwiml({
        streamUrl: mediaStreamUrl,
        streamStatusCallbackUrl: `${appBaseUrl}/api/calls/${sessionId}/stream-status`,
        sessionId,
        providerName: session.provider_name,
        patientName: session.patient_name,
        callGoal: session.call_goal,
        callbackNumber: session.callback_number,
        appointmentContext: session.appointment_context,
        constraints: session.constraints,
      }),
      {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      }
    );
  }

  return new Response(
    buildProviderIntroTwiml({
      providerName: session.provider_name,
      patientName: session.patient_name,
      callGoal: session.call_goal,
      callbackNumber: session.callback_number,
    }),
    {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    }
  );
}
