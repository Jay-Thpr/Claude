import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TaskStep {
  index: number;
  instruction: string;
  voiceAnnouncement: string;
}

export interface TaskStartRequest {
  intent: string;
  url: string;
  pageTitle?: string;
  visibleText?: string;
  taskMemory?: object | null;
  appointment?: {
    summary?: string;
    whenLabel?: string;
    location?: string;
  } | null;
}

export interface TaskStartResponse {
  steps: TaskStep[];
  announcement: string;
  totalSteps: number;
}

const FALLBACK_MODELS = [
  process.env.SAFESTEP_GEMINI_MODEL || "gemini-2.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.1-flash-lite-preview",
];

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  return new GoogleGenerativeAI(apiKey);
}

async function runGeminiPrompt(prompt: string): Promise<string> {
  const genAI = buildGenAI();
  let lastError: unknown = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Unable to reach Gemini.");
}

function safeParseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}

function buildFallbackPlan(intent: string): TaskStartResponse {
  const steps: TaskStep[] = [
    {
      index: 0,
      instruction: "Look for the button or link that matches what you need.",
      voiceAnnouncement:
        "Let's take this one step at a time. First, look for the button or link that matches what you're trying to do.",
    },
    {
      index: 1,
      instruction: "Click it and I'll check if it worked.",
      voiceAnnouncement:
        "When you find it, go ahead and click it. I'll be right here to help with the next step.",
    },
  ];
  return {
    steps,
    announcement: `I'll help you with: ${intent}. Let's take it one small step at a time.`,
    totalSteps: steps.length,
  };
}

function buildPrompt(body: TaskStartRequest): string {
  const appointmentContext = body.appointment?.summary
    ? `Appointment context: ${body.appointment.summary}${body.appointment.whenLabel ? ` (${body.appointment.whenLabel})` : ""}${body.appointment.location ? ` at ${body.appointment.location}` : ""}.`
    : "No appointment context.";

  return `You are SafeStep, a browser assistant for elderly adults with dementia.
The user wants to: ${body.intent}
They are currently on: ${body.url}${body.pageTitle ? ` (${body.pageTitle})` : ""}
${appointmentContext}

Create a step-by-step plan (3-7 steps) to help them accomplish this.
Each step must be very simple — one small action.
Use plain, friendly language as if you are speaking to an elderly person.
Describe exactly what to look for on the screen (button colors, labels, positions).

Return valid JSON only — no extra text, no markdown code fences:
{
  "steps": [
    {
      "index": 0,
      "instruction": "Click the button that says 'Sign In'",
      "voiceAnnouncement": "First, let's sign in to your account. Look for a button that says Sign In."
    }
  ],
  "openingAnnouncement": "I'll help you refill your prescription. We'll do this together, step by step."
}`;
}

type TaskStartDeps = {
  runGeminiPrompt?: (prompt: string) => Promise<string>;
};

export async function handleTaskStartRequest(request: Request, deps: TaskStartDeps = {}): Promise<Response> {
  let body: TaskStartRequest;
  try {
    body = (await request.json()) as TaskStartRequest;
  } catch {
    return Response.json(buildFallbackPlan("your task"));
  }

  if (!body.intent || !body.url) {
    return Response.json(buildFallbackPlan(body.intent || "your task"));
  }

  const gemini = deps.runGeminiPrompt ?? runGeminiPrompt;

  try {
    const prompt = buildPrompt(body);
    const rawText = await gemini(prompt);

    const parsed = safeParseJson<{
      steps?: Array<{ index?: number; instruction?: string; voiceAnnouncement?: string }>;
      openingAnnouncement?: string;
    }>(rawText);

    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return Response.json(buildFallbackPlan(body.intent));
    }

    const steps: TaskStep[] = parsed.steps
      .slice(0, 7)
      .map((s, i) => ({
        index: typeof s.index === "number" ? s.index : i,
        instruction: s.instruction || `Step ${i + 1}`,
        voiceAnnouncement:
          s.voiceAnnouncement || `Now, ${s.instruction || `do step ${i + 1}`}.`,
      }));

    const result: TaskStartResponse = {
      steps,
      announcement:
        parsed.openingAnnouncement ||
        `I'll help you with: ${body.intent}. We'll do this together, step by step.`,
      totalSteps: steps.length,
    };

    return Response.json(result);
  } catch {
    return Response.json(buildFallbackPlan(body.intent));
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleTaskStartRequest(request);
}
