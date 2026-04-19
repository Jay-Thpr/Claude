import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractScamSignals, signalsToPromptContext } from "@/lib/scam-signals";
import { logScamCheck } from "@/lib/scam-store";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const DEMO_USER_ID = "demo-user-001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, pageTitle, content } = body;

    // Run heuristic signal extraction before the LLM call
    const signals = extractScamSignals(url ?? "", content ?? "");
    const signalContext = signalsToPromptContext(signals);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are SafeStep, a friendly safety advisor helping an older adult determine if a website or message is safe.
You must be honest but gentle. Never scare the user. Explain clearly and simply.

${signalContext}

Analyze this for scam risk:
- URL: ${url || "Not provided"}
- Page title: ${pageTitle || "Not provided"}
${content ? `- Content/text to check: "${content}"` : ""}

Look for these warning signs:
- Suspicious or misspelled domain names
- Urgency language ("Act now!", "Your account will be closed!")
- Requests for passwords, SSN, credit card, or gift cards
- Fake healthcare, Medicare, or pharmacy branding
- Mismatched branding or logos
- Pressure to click links or download files
- Too-good-to-be-true offers

Respond with a JSON object (no markdown, no code fences):
{
  "classification": "safe" | "not-sure" | "risky",
  "explanation": "A clear, calm 2-3 sentence explanation in very simple language",
  "suspicious_signals": ["list of specific concerns found, if any"]
}

If you genuinely don't have enough information, classify as "not-sure" and explain what you'd need to make a better judgment.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let parsed: {
      classification: "safe" | "not-sure" | "risky";
      explanation: string;
      suspicious_signals: string[];
    };

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        classification: "not-sure",
        explanation:
          "I couldn't fully analyze this page. If you're unsure, it's always safer to wait and ask someone you trust.",
        suspicious_signals: [],
      };
    }

    // Log to Supabase in the background — don't await, don't block the response
    logScamCheck({
      user_id: DEMO_USER_ID,
      url: url ?? null,
      classification: parsed.classification,
      explanation: parsed.explanation,
      risk_signals: parsed.suspicious_signals ?? [],
    });

    return Response.json(parsed);
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
