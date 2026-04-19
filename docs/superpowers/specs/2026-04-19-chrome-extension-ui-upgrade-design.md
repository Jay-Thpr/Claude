# Chrome Extension UI Upgrade — Design Spec
*2026-04-19*

## Goal

Visually upgrade the SafeStep Chrome extension popup to match the webapp's `CopilotPanel` aesthetic, and port the webapp's quick-action features (scam check, next-step, memory, repeat) into the extension with no new API endpoints or dependencies.

---

## Scope

Files changed: `chrome-extension/popup.html`, `chrome-extension/popup.css`, `chrome-extension/popup.js`  
No new files. No new API endpoints. No external libraries.

---

## Appointments Tab

**Card styling** matches webapp:
- Blue left-border card (`border-left: 4px solid #1a6fad`, `background: #f0f7ff`, `border-radius: 10px`)
- Appointment title: bold, 20px
- When / location: subdued, 16px
- Prep advice block: amber left-border card (`border-left: 4px solid #d97706`, `background: #fffbeb`)

**Loading state**: CSS spinner animation (border + `animation: spin`) replacing the text-only state.

**Empty state**: "No upcoming appointments" displayed in a muted card rather than blank space.

---

## Chat Tab

### Quick Action Buttons

A button row pinned between the tab bar and the chat transcript. Four buttons:

| Button | Label | API call |
|--------|-------|----------|
| 🛡️ | Is this safe? | `POST /api/scam-check` with `{ url, pageTitle, content: "" }` |
| 👉 | What's next? | `POST /api/next-step` with `{ url, pageTitle, question: "What do I do next?", taskMemory }` |
| 🧠 | What was I doing? | Uses cached `taskMemory` — no extra fetch |
| 🔄 | (icon) | Repeats last assistant message locally — zero API calls |

`taskMemory` is fetched once via `GET /api/memory` when the popup opens (silent, non-blocking).  
Current tab `url` + `pageTitle` are fetched via `chrome.tabs.query` once on open and reused.

### Tone-Colored Bubbles

Response bubbles are colored by a `data-tone` attribute set from API response fields:

| Tone | Trigger field value | Bubble bg | Border |
|------|-------------------|-----------|--------|
| safe | `/safe|ready|ok/i` | `#f0fdf4` | `#16a34a` |
| warning | `/warning|careful/i` | `#fffbeb` | `#d97706` |
| danger | `/risky|danger|stop/i` | `#fef2f2` | `#dc2626` |
| neutral | (default) | `#f5f5f5` | `#e0e0e0` |

User bubbles: primary blue bg (`#1a6fad`), white text, right-aligned.  
Assistant bubbles: tone-colored, left-aligned.

Tone is derived from `data.riskLevel` (chat/next-step) or `data.classification` (scam-check) — same regex as `buildAssistantTone()` in `CopilotPanel.tsx`.

### Input Row

- `→` arrow icon replaces "Send" text
- Textarea auto-resizes (1–4 rows) on input
- Focus ring: `border-color: #1a6fad`
- Send button: `background: #1a6fad`, `border-radius: 8px`, disabled state `opacity: 0.5`

---

## Visual Tokens (CSS variables)

```css
:root {
  --primary: #1a6fad;
  --primary-light: #f0f7ff;
  --safe: #16a34a;
  --safe-bg: #f0fdf4;
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --surface: #f8f8f8;
  --border: #e0e0e0;
  --text-primary: #111;
  --text-muted: #666;
  --radius-card: 10px;
  --radius-bubble: 16px;
}
```

---

## Layout / Sizing

- Popup width: 380px (unchanged)
- Appointments panel: `min-height: 300px`, padding 16px
- Chat panel: fixed height `480px`, flex column (action-row / messages / input)
- Action buttons: full width, `48px` tall, `font-size: 16px`, icon + label side-by-side
- Font sizes stay large (16–20px) for accessibility (target: older adults)

---

## Data Flow

```
popup opens
  → chrome.tabs.query → store { url, pageTitle }
  → GET /api/memory   → store taskMemory (silent)
  → GET /api/appointments → render appointments tab

user clicks action button
  → append user bubble (local)
  → POST /api/<endpoint> with { url, pageTitle, [taskMemory] }
  → derive tone from response
  → append assistant bubble with tone color

user types + sends
  → same as chat tab today (POST /api/chat)
  → tone derived from response.riskLevel
```

---

## Out of Scope

- Google Calendar connect/disconnect (extension can't do OAuth redirect cleanly)
- Pharmacy trace (browser-use task — requires webapp context)
- Onboarding / "Edit basics" link
- Persistent chat history across popup closes
