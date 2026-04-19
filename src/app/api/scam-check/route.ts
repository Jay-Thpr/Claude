import { orchestrateCopilot } from "@/lib/orchestrator";
import { logScamCheck } from "@/lib/scam-store";
import { extractScamSignals, signalsToPromptContext } from "@/lib/scam-signals";
import { sendSms } from "@/lib/twilio";
import { logger } from "@/lib/logger";

const DEMO_USER_ID = "demo-user-001";

export interface ScamCheckActions {
  blockOnRisky?: boolean;
  notifyPhone?: string;
}

export interface ScamCheckRequest {
  url?: string;
  content?: string;
  question?: string;
  pageTitle?: string;
  actions?: ScamCheckActions;
}

export interface ScamCheckResponse {
  classification: "safe" | "not-sure" | "risky";
  explanation: string;
  suspicious_signals: string[];
  blocked: boolean;
}

export async function POST(request: Request): Promise<Response> {
  let body: ScamCheckRequest;
  try {
    body = (await request.json()) as ScamCheckRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, content, question, pageTitle, actions } = body;

  try {
    const signals = url ? extractScamSignals(url, content || "") : null;
    const signalContext = signals ? signalsToPromptContext(signals) : null;

    const response = await orchestrateCopilot({
      mode: "scam_check",
      query: content || question,
      url,
      pageTitle,
      visibleText: content,
      pageSummary: signalContext ?? undefined,
    });

    const classification: ScamCheckResponse["classification"] =
      response.riskLevel === "safe"
        ? "safe"
        : response.riskLevel === "risky"
          ? "risky"
          : "not-sure";

    const isRisky = classification === "risky";
    const blocked = isRisky && (actions?.blockOnRisky ?? false);

    // Fire side effects in background — don't block the response
    void (async () => {
      try {
        await logScamCheck({
          user_id: DEMO_USER_ID,
          url: url ?? null,
          classification,
          explanation: response.explanation || "",
          risk_signals: response.suspiciousSignals || [],
        });
      } catch (err) {
        logger.error("scam-check", "logScamCheck failed", err);
      }

      if (isRisky && actions?.notifyPhone) {
        const siteLabel = url ? new URL(url).hostname : "a website";
        const message =
          `SafeStep Alert: A potentially risky site was detected (${siteLabel}). ` +
          `The user has been warned and the action was ${blocked ? "blocked" : "flagged"}. ` +
          `Reason: ${response.explanation?.slice(0, 200) ?? "suspicious signals detected."}`;
        try {
          await sendSms(actions.notifyPhone, message);
        } catch (err) {
          logger.error("scam-check", "notifyPhone SMS failed", err);
        }
      }
    })();

    const result: ScamCheckResponse = {
      classification,
      explanation: response.explanation || "",
      suspicious_signals: response.suspiciousSignals || [],
      blocked,
    };

    return Response.json(result);
  } catch (err) {
    logger.error("scam-check", "handler threw", err);
    return Response.json(
      {
        classification: "not-sure",
        explanation:
          "I'm having trouble checking this right now. If the website is asking for personal information or money, please wait and ask a family member or friend first.",
        suspicious_signals: [],
        blocked: false,
      } satisfies ScamCheckResponse,
      { status: 500 }
    );
  }
}
