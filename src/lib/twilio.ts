import { logger } from "./logger";

export interface StartTwilioCallInput {
  to: string;
  statusCallbackUrl: string;
  twimlUrl?: string;
  machineDetection?: "Enable" | "DetectMessageEnd" | "Disable";
  record?: boolean;
}

export interface TwilioCallResult {
  sid: string;
  status: string;
}

export interface VoiceRuntimeConfig {
  mode: "static-intro" | "media-stream" | "external-twiml";
  runtimeUrl: string | null;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

function buildAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export function getPublicBaseUrl() {
  return (
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ||
    "http://localhost:3000"
  );
}

export async function startTwilioCall(input: StartTwilioCallInput): Promise<TwilioCallResult> {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const from = requiredEnv("TWILIO_PHONE_NUMBER");

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    StatusCallback: input.statusCallbackUrl,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "initiated ringing answered completed",
    MachineDetection: input.machineDetection || "DetectMessageEnd",
  });

  if (input.twimlUrl) {
    body.set("Url", input.twimlUrl);
  }

  if (input.record) {
    body.set("Record", "true");
    body.set("RecordingStatusCallback", input.statusCallbackUrl);
    body.set("RecordingStatusCallbackMethod", "POST");
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unable to read Twilio error body");
    logger.error("twilio", "startTwilioCall rejected", {
      status: response.status,
      errorBody,
    });
    throw new Error(`Twilio call creation failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { sid?: string; status?: string };
  if (!data.sid) {
    throw new Error("Twilio did not return a call SID.");
  }

  return {
    sid: data.sid,
    status: data.status || "queued",
  };
}

export async function cancelTwilioCall(callSid: string): Promise<TwilioCallResult> {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const body = new URLSearchParams({
    Status: "completed",
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unable to read Twilio error body");
    logger.error("twilio", "cancelTwilioCall rejected", {
      status: response.status,
      errorBody,
    });
    throw new Error(`Twilio call cancel failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as { sid?: string; status?: string };
  if (!data.sid) {
    throw new Error("Twilio did not return a call SID after cancel.");
  }

  return {
    sid: data.sid,
    status: data.status || "completed",
  };
}

export function getVoiceRuntimeConfig(): VoiceRuntimeConfig {
  if (process.env.TWILIO_VOICE_WEBHOOK_URL) {
    return {
      mode: "external-twiml",
      runtimeUrl: process.env.TWILIO_VOICE_WEBHOOK_URL,
    };
  }

  if (process.env.TWILIO_MEDIA_STREAM_URL) {
    return {
      mode: "media-stream",
      runtimeUrl: process.env.TWILIO_MEDIA_STREAM_URL,
    };
  }

  return {
    mode: "static-intro",
    runtimeUrl: null,
  };
}

export function buildProviderIntroTwiml(params: {
  providerName: string;
  patientName: string;
  callGoal: string;
  callbackNumber?: string | null;
}) {
  const escaped = {
    providerName: escapeXml(params.providerName),
    patientName: escapeXml(params.patientName),
    callGoal: escapeXml(params.callGoal),
    callbackNumber: escapeXml(params.callbackNumber || ""),
  };

  const callbackSentence = escaped.callbackNumber
    ? `<Say voice="alice">If you need to call back, please use ${escaped.callbackNumber}.</Say>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Say voice="alice">Hello. This is SafeStep, an AI assistant calling on behalf of ${escaped.patientName}.</Say>
  <Say voice="alice">I am calling ${escaped.providerName} regarding this request: ${escaped.callGoal}.</Say>
  <Say voice="alice">This is an automated assistant call for administrative support only.</Say>
  ${callbackSentence}
  <Say voice="alice">Please hold for the live assistant workflow.</Say>
  <Pause length="2"/>
</Response>`;
}

export function buildProviderVoiceStreamTwiml(params: {
  streamUrl: string;
  streamStatusCallbackUrl: string;
  sessionId: string;
  providerName: string;
  patientName: string;
  callGoal: string;
  callbackNumber?: string | null;
}) {
  const escaped = {
    streamUrl: escapeXml(params.streamUrl),
    streamStatusCallbackUrl: escapeXml(params.streamStatusCallbackUrl),
    sessionId: escapeXml(params.sessionId),
    providerName: escapeXml(params.providerName),
    patientName: escapeXml(params.patientName),
    callGoal: escapeXml(params.callGoal),
    callbackNumber: escapeXml(params.callbackNumber || ""),
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello. This is SafeStep, an AI assistant calling on behalf of ${escaped.patientName}.</Say>
  <Say voice="alice">This call is for administrative support only.</Say>
  <Connect>
    <Stream url="${escaped.streamUrl}" statusCallback="${escaped.streamStatusCallbackUrl}" statusCallbackMethod="POST" name="provider-support-stream">
      <Parameter name="sessionId" value="${escaped.sessionId}" />
      <Parameter name="providerName" value="${escaped.providerName}" />
      <Parameter name="patientName" value="${escaped.patientName}" />
      <Parameter name="callGoal" value="${escaped.callGoal}" />
      <Parameter name="callbackNumber" value="${escaped.callbackNumber}" />
    </Stream>
  </Connect>
</Response>`;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const from = requiredEnv("TWILIO_PHONE_NUMBER");

  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(accountSid, authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    logger.error("twilio", "sendSms failed", { status: response.status, errorBody });
    throw new Error(`Twilio SMS failed with HTTP ${response.status}.`);
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
