# Agent Architecture

## Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js 16 App Router | UI + API routes |
| Orchestrator | Gemini (via `src/lib/orchestrator.ts`) | Copilot guidance, scam checks |
| Browser agent | Python FastAPI (port 8000) + browser-use | Autonomous web navigation |
| Browser LLM | `gemini-3.1-flash-lite-preview` | Powers browser-use agent steps |
| Database | Supabase (Postgres) | Persistent memory + user profiles |
| Calendar | Google Calendar API | Appointment creation and modification |

---

## Supabase Tables

### `user_profiles` — permanent, one row per user
Who the user is. Written once during onboarding, read by every agent call.

| Column | Type | Description |
|--------|------|-------------|
| user_id | text PK | `demo-user-001` for demo |
| name | text | Full name |
| age_group | text | e.g. "older adult" |
| conditions | text[] | Medical conditions |
| preferences | text[] | Communication preferences |
| support_needs | text[] | What the user needs help with |
| notes | text | Free-form notes for agents |
| google_email | text | Linked Google account |

### `task_memory` — working memory, one row per user, always overwritten
What is the user doing right now. Agents read this at the start of every task to pick up where the user left off.

| Column | Type | Description |
|--------|------|-------------|
| user_id | text PK | `demo-user-001` for demo |
| current_task | text | Goal of the current/last task |
| last_step | text | Last action taken |
| current_url | text | Last URL visited |
| page_title | text | Last page title |
| updated_at | timestamp | When last updated |

### `scam_checks` — append-only log
Every scam check result. Used for history and pattern analysis.

### `appointments` — appointment records
GCal events created or modified by the browser agent.

### `user_context_entries` — detailed context cards
Structured per-user notes (conditions, preferences, routines) written during onboarding.

---

## How Context Flows Into the Browser Agent

Every call to `POST /api/browser-agent` builds the agent task in this order:

```
1. user_profiles  →  who the user is, how to behave, what NOT to auto-submit
2. task_memory    →  what the user was last doing (continuity across sessions)
3. goal           →  the specific task requested
4. context        →  caller-provided session-specific info (optional)
5. fieldsHint     →  JSON output format (if returnFields, scheduleResult, or calendarAction set)
```

All five sections are joined and sent as the browser-use agent's task string.

---

## How Memory Updates

- **Browser agent** (`/api/browser-agent`): awaits `updateTaskMemory` before reading it back, so the response always reflects the latest state.
- **Copilot** (`/api/copilot/respond`, `/api/next-step`): fire-and-forget `updateTaskMemory` — doesn't block the response.

---

## Browser Agent Flow

```
POST /api/browser-agent
  ├── load user_profiles from Supabase (→ DEMO_USER_PROFILE fallback)
  ├── load task_memory from Supabase (→ null if first run)
  ├── build task string (profile + memory + goal + context + fields)
  ├── POST /api/extract to Python backend (port 8000)
  │     └── browser-use agent navigates web, returns final_result()
  ├── tryParseJson(result) → structured data if agent returned JSON
├── if calendarAction=create + parsed.scheduledAt → createAppointment() → GCal
├── if calendarAction=update + parsed.eventId → updateAppointment() → GCal
├── updateTaskMemory (upsert current_task + last_step)
└── return { success, result, parsed, scheduled, updated, calendarEvent, memory }
```

---

## Key Rules for Agents

- **Never auto-submit forms** — the profile context always includes an explicit IMPORTANT line telling the agent to pause before submitting, confirming, or sharing personal info.
- **Graceful degradation** — if `scheduleResult: true` or `calendarAction: "create"` but the agent finds a phone number instead of a bookable slot, `scheduled` is null and the useful info is still returned in `result`.
- **Model**: `gemini-3.1-flash-lite-preview` via `SAFESTEP_BROWSER_MODEL` env var in `backend/.env`.
- **API key**: `ANTHROPIC_API_KEY` in `backend/.env` for the browser-use LLM client. If older runtime code still reads `GEMINI_API_KEY`, set both during migration.

---

## Adding a New Agent Capability

1. Add fields to `BrowserAgentRequest` interface in `route.ts`
2. Inject relevant context into the task string
3. Parse the result with `tryParseJson`
4. Call the appropriate lib function (e.g. `createAppointment`, `updateAppointment`, `logScamCheck`)
5. Update `task_memory` with what happened
