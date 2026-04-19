import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AppointmentContext,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "./response-schema";
import { summarizeUserContext } from "./user-context";

type GeneralChatInput = {
  query: string;
  url?: string;
  pageTitle?: string;
  visibleText?: string;
  pageSummary?: string;
  taskMemory?: TaskMemoryState | null;
  appointment?: AppointmentContext | null;
  userProfile?: UserProfileContext | null;
  userContextEntries?: UserContextEntry[];
};

export type GeneralChatResponse = {
  message: string;
};

const FALLBACK_MODELS = [
  process.env.SAFESTEP_GEMINI_MODEL || "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
];

function buildGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  return new GoogleGenerativeAI(apiKey);
}

function section(label: string, value?: string | null) {
  if (!value) {
    return "";
  }
  return `- ${label}: ${value}\n`;
}

function buildProfileSummary(profile?: UserProfileContext | null) {
  if (!profile) {
    return "- User profile: Not available";
  }

  return [
    `- Name: ${profile.name || "Unknown"}`,
    `- Age group: ${profile.ageGroup || "Unknown"}`,
    `- Timezone: ${profile.timezone || "Unknown"}`,
    `- Calendar connected: ${profile.calendarConnected ? "yes" : "no"}`,
    `- Support needs: ${(profile.supportNeeds || []).join("; ") || "None"}`,
    `- Preferences: ${(profile.preferences || []).join("; ") || "None"}`,
    `- Conditions: ${(profile.conditions || []).join("; ") || "None"}`,
    profile.notes ? `- Notes: ${profile.notes}` : "",
    profile.onboardingSummary ? `- Onboarding summary: ${profile.onboardingSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function runGeminiPrompt(prompt: string) {
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

function buildPrompt(input: GeneralChatInput) {
  const profile = buildProfileSummary(input.userProfile);
  const contextEntries = input.userContextEntries?.length
    ? [...input.userContextEntries]
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
        .map((entry) => {
          const priority = typeof entry.priority === "number" ? ` (priority ${entry.priority})` : "";
          return `- ${entry.category}: ${entry.title}${priority} — ${entry.detail}`;
        })
        .join("\n")
    : "- User context entries: Not available";
  const contextSummary = input.userContextEntries?.length
    ? summarizeUserContext(input.userContextEntries)
    : "";

  return [
    "You are SafeStep, a warm conversational assistant.",
    "Reply like a helpful human, not like a workflow engine.",
    "Assume the user benefits from calm, simple, kind language.",
    "Use short sentences. Prefer one idea at a time.",
    "Be caring and reassuring without sounding robotic.",
    "If the user seems confused, slow down and gently restate the next step.",
    "If the user is casually chatting, answer casually but warmly.",
    "If the user asks about the page or task, weave in the relevant context naturally.",
    "If the user expresses worry, acknowledge it first before giving advice.",
    "If you need to ask a question, ask only one short question.",
    "Do not mention policies, internal modes, or that you are following a system prompt.",
    "Do not give medical, legal, or financial certainty unless the context clearly supports it.",
    "Do not over-format. Plain text only.",
    "Return plain text only. No markdown, no code fences, no JSON.",
    "",
    "User profile:",
    profile,
    "",
    "User context entries:",
    contextEntries,
    "",
    "Context summary:",
    contextSummary || "- None",
    "",
    "Visible browser context:",
    section("URL", input.url),
    section("Page title", input.pageTitle),
    section("User message", input.query),
    section("Visible text", input.visibleText),
    section("Page summary", input.pageSummary),
    "",
    "Memory context:",
    section("Current task", input.taskMemory?.currentTask || null),
    section("Task goal", input.taskMemory?.taskGoal || null),
    section("Last step", input.taskMemory?.lastStep || null),
    section("Current stage", input.taskMemory?.currentStageTitle || null),
    section("Next stage", input.taskMemory?.nextStageTitle || null),
    "",
    "Appointment context:",
    section("Connected", input.appointment?.connected ? "yes" : "no"),
    section("Summary", input.appointment?.summary || null),
    section("When", input.appointment?.whenLabel || null),
    section("Location", input.appointment?.location || null),
    section("Description", input.appointment?.description || null),
    section("Prep notes", input.appointment?.prepNotes || null),
    "",
    "Reply shape:",
    "- Start with the most helpful, warm answer.",
    "- Keep it grounded in the user's context.",
    "- If appropriate, end with one small next step or one short check-in question.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateGeneralChatReply(
  input: GeneralChatInput,
): Promise<GeneralChatResponse> {
  const prompt = buildPrompt(input);

  try {
    const rawText = await runGeminiPrompt(prompt);
    const message = rawText.trim();
    if (message) {
      return { message };
    }
  } catch {
    // Fallback below.
  }

  return {
    message:
      "I’m here with you. Tell me what you want to do, and I’ll keep it simple.",
  };
}
