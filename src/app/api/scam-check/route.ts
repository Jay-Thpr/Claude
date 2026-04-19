import { orchestrateCopilot } from "@/lib/orchestrator";
import { logScamCheck } from "@/lib/scam-store";

const DEMO_USER_ID = "demo-user-001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = body.url;
    
    const response = await orchestrateCopilot({
      mode: "scam_check",
      query: body.content || body.question,
      url: body.url,
      pageTitle: body.pageTitle,
      visibleText: body.content,
    });

    const classification =
        response.riskLevel === "safe"
          ? "safe"
          : response.riskLevel === "risky"
            ? "risky"
            : "not-sure";

    // Log to Supabase in the background — don't await, don't block the response
    logScamCheck({
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
