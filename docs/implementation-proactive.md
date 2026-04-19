# Implementation Plan: Proactive Behavior

Each gap maps to a failing test case. Fix in order — later phases depend on earlier ones.

---

## Phase 1 — Wire task flow chips to `/api/task/step` (fixes Test 4)

**Problem:** When a task is active and the user clicks "Yes", the widget sends a free-text chat message to `/api/chat` instead of advancing the step plan via `/api/task/step`. The step counter never moves. TTS never announces the next step automatically.

**Changes — `chrome-extension/content.js`:**

1. Add module-level `activeTask` state (already exists as `let activeTask = null`) — confirm it stores `{ steps, currentStepIndex, totalSteps }`.

2. In `widgetShowActions(actions)`: change chip click behavior. If `activeTask` is set, clicking "Yes" / "OK" / any affirmative chip should call `advanceTaskStep()` instead of populating the input and calling `widgetSend()`. "Stop" chip should always call `advanceTaskStep("stop")` when a task is active.

3. Add `async function advanceTaskStep(userResponse = "yes")`:
   - POST to `/api/task/step` with `{ steps: activeTask.steps, currentStepIndex: activeTask.currentStepIndex, userResponse, url: location.href }`
   - On response: if `done`, clear `activeTask`, speak announcement, hide progress bar
   - If not done: update `activeTask.currentStepIndex = data.nextStepIndex`, speak `data.announcement` via TTS, update progress bar, show `["Yes, done", "Stop"]` chips

4. In the `SAFESTEP_AUTO_OPEN` handler that starts a task (when user clicks "Yes, help me prepare"): after receiving `/api/task/start` response, store the full step plan in `activeTask` and call `advanceTaskStep()` to announce step 0 immediately — do not wait for user input.

---

## Phase 2 — Appointment reminder snooze + deduplication (fixes Test 3)

**Problem:** Clicking "Remind me later" does nothing — the widget just closes. On the next navigation the reminder fires again for the same appointment.

**Changes — `chrome-extension/content.js`:**

1. "Remind me later" chip: write `{ snoozeUntil: Date.now() + 30 * 60 * 1000, appointmentId: <summary+date> }` to `chrome.storage.local.safestep_snooze`.

2. "Yes, help me prepare" chip: write `{ firedFor: <summary+date> }` to `chrome.storage.local.safestep_appt_fired` so the reminder never fires again for this event.

**Changes — `chrome-extension/background.js`:**

3. In `pollGCal()`: before sending `SAFESTEP_REMIND`, read `safestep_snooze` and `safestep_appt_fired` from local storage. Skip if:
   - `firedFor` matches this appointment (already handled)
   - `snoozeUntil` is in the future

4. Poll GCal on every navigation too (not just alarm), throttled: read `safestep_last_gcal_poll` from local storage — only poll if more than 5 minutes have passed. This makes test 3 pass within 2 minutes instead of waiting for the 30-minute alarm.

---

## Phase 3 — Auto-open on any page when task is active (fixes Test 5)

**Problem:** When the user reopens the browser and navigates to ANY page, the widget should open and say "You were working on X. Want to continue?" Currently it only opens if `orient` returns `autoOpen=true` (risky page, appointment, or same hostname).

**Changes — `chrome-extension/background.js`:**

1. In `orientTab()`, after the orient API call: also read `safestep_memory` from `chrome.storage.local`. If `memory.currentTask` exists and `memory.status === "active"`, always send `SAFESTEP_AUTO_OPEN` — even if orient returned `autoOpen: false`.

2. Set the greeting to: `"You were working on "${memory.currentTask}". Would you like to continue where you left off?"` with chips `["Yes, continue", "Start something new"]`.

3. "Yes, continue" chip: restore `activeTask` from memory and call `advanceTaskStep()` from the current step index.

---

## Phase 4 — "Leave this page" chip navigates away (fixes Test 2)

**Problem:** Clicking "Leave this page" sends the text as a chat message instead of navigating away.

**Changes — `chrome-extension/content.js`:**

1. Change `widgetShowActions(actions)` to accept objects instead of plain strings: `{ label: string, action: "chat" | "navigate_back" | "snooze" | "continue_task" }`.

2. Update all callers (`SAFESTEP_AUTO_OPEN`, `SAFESTEP_REMIND` handlers) to pass action objects.

3. In the chip click handler: route by `action` type:
   - `"navigate_back"` → `history.back()`
   - `"snooze"` → write snooze to storage, close widget
   - `"continue_task"` → resume active task
   - `"chat"` → existing behavior (populate input, call `widgetSend()`)

---

## Phase 5 — TTS speaks immediately and clearly on every auto-open (fixes Test 1, Test 2, Test 3)

**Problem:** TTS fires when the panel opens, but only if `speechSynthesis` is available and only after the DOM is ready. On some navigations it is silent.

**Changes — `chrome-extension/content.js`:**

1. Extract `speakText(text)` helper: cancels any in-progress utterance, creates a new `SpeechSynthesisUtterance` at rate 0.88, volume 1.0, and calls `speechSynthesis.speak()`. Wrap in a 150ms delay after panel open to avoid the Chrome TTS bug where `speak()` is ignored if called too early after page load.

2. In `SAFESTEP_AUTO_OPEN` handler: call `speakText(msg.greeting)` immediately after opening the panel — before any chip render or API call.

3. In `SAFESTEP_REMIND` handler: call `speakText(announcement)` immediately. Do not wait for widgetSend.

4. In `advanceTaskStep()` response handler: call `speakText(data.announcement)` immediately after receiving the response.

---

## Phase 6 — Safe pages stay quiet (validates Test 6, no code change needed)

**Verify only:** `orient` already returns `autoOpen: false` for safe pages with no active task and no imminent appointment. Phase 3 adds "active task" as a new autoOpen trigger — confirm it only fires when `memory.status === "active"` and not for completed or null tasks. Add a guard: clear `memory.status` (set to `"done"`) when the final task step completes (already done in `advanceTaskStep` above).

---

## Phase 7 — Offline graceful failure (fixes Test 7)

**Problem:** If fetch throws (offline), the widget may go blank or show a raw error.

**Changes — `chrome-extension/content.js`:**

1. In `widgetSend()` catch block: instead of `widgetAppend(error.message, 'assistant')`, always show: `"I'm having trouble connecting. Please try again in a moment."` Speak it via TTS.

2. In `advanceTaskStep()` catch block: same calm fallback. Do not clear `activeTask` on network error — preserve state so the user can retry.

**Changes — `chrome-extension/background.js`:**

3. In `orientTab()` catch block: do not send `SAFESTEP_AUTO_OPEN` on network error. Fail silently.

---

## Summary of files changed

| File | Phases |
|---|---|
| `chrome-extension/content.js` | 1, 2, 4, 5, 7 |
| `chrome-extension/background.js` | 2, 3, 7 |
| `src/app/api/task/step/route.ts` | (no change needed) |
| `src/app/api/task/start/route.ts` | (no change needed) |

## Order to implement

1. Phase 5 (TTS) — fast, isolated, immediately visible
2. Phase 4 (chip actions) — structural change that Phase 1 depends on
3. Phase 1 (task step wiring) — core guided flow
4. Phase 2 (snooze) — calendar UX
5. Phase 3 (memory auto-open) — cross-session continuity
6. Phase 7 (offline) — polish
