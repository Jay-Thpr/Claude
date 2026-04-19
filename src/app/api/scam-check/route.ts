import { logScamCheck } from "../../../lib/scam-store";
import type { CopilotRequest, CopilotResponse } from "../../../lib/response-schema";

type ScamCheckDependencies = {
  orchestrateCopilot?: (input: CopilotRequest) => Promise<CopilotResponse>;
  logScamCheck?: typeof logScamCheck;
};

const DEMO_USER_ID = "demo-user-001";

export async function POST(request: Request) {
  return handleScamCheckRequest(request);
}

export async function handleScamCheckRequest(
  request: Request,
  deps: ScamCheckDependencies = {},
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const url = typeof body.url === "string" ? body.url : undefined;

    const orchestrateCopilot =
      deps.orchestrateCopilot ?? (await import("../../../lib/orchestrator")).orchestrateCopilot;
    const response = await orchestrateCopilot({
      mode: "scam_check",
      query:
        (typeof body.content === "string" && body.content) ||
        (typeof body.question === "string" && body.question) ||
        undefined,
      url: typeof body.url === "string" ? body.url : undefined,
      pageTitle: typeof body.pageTitle === "string" ? body.pageTitle : undefined,
      visibleText: typeof body.content === "string" ? body.content : undefined,
    });

    const classification =
        response.riskLevel === "safe"
          ? "safe"
          : response.riskLevel === "risky"
            ? "risky"
            : "not-sure";

    // Log to Supabase in the background — don't await, don't block the response
    const log = deps.logScamCheck ?? logScamCheck;
    log({
      user_id: DEMO_USER_ID,
      url: url ?? null,
      classification: classification,
      explanation: response.explanation || "",
      risk_signals: response.suspiciousSignals || [],
    });

    return Response.json({
      ...response,
      classification,
      explanation: response.explanation,
      suspicious_signals: response.suspiciousSignals || [],
    });
  } catch (err) {
    console.error("Scam check error:", err);
    return Response.json(
      {
        classification: "not-sure",
        explanation:
          "I'm having trouble checking this right now. If the website is asking for personal information or money, please wait and ask a family member or friend first.",
        suspicious_signals: [],
      },
      { status: 500 }
    );
  }
}
