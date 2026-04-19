"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_PAGE_LIBRARY } from "@/lib/mock-context";
import { DEFAULT_APPOINTMENT_STAGE_PLAN } from "@/lib/task-flow";
import type {
  CopilotMode,
  CopilotResponse,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "@/lib/response-schema";

type PageKey = (typeof DEMO_PAGE_LIBRARY)[number]["id"];

type LoadedAppointment = {
  connected: boolean;
  summary?: string | null;
  whenLabel?: string | null;
  timeLabel?: string | null;
  location?: string | null;
  description?: string | null;
  source?: string | null;
  message?: string;
};

type AppointmentPrepAdvice = {
  summary: string;
  preparationActions: string[];
  thingsToWatch: string[];
  questionsToAsk: string[];
};

type LoadedUserContext = {
  profile: UserProfileContext | null;
  entries: UserContextEntry[];
  source?: string;
};

type AssistantMessage = CopilotResponse & {
  id: string;
  createdAt: string;
};

type TaskMemoryPayload = {
  current_task: string | null;
  task_type?: string | null;
  task_goal?: string | null;
  current_stage_index?: number | null;
  current_stage_title?: string | null;
  current_stage_detail?: string | null;
  next_stage_title?: string | null;
  next_stage_detail?: string | null;
  stage_plan?: TaskMemoryState["stagePlan"];
  status?: string | null;
  last_step: string | null;
  current_url?: string | null;
  page_title?: string | null;
};

const PAGE_BY_ID = Object.fromEntries(DEMO_PAGE_LIBRARY.map((page) => [page.id, page])) as Record<
  PageKey,
  (typeof DEMO_PAGE_LIBRARY)[number]
>;

function buildTaskMemory(
  page: (typeof DEMO_PAGE_LIBRARY)[number],
  memory?: TaskMemoryState | null,
): TaskMemoryState {
  return {
    currentTask: memory?.currentTask || page.summary,
    taskType: memory?.taskType || null,
    taskGoal: memory?.taskGoal || page.summary,
    currentStageIndex: memory?.currentStageIndex ?? 0,
    currentStageTitle: memory?.currentStageTitle || page.title,
    currentStageDetail: memory?.currentStageDetail || page.summary,
    nextStageTitle: memory?.nextStageTitle || null,
    nextStageDetail: memory?.nextStageDetail || null,
    stagePlan: memory?.stagePlan || [],
    status: memory?.status || "active",
    lastStep: memory?.lastStep || `Viewing ${page.title}.`,
    currentUrl: page.url,
    pageTitle: page.title,
  };
}

function riskBadge(riskLevel?: string) {
  switch (riskLevel) {
    case "safe":
      return "bg-safe/10 text-safe border-safe/20";
    case "risky":
      return "bg-danger/10 text-danger border-danger/20";
    default:
      return "bg-warning/10 text-warning border-warning/20";
  }
}

function normalizeTaskMemory(payload: TaskMemoryPayload | null): TaskMemoryState | null {
  if (!payload) {
    return null;
  }

  return {
    currentTask: payload.current_task,
    taskType: payload.task_type ?? null,
    taskGoal: payload.task_goal ?? null,
    currentStageIndex: payload.current_stage_index ?? null,
    currentStageTitle: payload.current_stage_title ?? null,
    currentStageDetail: payload.current_stage_detail ?? null,
    nextStageTitle: payload.next_stage_title ?? null,
    nextStageDetail: payload.next_stage_detail ?? null,
    stagePlan: payload.stage_plan ?? [],
    status: payload.status ?? null,
    lastStep: payload.last_step,
    currentUrl: payload.current_url ?? null,
    pageTitle: payload.page_title ?? null,
  };
}

export default function SafeStepPrototype() {
  const [activePageId, setActivePageId] = useState<PageKey>("portal");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<CopilotMode>("guidance");
  const [userQuery, setUserQuery] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState<TaskMemoryState | null>(null);
  const [appointment, setAppointment] = useState<LoadedAppointment | null>(null);
  const [appointmentAdvice, setAppointmentAdvice] = useState<AppointmentPrepAdvice | null>(null);
  const [userContext, setUserContext] = useState<LoadedUserContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [onboardingText, setOnboardingText] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowMessage, setFlowMessage] = useState<string | null>(null);

  const activePage = PAGE_BY_ID[activePageId];
  const browserMemory = useMemo(() => buildTaskMemory(activePage, memory), [activePage, memory]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const [memoryRes, appointmentRes, userContextRes] = await Promise.all([
          fetch("/api/memory"),
          fetch("/api/appointments"),
          fetch("/api/user-context"),
        ]);

        const memoryData = normalizeTaskMemory((await memoryRes.json()) as TaskMemoryPayload);
        const appointmentPayload = (await appointmentRes.json()) as {
          appointment?: LoadedAppointment | null;
          message?: string;
          connected?: boolean;
          source?: string;
          prep_advice?: AppointmentPrepAdvice | null;
        };
        const userContextData = (await userContextRes.json()) as LoadedUserContext;

        if (cancelled) {
          return;
        }

        setMemory(memoryData);
        setAppointment(
          appointmentPayload.appointment || {
            connected: appointmentPayload.connected ?? false,
            message: appointmentPayload.message,
            source: appointmentPayload.source,
          },
        );
        setAppointmentAdvice(appointmentPayload.prep_advice || null);
        setUserContext(userContextData);
      } catch {
        if (!cancelled) {
          setMemory({
            currentTask: "Reviewing the next appointment",
            taskType: "appointment-prep",
            taskGoal: "Get ready for the cardiology appointment step by step",
            currentStageIndex: 0,
            currentStageTitle: "Check the doctor website",
            currentStageDetail: "Open the hospital portal and confirm the visit details.",
            nextStageTitle: "Pack what you need",
            nextStageDetail: "Put the medication list, insurance card, and notes in a bag.",
            stagePlan: DEFAULT_APPOINTMENT_STAGE_PLAN,
            status: "active",
            lastStep: "Opened the portal and asked SafeStep for help.",
            currentUrl: activePage.url,
            pageTitle: activePage.title,
          });
          setAppointment({
            connected: false,
            summary: "Cardiology follow-up",
            whenLabel: "tomorrow",
            timeLabel: "10:30 AM",
            location: "UCSD Medical Center",
            description: "Bring medication list and insurance card.",
            source: "demo",
          });
          setAppointmentAdvice({
            summary: "Prepare for the cardiology follow-up with a simple checklist.",
            preparationActions: [
              "Bring your medication list and insurance card.",
              "Write down any new symptoms before the visit.",
            ],
            thingsToWatch: [
              "Pause if a page asks for payment or personal details unrelated to the visit.",
            ],
            questionsToAsk: [
              "What should I do after this appointment?",
            ],
          });
          setUserContext({
            profile: null,
            entries: [],
            source: "demo",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingContext(false);
        }
      }
    }

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [activePage.title, activePage.url]);

  const startDemoTaskFlow = async () => {
    setFlowLoading(true);
    setFlowMessage(null);

    try {
      const res = await fetch("/api/task-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "start",
          current_task: "Reviewing the upcoming cardiology appointment",
          task_goal: "Get ready for the cardiology appointment step by step",
          task_type: "appointment-prep",
          current_stage_index: 0,
          stage_plan: DEFAULT_APPOINTMENT_STAGE_PLAN,
          last_step: "Opened the portal and asked SafeStep for help.",
          current_url: activePage.url,
          page_title: activePage.title,
          status: "active",
        }),
      });

      type TaskFlowResponse = TaskMemoryPayload & {
        message?: string;
        success?: boolean;
      };
      const response = (await res.json()) as TaskFlowResponse;
      const data = normalizeTaskMemory(response);
      if (!res.ok || response.success === false || !data) {
        throw new Error(response.message || "Unable to save the staged flow.");
      }

      setMemory(data);
      setFlowMessage(response.message || "Appointment flow started.");
    } catch (error) {
      setFlowMessage(
        error instanceof Error ? error.message : "Unable to start the appointment flow right now.",
      );
    } finally {
      setFlowLoading(false);
    }
  };

  const advanceDemoTaskFlow = async () => {
    setFlowLoading(true);
    setFlowMessage(null);

    try {
      const res = await fetch("/api/task-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "advance",
        }),
      });

      type TaskFlowResponse = TaskMemoryPayload & {
        message?: string;
        success?: boolean;
      };
      const response = (await res.json()) as TaskFlowResponse;
      const data = normalizeTaskMemory(response);
      if (!res.ok || response.success === false || !data) {
        throw new Error(response.message || "Unable to advance the staged flow.");
      }

      setMemory(data);
      setFlowMessage(response.message || "Moved to the next stage.");
    } catch (error) {
      setFlowMessage(
        error instanceof Error ? error.message : "Unable to advance the flow right now.",
      );
    } finally {
      setFlowLoading(false);
    }
  };

  const sendRequest = async (mode: CopilotMode, query?: string) => {
    setLoading(true);
    setAssistantOpen(true);
    setAssistantMode(mode);

    const payload = {
      mode,
      query: query || userQuery || undefined,
      url: activePage.url,
      pageTitle: activePage.title,
      visibleText: activePage.content,
      pageSummary: activePage.summary,
      taskMemory: browserMemory,
      appointment,
      userProfile: userContext?.profile || undefined,
      userContextEntries: userContext?.entries || undefined,
    };

    try {
      const res = await fetch("/api/copilot/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as CopilotResponse;
      const message: AssistantMessage = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [message, ...prev]);
      setUserQuery("");

      if (data.memoryUpdate) {
        setMemory((prev) => ({
          currentTask: data.memoryUpdate?.currentTask || prev?.currentTask || browserMemory.currentTask,
          lastStep: data.memoryUpdate?.lastStep || prev?.lastStep || browserMemory.lastStep,
          currentUrl: activePage.url,
          pageTitle: activePage.title,
        }));

        await fetch("/api/memory", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_task: data.memoryUpdate.currentTask || browserMemory.currentTask,
            task_type: browserMemory.taskType,
            task_goal: browserMemory.taskGoal,
            current_stage_index: browserMemory.currentStageIndex,
            current_stage_title: browserMemory.currentStageTitle,
            current_stage_detail: browserMemory.currentStageDetail,
            next_stage_title: browserMemory.nextStageTitle,
            next_stage_detail: browserMemory.nextStageDetail,
            stage_plan: browserMemory.stagePlan,
            status: browserMemory.status,
            last_step: data.memoryUpdate.lastStep || browserMemory.lastStep,
            current_url: activePage.url,
            page_title: activePage.title,
          }),
        });
      }
    } catch {
      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          mode,
          summary: "I could not connect right now.",
          nextStep: "Please try again in a moment.",
          explanation:
            "The assistant service is having trouble right now. Please wait a moment and try again.",
          riskLevel: "uncertain",
          suspiciousSignals: [],
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async () => {
    if (!onboardingText.trim()) {
      setOnboardingMessage("Paste a short summary of your medical history first.");
      return;
    }

    setOnboardingLoading(true);
    setOnboardingMessage(null);

    try {
      const res = await fetch("/api/onboarding/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeText: onboardingText }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save your information.");
      }

      setOnboardingMessage("Your profile has been saved.");
      setOnboardingText("");

      const userContextRes = await fetch("/api/user-context");
      const userContextData = (await userContextRes.json()) as LoadedUserContext;
      setUserContext(userContextData);

      const appointmentRes = await fetch("/api/appointments");
      const appointmentData = (await appointmentRes.json()) as {
        appointment?: LoadedAppointment | null;
        prep_advice?: AppointmentPrepAdvice | null;
      };
      setAppointment(appointmentData.appointment || null);
      setAppointmentAdvice(appointmentData.prep_advice || null);
    } catch (error) {
      setOnboardingMessage(
        error instanceof Error ? error.message : "Unable to save your profile right now.",
      );
    } finally {
      setOnboardingLoading(false);
    }
  };

  const promptButtons = [
    {
      label: "What do I do next?",
      mode: "guidance" as const,
      tone: "primary",
    },
    {
      label: "Is this safe?",
      mode: "scam_check" as const,
      tone: "warning",
    },
    {
      label: "What was I doing?",
      mode: "memory_recall" as const,
      tone: "neutral",
    },
    {
      label: "Summarize appointment",
      mode: "appointment" as const,
      tone: "neutral",
    },
  ];
  const latestMessage = messages[0] || null;
  const assistantPreview =
    latestMessage?.nextStep || latestMessage?.summary || "Ask for help with the current page, a scam check, or what you were doing.";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#edf8f6_0%,#f7f4ef_42%,#ebe5db_100%)] text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 sm:px-5 sm:py-5">
        <div className="browser-window flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white/80 shadow-[0_24px_80px_rgba(30,26,23,0.16)] backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-surface-200/80 bg-gradient-to-r from-white via-[#faf8f4] to-[#f3ede3] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#f87171]" />
              <span className="h-3 w-3 rounded-full bg-[#fbbf24]" />
              <span className="h-3 w-3 rounded-full bg-[#34d399]" />
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-surface-200 bg-white px-4 py-2 text-sm font-semibold text-text-secondary sm:flex">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
              SafeStep
            </div>
            <div className="flex-1 rounded-full border border-surface-200 bg-white px-4 py-2 text-sm text-text-secondary shadow-inner">
              {activePage.url}
            </div>
            <div className="hidden rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-800 md:block">
              Appointment-aware browser companion
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <div className="grid flex-1 gap-4 xl:grid-cols-[1.65fr_0.85fr]">
              <main className="flex flex-col overflow-hidden rounded-[26px] border border-surface-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-surface-200 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Current webpage
                    </p>
                    <h1 className="text-2xl font-semibold text-text-primary">
                      {activePage.title}
                    </h1>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-sm font-semibold ${riskBadge(activePage.riskLevel)}`}>
                    {activePage.riskLevel === "safe" ? "Looks safe" : activePage.riskLevel === "risky" ? "Needs attention" : "Use caution"}
                  </div>
                </div>

                <div className="grid flex-1 gap-4 p-5 lg:grid-cols-[0.75fr_1.25fr]">
                  <section className="space-y-4">
                    <div className="rounded-[24px] border border-surface-200 bg-surface-50 p-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                        Browser focus
                      </p>
                      <p className="mt-3 text-lg leading-relaxed text-text-primary">
                        {activePage.summary}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {DEMO_PAGE_LIBRARY.map((page) => (
                          <button
                            key={page.id}
                            onClick={() => setActivePageId(page.id)}
                            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                              activePage.id === page.id
                                ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                                : "border-surface-200 bg-white text-text-secondary hover:border-primary-300 hover:text-primary-700"
                            }`}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-surface-200 bg-[#fcfbf8] p-5">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                        SafeStep sees
                      </p>
                      <div className="mt-3 space-y-3 text-base text-text-secondary">
                        <p>
                          <span className="font-semibold text-text-primary">Title:</span> {activePage.title}
                        </p>
                        <p>
                          <span className="font-semibold text-text-primary">URL:</span> {activePage.url}
                        </p>
                        <p>
                          <span className="font-semibold text-text-primary">Note:</span> {activePage.content}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-surface-200 bg-gradient-to-br from-white via-[#fefcf8] to-[#f2ebe0] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                          What the user is looking at
                        </p>
                        <h2 className="mt-1 text-xl font-semibold text-text-primary">
                          {activePage.title}
                        </h2>
                      </div>
                      <div className="rounded-full border border-surface-200 bg-white px-3 py-1 text-sm font-semibold text-text-secondary">
                        {loadingContext ? "Loading context..." : memory?.currentTask ? "Memory ready" : "Memory ready"}
                      </div>
                    </div>

                    <div className="mt-5 rounded-[22px] border border-surface-200 bg-white p-5 shadow-sm">
                      <p className="text-lg leading-relaxed text-text-primary">
                        {activePage.content}
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-safe-bg p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">
                            If this is real
                          </p>
                          <p className="mt-2 text-base text-text-primary">
                            {activePageId === "portal"
                              ? "Review the visit details, then follow the portal instructions slowly."
                              : "Stay on the official site and compare the address before typing anything."}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-warning-bg p-4">
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-warning">
                            If something feels off
                          </p>
                          <p className="mt-2 text-base text-text-primary">
                            Pause and ask SafeStep to check it before you enter a password, payment, or ID number.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-surface-200 bg-white p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                          Appointment
                        </p>
                        <p className="mt-2 text-lg font-semibold text-text-primary">
                          {appointment?.summary || "Cardiology follow-up"}
                        </p>
                        <p className="text-base text-text-secondary">
                          {appointment?.whenLabel || "Tomorrow"}
                          {appointment?.timeLabel ? ` at ${appointment.timeLabel}` : ""}
                          {appointment?.location ? ` · ${appointment.location}` : ""}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-surface-200 bg-white p-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                          Last step
                        </p>
                        <p className="mt-2 text-lg font-semibold text-text-primary">
                          {memory?.lastStep || "Open the portal and check the details"}
                        </p>
                        <p className="text-base text-text-secondary">
                          SafeStep keeps this visible so the user does not have to remember it.
                        </p>
                      </div>
                    </div>

                    {appointmentAdvice ? (
                      <div className="mt-5 rounded-[22px] border border-primary-100 bg-primary-50 p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
                          Prep plan
                        </p>
                        <p className="mt-2 text-lg font-semibold text-text-primary">
                          {appointmentAdvice.summary}
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                              Prepare
                            </p>
                            <ul className="mt-2 space-y-2 text-base text-text-secondary">
                              {appointmentAdvice.preparationActions.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                              Watch for
                            </p>
                            <ul className="mt-2 space-y-2 text-base text-text-secondary">
                              {appointmentAdvice.thingsToWatch.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                              Ask
                            </p>
                            <ul className="mt-2 space-y-2 text-base text-text-secondary">
                              {appointmentAdvice.questionsToAsk.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>
              </main>

              <aside className="rounded-[26px] border border-surface-200 bg-white shadow-sm">
                <div className="border-b border-surface-200 px-5 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Session
                  </p>
                  <p className="mt-1 text-xl font-semibold text-text-primary">
                    {assistantMode === "scam_check"
                      ? "Safety first"
                      : assistantMode === "appointment"
                        ? "Appointment help"
                        : assistantMode === "memory_recall"
                          ? "Memory support"
                          : "Guidance"}
                  </p>
                </div>

                <div className="space-y-4 p-5">
                  <div className="rounded-[22px] border border-primary-100 bg-primary-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
                      Current reminder
                    </p>
                    <p className="mt-2 text-base leading-relaxed text-text-primary">
                      {loadingContext
                        ? "Loading the user context and appointment data..."
                        : memory?.currentTask || "SafeStep is ready to help you continue."}
                    </p>
                    {memory?.currentStageTitle ? (
                      <div className="mt-3 rounded-2xl border border-primary-100 bg-white p-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
                          Current stage
                        </p>
                        <p className="mt-1 text-base text-text-primary">{memory.currentStageTitle}</p>
                        {memory.currentStageDetail ? (
                          <p className="mt-1 text-sm text-text-secondary">{memory.currentStageDetail}</p>
                        ) : null}
                        {memory.nextStageTitle ? (
                          <p className="mt-2 text-sm font-medium text-text-secondary">
                            Next: {memory.nextStageTitle}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => void startDemoTaskFlow()}
                            disabled={flowLoading}
                            className="rounded-full border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-300 disabled:opacity-50"
                          >
                            Start appointment flow
                          </button>
                          <button
                            onClick={() => void advanceDemoTaskFlow()}
                            disabled={flowLoading || !memory.currentStageTitle}
                            className="rounded-full border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-300 disabled:opacity-50"
                          >
                            Next stage
                          </button>
                        </div>
                        {flowMessage ? (
                          <p className="mt-2 text-sm text-text-secondary">{flowMessage}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[22px] border border-surface-200 bg-[#fcfbf8] p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Tell SafeStep about you
                    </p>
                    <p className="mt-2 text-base text-text-secondary">
                      Paste a short summary of your medical history, medications, and anything you want SafeStep to remember.
                    </p>
                    <textarea
                      value={onboardingText}
                      onChange={(event) => setOnboardingText(event.target.value)}
                      placeholder="Example: I have a cardiology follow-up tomorrow. I take blood pressure medicine and need reminders about steps..."
                      className="mt-3 min-h-32 w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base text-text-primary outline-none transition focus:border-primary-400"
                    />
                    <button
                      onClick={() => void handleOnboardingSubmit()}
                      disabled={onboardingLoading}
                      className="mt-3 w-full rounded-2xl bg-primary-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {onboardingLoading ? "Saving..." : "Save my profile"}
                    </button>
                    {onboardingMessage ? (
                      <p className="mt-2 text-sm text-text-secondary">{onboardingMessage}</p>
                    ) : null}
                  </div>

                  <div className="rounded-[22px] border border-surface-200 bg-white p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                      User profile
                    </p>
                    <p className="mt-2 text-lg font-semibold text-text-primary">
                      {userContext?.profile?.name || "Demo user"}
                    </p>
                    <p className="mt-1 text-base text-text-secondary">
                      {userContext?.profile?.ageGroup || "Older adult"} · {userContext?.profile?.timezone || "America/Los_Angeles"}
                    </p>
                    {userContext?.profile?.supportNeeds?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {userContext.profile.supportNeeds.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-sm text-text-secondary"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {userContext?.profile?.onboardingSummary ? (
                      <p className="mt-3 text-sm text-text-secondary">
                        {userContext.profile.onboardingSummary}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {promptButtons.map((button) => (
                      <button
                        key={button.label}
                        onClick={() => void sendRequest(button.mode, button.label)}
                        disabled={loading}
                        className={`rounded-2xl border px-4 py-4 text-left text-base font-semibold transition ${
                          button.tone === "primary"
                            ? "border-primary-500 bg-primary-500 text-white shadow-sm hover:bg-primary-600"
                            : button.tone === "warning"
                              ? "border-warning/20 bg-warning-bg text-warning hover:border-warning"
                              : "border-surface-200 bg-surface-50 text-text-primary hover:border-primary-300 hover:bg-primary-50"
                        }`}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[22px] border border-surface-200 bg-surface-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Ask in your own words
                    </p>
                    <textarea
                      value={userQuery}
                      onChange={(event) => setUserQuery(event.target.value)}
                      placeholder="Type a question or paste a link..."
                      className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-surface-200 bg-white px-4 py-3 text-base text-text-primary outline-none transition focus:border-primary-400"
                    />
                    <button
                      onClick={() => void sendRequest("guidance")}
                      disabled={loading || !userQuery.trim()}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-primary-500 px-4 py-3 text-base font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "Thinking..." : "Ask SafeStep"}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-surface-300 bg-surface-50 p-4 text-base text-text-secondary">
                        Ask for next steps, a scam check, or a memory reminder. The answer will appear here and in the floating widget.
                      </div>
                    ) : (
                      messages.map((message) => (
                        <article
                          key={message.id}
                          className="rounded-[22px] border border-surface-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                              {message.mode.replace("_", " ")}
                            </p>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskBadge(message.riskLevel)}`}>
                            {message.riskLevel || "uncertain"}
                          </span>
                        </div>
                          <p className="mt-3 text-lg font-semibold text-text-primary">
                            {message.nextStep || message.summary}
                          </p>
                          <p className="mt-2 text-base leading-relaxed text-text-secondary">
                            {message.summary}
                          </p>
                          {message.nextStep ? (
                            <div className="mt-3 rounded-2xl bg-primary-50 p-3">
                              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700">
                                What&apos;s next
                              </p>
                              <p className="mt-1 text-base text-text-primary">{message.nextStep}</p>
                            </div>
                          ) : null}
                          <p className="mt-3 text-base leading-relaxed text-text-secondary">
                            {message.explanation}
                          </p>
                          {message.suspiciousSignals?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.suspiciousSignals.map((signal) => (
                                <span
                                  key={signal}
                                  className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-sm text-text-secondary"
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-20">
        {assistantOpen ? (
          <div className="flex max-h-[min(600px,calc(100vh-120px))] w-[min(92vw,390px)] flex-col overflow-hidden rounded-[28px] border border-surface-200 bg-white shadow-[0_24px_64px_rgba(30,26,23,0.18)]">
            <div className="flex items-center justify-between gap-3 border-b border-surface-200 bg-gradient-to-r from-white via-[#fdfaf3] to-[#f4ede2] px-4 py-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                  SafeStep
                </p>
                <p className="text-base font-semibold text-text-primary">
                  {assistantMode === "scam_check"
                    ? "Safety check"
                    : assistantMode === "memory_recall"
                      ? "Memory reminder"
                      : assistantMode === "appointment"
                        ? "Appointment help"
                        : "Guidance"}
                </p>
              </div>
              <button
                onClick={() => setAssistantOpen(false)}
                className="rounded-full border border-surface-200 bg-white px-3 py-1 text-sm font-semibold text-text-secondary hover:border-primary-300 hover:text-primary-700"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <p className="text-base text-text-secondary">
                {loading
                  ? "Thinking carefully..."
                  : assistantPreview}
              </p>
              <div className="flex flex-wrap gap-2">
                {promptButtons.map((button) => (
                  <button
                    key={button.label}
                    onClick={() => void sendRequest(button.mode, button.label)}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      button.tone === "warning"
                        ? "border-warning/20 bg-warning-bg text-warning"
                        : button.tone === "primary"
                          ? "border-primary-500 bg-primary-500 text-white"
                          : "border-surface-200 bg-surface-50 text-text-secondary"
                    }`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAssistantOpen(true)}
            className="group flex items-center gap-3 rounded-full border border-surface-200 bg-white px-4 py-3 shadow-[0_18px_48px_rgba(30,26,23,0.16)] transition hover:-translate-y-0.5 hover:border-primary-300"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500 text-xl text-white shadow-sm">
              🦮
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">
                SafeStep
              </span>
              <span className="block text-base font-semibold text-text-primary">
                Open assistant
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
