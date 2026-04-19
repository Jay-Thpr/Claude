import { orchestrateCopilot } from "@/lib/orchestrator";
import type { CopilotRequest } from "@/lib/response-schema";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CopilotRequest;
    const response = await orchestrateCopilot(body);
    return Response.json(response);
  } catch (error) {
    console.error("Copilot respond error:", error);
    return Response.json(
      {
        mode: "guidance",
        summary: "I had a small problem.",
        nextStep: "Please try again in a moment.",
        explanation:
          "I’m having trouble reading the page right now. Try again in a moment, or ask me to check the safe next step.",
        riskLevel: "uncertain",
        suspiciousSignals: [],
      },
      { status: 500 },
    );
  }
}
