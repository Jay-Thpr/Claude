import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AppointmentContext,
  UserContextEntry,
  UserProfileContext,
} from "./response-schema";

export type AppointmentAdvice = {
  summary: string;
  preparationActions: string[];
  thingsToWatch: string[];
  questionsToAsk: string[];
};

const DEFAULT_MODEL = process.env.SAFESTEP_GEMINI_MODEL || "gemini-3.1-flash-lite-preview";

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return new GoogleGenerativeAI(apiKey);
}

function safeParseJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}

function buildFallbackAdvice(
  appointment: AppointmentContext,
  profile: UserProfileContext | null,
  entries: UserContextEntry[],
): AppointmentAdvice {
  const prep = [
    "Bring your medication list and insurance card.",
    "Write down any new symptoms before the visit.",
  ];

  if (appointment.prepNotes) {
    prep.unshift(`Bring the appointment note: ${appointment.prepNotes}`);
  }

  if (profile?.supportNeeds?.length) {
    prep.unshift("Take the visit one step at a time and ask for clarification if anything is unclear.");
  }

  const watch = [
    "Watch for any change in symptoms or medication side effects.",
    "Pause if the page asks for payment or personal details that do not seem related to the visit.",
  ];

  const questions = [
    "What should I do after this appointment?",
    "Are there any medicine changes I should remember?",
  ];

  if (entries.some((entry) => /memory|forget|sequencing/i.test(`${entry.title} ${entry.detail}`))) {
    questions.unshift("Can you repeat the instructions slowly?");
  }

  return {
    summary: appointment.summary
      ? `Prepare for ${appointment.summary} with a calm, step-by-step plan.`
      : "Prepare for the upcoming appointment with a short checklist.",
    preparationActions: prep,
    thingsToWatch: watch,
    questionsToAsk: questions,
  };
}

export async function generateAppointmentAdvice(params: {
  appointment: AppointmentContext | null;
  profile: UserProfileContext | null;
  entries: UserContextEntry[];
}) {
  if (!params.appointment) {
    return buildFallbackAdvice(
      {
        summary: "Upcoming appointment",
      },
      params.profile,
      params.entries,
    );
  }

  const genAI = buildGenAI();
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

  const prompt = `You are SafeStep. Create a calm, senior-friendly appointment prep plan.

Return valid JSON only with:
{
  "summary": "one sentence",
  "preparationActions": ["short action", "..."],
  "thingsToWatch": ["short warning", "..."],
  "questionsToAsk": ["short question", "..."]
}

Rules:
- Use simple language.
- Keep it practical and specific.
- Make sure actions match the appointment and the user's health context.
- Include reminders about documents, medications, timing, and anything to be aware of.
- If the user profile suggests memory or sequencing support, include a gentle reminder to slow down and check steps one at a time.

Appointment:
- Summary: ${params.appointment.summary || "Unknown"}
- When: ${params.appointment.whenLabel || "Unknown"}
- Time: ${params.appointment.timeLabel || "Unknown"}
- Location: ${params.appointment.location || "Unknown"}
- Description: ${params.appointment.description || "None"}
- Prep notes: ${params.appointment.prepNotes || "None"}

User profile:
- Name: ${params.profile?.name || "Unknown"}
- Age group: ${params.profile?.ageGroup || "Unknown"}
- Support needs: ${(params.profile?.supportNeeds || []).join("; ") || "None"}
- Preferences: ${(params.profile?.preferences || []).join("; ") || "None"}
- Conditions: ${(params.profile?.conditions || []).join("; ") || "None"}
- Notes: ${params.profile?.notes || "None"}

User context entries:
${params.entries.map((entry) => `- ${entry.title}: ${entry.detail}`).join("\n") || "None"}`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = safeParseJson<Partial<AppointmentAdvice>>(result.response.text());
    if (!parsed) {
      return buildFallbackAdvice(params.appointment, params.profile, params.entries);
    }

    return {
      summary: parsed.summary || buildFallbackAdvice(params.appointment, params.profile, params.entries).summary,
      preparationActions: Array.isArray(parsed.preparationActions)
        ? parsed.preparationActions.filter((item): item is string => typeof item === "string")
        : [],
      thingsToWatch: Array.isArray(parsed.thingsToWatch)
        ? parsed.thingsToWatch.filter((item): item is string => typeof item === "string")
        : [],
      questionsToAsk: Array.isArray(parsed.questionsToAsk)
        ? parsed.questionsToAsk.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return buildFallbackAdvice(params.appointment, params.profile, params.entries);
  }
}
