"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicBaseUrl = getPublicBaseUrl;
exports.startTwilioCall = startTwilioCall;
exports.cancelTwilioCall = cancelTwilioCall;
exports.getVoiceRuntimeConfig = getVoiceRuntimeConfig;
exports.buildProviderIntroTwiml = buildProviderIntroTwiml;
exports.buildProviderVoiceStreamTwiml = buildProviderVoiceStreamTwiml;
exports.sendSms = sendSms;
const logger_1 = require("./logger");
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is not set.`);
    }
    return value;
}
function buildAuthHeader(accountSid, authToken) {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}
function getPublicBaseUrl() {
    return (process.env.APP_BASE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ||
        "http://localhost:3000");
}
async function startTwilioCall(input) {
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
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
        method: "POST",
        headers: {
            Authorization: buildAuthHeader(accountSid, authToken),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => "Unable to read Twilio error body");
        logger_1.logger.error("twilio", "startTwilioCall rejected", {
            status: response.status,
            errorBody,
        });
        throw new Error(`Twilio call creation failed with HTTP ${response.status}.`);
    }
    const data = (await response.json());
    if (!data.sid) {
        throw new Error("Twilio did not return a call SID.");
    }
    return {
        sid: data.sid,
        status: data.status || "queued",
    };
}
async function cancelTwilioCall(callSid) {
    const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const body = new URLSearchParams({
        Status: "completed",
    });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`, {
        method: "POST",
        headers: {
            Authorization: buildAuthHeader(accountSid, authToken),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => "Unable to read Twilio error body");
        logger_1.logger.error("twilio", "cancelTwilioCall rejected", {
            status: response.status,
            errorBody,
        });
        throw new Error(`Twilio call cancel failed with HTTP ${response.status}.`);
    }
    const data = (await response.json());
    if (!data.sid) {
        throw new Error("Twilio did not return a call SID after cancel.");
    }
    return {
        sid: data.sid,
        status: data.status || "completed",
    };
}
function getVoiceRuntimeConfig() {
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
function buildProviderIntroTwiml(params) {
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
function buildProviderVoiceStreamTwiml(params) {
    const serializedAppointmentContext = JSON.stringify(params.appointmentContext || {});
    const serializedConstraints = JSON.stringify(params.constraints || []);
    const escaped = {
        streamUrl: escapeXml(params.streamUrl),
        streamStatusCallbackUrl: escapeXml(params.streamStatusCallbackUrl),
        sessionId: escapeXml(params.sessionId),
        providerName: escapeXml(params.providerName),
        patientName: escapeXml(params.patientName),
        callGoal: escapeXml(params.callGoal),
        callbackNumber: escapeXml(params.callbackNumber || ""),
        appointmentContext: escapeXml(serializedAppointmentContext),
        constraints: escapeXml(serializedConstraints),
    };
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escaped.streamUrl}" statusCallback="${escaped.streamStatusCallbackUrl}" statusCallbackMethod="POST" name="provider-support-stream">
      <Parameter name="sessionId" value="${escaped.sessionId}" />
      <Parameter name="providerName" value="${escaped.providerName}" />
      <Parameter name="patientName" value="${escaped.patientName}" />
      <Parameter name="callGoal" value="${escaped.callGoal}" />
      <Parameter name="callbackNumber" value="${escaped.callbackNumber}" />
      <Parameter name="appointmentContext" value="${escaped.appointmentContext}" />
      <Parameter name="constraints" value="${escaped.constraints}" />
    </Stream>
  </Connect>
</Response>`;
}
async function sendSms(to, body) {
    const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
    const from = requiredEnv("TWILIO_PHONE_NUMBER");
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
            Authorization: buildAuthHeader(accountSid, authToken),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        logger_1.logger.error("twilio", "sendSms failed", { status: response.status, errorBody });
        throw new Error(`Twilio SMS failed with HTTP ${response.status}.`);
    }
}
function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
