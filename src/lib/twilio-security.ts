import crypto from "crypto";

import { getPublicBaseUrl } from "./twilio";

function buildExpectedSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
) {
  const sortedPairs = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const payload = sortedPairs.reduce((acc, [key, value]) => `${acc}${key}${value}`, url);

  return crypto.createHmac("sha1", authToken).update(payload).digest("base64");
}

export function getPublicWebhookUrl(pathname: string, search = "") {
  return `${getPublicBaseUrl()}${pathname}${search}`;
}

export function validateTwilioRequest(params: {
  authToken: string;
  signatureHeader: string | null;
  url: string;
  formFields: Record<string, string>;
}) {
  if (!params.signatureHeader) {
    return false;
  }

  const expected = buildExpectedSignature(params.authToken, params.url, params.formFields);
  const actualBuffer = Buffer.from(params.signatureHeader);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function requireTwilioAuthToken() {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN is not set.");
  }

  return authToken;
}
