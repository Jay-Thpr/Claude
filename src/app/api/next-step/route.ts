import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, pageTitle, question, taskMemory } = body;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are SafeStep, a calm and patient assistant helping an older adult navigate the web. 
You speak in simple, clear language. Short sentences. No jargon. One step at a time.

Current context:
- Page URL: ${url || "Not specified"}
- Page title: ${pageTitle || "Not specified"}
${taskMemory ? `- Current task: ${taskMemory.current_task || "None"}` : ""}
${taskMemory ? `- Last step: ${taskMemory.last_step || "None"}` : ""}
${question ? `- The user is asking: "${question}"` : "- The user wants to know what to do next."}

Respond with a JSON object (no markdown, no code fences) with these fields:
{
  "summary": "One sentence explaining what this page or task is about",
  "next_step": "One clear, specific action the user should take next",
  "explanation": "A friendly 2-3 sentence explanation in very simple language. Be encouraging."
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from potential markdown fencing
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = {
        summary: "Let me help you with that.",
        next_step: "Take a look at the page and tell me what you see.",
        explanation: text,
      };
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Next-step error:", err);
    return Response.json(
      {
        summary: "I had a small problem.",
        next_step: "Please try again in a moment.",
        explanation:
          "I'm having a little trouble right now, but don't worry. Please click the button again in a moment.",
      },
      { status: 500 }
    );
  }
}
