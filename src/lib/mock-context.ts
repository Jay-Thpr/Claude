import type {
  AppointmentContext,
  TaskMemoryState,
  UserContextEntry,
  UserProfileContext,
} from "@/lib/response-schema";

export const DEMO_USER_ID = "demo-user-001";

export const DEMO_USER_PROFILE: UserProfileContext = {
  userId: DEMO_USER_ID,
  googleEmail: "maria.garcia@example.com",
  googleName: "Maria Garcia",
  name: "Maria Garcia",
  email: "maria.garcia@example.com",
  timezone: "America/Los_Angeles",
  ageGroup: "older adult",
  calendarConnected: false,
  supportNeeds: [
    "Needs short, plain-language directions",
    "Benefits from reminders about the last step",
    "Should never be rushed into form submission",
  ],
  preferences: [
    "One step at a time",
    "Simple wording",
    "Confirm before sharing personal information",
  ],
  conditions: [
    "Mild memory and task-sequencing difficulty",
    "Needs help tracking healthcare portals and appointment steps",
  ],
  notes:
    "Prefers calm, direct wording and should be warned before submitting forms or payment details.",
  rawIntakeText: "Demo intake text for the hackathon prototype.",
  onboardingSummary: "Demo user seeded from the sample intake flow.",
  onboardingCompletedAt: new Date().toISOString(),
};

export const DEMO_USER_CONTEXT_ENTRIES: UserContextEntry[] = [
  {
    id: "condition-memory",
    category: "condition",
    title: "Memory support",
    detail:
      "Needs reminders of the current task and the last step when navigating healthcare portals.",
    tags: ["memory", "healthcare", "support"],
    priority: 1,
  },
  {
    id: "condition-sequencing",
    category: "condition",
    title: "Task sequencing",
    detail:
      "Benefits from one clear action at a time and should not be rushed through multi-step forms.",
    tags: ["sequencing", "forms", "safety"],
    priority: 1,
  },
  {
    id: "preference-calm",
    category: "preference",
    title: "Calm language",
    detail:
      "Respond best to short sentences, simple wording, and a steady tone.",
    tags: ["tone", "clarity"],
    priority: 2,
  },
  {
    id: "support-caregiver",
    category: "support",
    title: "Trust check",
    detail:
      "If a page looks risky, encourage pausing and checking with a trusted family member.",
    tags: ["trust", "risk", "pause"],
    priority: 2,
  },
];

export const DEMO_MEMORY: TaskMemoryState = {
  currentTask: "Reviewing the upcoming cardiology appointment",
  taskType: "appointment-prep",
  taskGoal: "Get ready for the cardiology appointment step by step",
  currentStageIndex: 0,
  currentStageTitle: "Check the doctor website",
  currentStageDetail: "Open the hospital portal and confirm the visit details.",
  nextStageTitle: "Pack what you need",
  nextStageDetail: "Put the medication list, insurance card, and notes in a bag.",
  stagePlan: [
    {
      title: "Check the doctor website",
      detail: "Open the hospital portal and confirm the visit details.",
    },
    {
      title: "Pack what you need",
      detail: "Put the medication list, insurance card, and notes in a bag.",
    },
    {
      title: "Leave the house",
      detail: "Grab your keys and leave 15 minutes early.",
    },
  ],
  status: "active",
  lastStep: "Opened the patient portal and checked the visit details.",
  currentUrl: "https://myhealth.ucsd.edu",
  pageTitle: "MyChart - Appointments",
};

export const DEMO_APPOINTMENT: AppointmentContext = {
  connected: false,
  summary: "Cardiology follow-up with Dr. Martinez",
  whenLabel: "tomorrow",
  timeLabel: "10:30 AM",
  location: "UCSD Medical Center",
  description:
    "Bring your medication list, insurance card, and a note of any new symptoms.",
  prepNotes: "Arrive 15 minutes early.",
  source: "demo",
};

export const DEMO_PAGE_LIBRARY = [
  {
    id: "portal",
    label: "Appointment portal",
    url: "https://myhealth.ucsd.edu/appointments",
    title: "MyChart - Upcoming Appointment",
    summary:
      "A calm patient portal page showing the next visit, instructions, and a reminder to bring medication information.",
    content:
      "Your next visit is tomorrow at 10:30 AM. Please arrive 15 minutes early and bring your medication list and insurance card.",
    signals: ["Recognized hospital portal", "Appointment details are clear"],
    riskLevel: "safe" as const,
  },
  {
    id: "pharmacy",
    label: "Pharmacy bill",
    url: "https://pharmacy-billing-update.example",
    title: "Urgent Pharmacy Payment Required",
    summary:
      "A suspicious billing page asking for immediate action, personal details, and a payment card.",
    content:
      "Act now to avoid suspension. Enter your account password, Medicare number, and a debit card to restore coverage.",
    signals: ["Urgency language", "Requests password and Medicare number", "Payment pressure"],
    riskLevel: "risky" as const,
  },
  {
    id: "memory",
    label: "Memory check",
    url: "https://safestep.local/remember",
    title: "What was I doing?",
    summary:
      "A gentle memory page that reminds the user about the last task and the next step.",
    content:
      "You were checking the cardiology appointment. Next, review the parking instructions and then stop before submitting anything.",
    signals: ["Memory support page", "No sensitive actions"],
    riskLevel: "safe" as const,
  },
] as const;

export function buildMockTaskMemory(
  overrides: Partial<TaskMemoryState> = {},
): TaskMemoryState {
  return {
    ...DEMO_MEMORY,
    ...overrides,
  };
}
