# Live Pre-Deploy Testing Checklist

Run these in order. Each section starts with a smoke test — if that fails, stop and fix before going deeper.

**Setup before starting:**
- `npm run dev` is running at `http://localhost:3000`
- Chrome extension loaded at `chrome://extensions` (Developer mode → Load unpacked → `chrome-extension/`)
- Extension icon visible in toolbar

---

## 1. Extension loads

**Smoke test**
- [ ] Click the SafeStep extension icon — popup opens without a blank screen or console error

**Expand**
- [ ] Popup shows user name or "Hello" greeting
- [ ] No red error badges on the extension icon
- [ ] Open `chrome://extensions`, confirm no "Errors" button on SafeStep tile

---

## 2. Page orientation (orient endpoint)

**Smoke test**
- [ ] Navigate to `https://www.google.com` — open the popup, confirm it says something about the page (not a generic fallback error)

**Expand**
- [ ] Navigate to a safe page (e.g. `https://www.nytimes.com`) — popup safety tone should be **safe**, no alarm
- [ ] Navigate to a page with pressure language (try `https://www.test-scammer-page.com` or any page with "Act now" / "Your account is suspended") — popup safety tone should be **risky** or **uncertain**
- [ ] Risky page: widget should **auto-open** without clicking the extension icon
- [ ] Risky page: floating widget shows a proactive tip mentioning the danger
- [ ] Risky page: action chips include "Yes, check this page" and "Leave this page"

---

## 3. Chat — basic response

**Smoke test**
- [ ] Open popup, type "hello" and press Send — get a reply within 5 seconds, no 500 error

**Expand**
- [ ] Reply is in plain, short sentences (not technical jargon)
- [ ] Type "what is this page?" on any website — response references the actual page title or URL
- [ ] Type "how are you?" — reply does NOT trigger scam check mode (casual chat path)
- [ ] Type "is this page safe?" — reply includes a risk assessment and suspicious signals list

---

## 4. Scam check

**Smoke test**
- [ ] On any page, open popup, type "is this a scam?" — get a response with a clear safe/uncertain/risky verdict

**Expand**
- [ ] Navigate to a login page (e.g. any `.gov` login) — ask "is this safe?" — response should acknowledge the login form and say it looks legitimate
- [ ] Response always includes at least one `suspiciousSignals` item (even safe pages list notable features)
- [ ] Response does NOT give a generic answer — it should name something actually visible on the page

---

## 5. Memory — task continuity

**Smoke test**
- [ ] Ask the popup "what was I doing?" — get a response (even if it's "you haven't started a task yet")

**Expand**
- [ ] Complete a guided interaction (e.g. ask for help with an appointment), then navigate to a new page
- [ ] On the new page, open popup — the greeting or context should reference your previous task
- [ ] Ask "what was I doing?" — response names the previous task, not a blank state
- [ ] Close and reopen the browser (not just the tab) — task memory should still be present

---

## 6. Google Calendar integration

**Smoke test**
- [ ] Open popup — if Google Calendar is connected, appointment section shows something (not blank)
- [ ] If not connected, popup shows a "Connect calendar" prompt or graceful fallback

**Expand** *(requires GCal connected — see `docs/gcal-setup.md`)*
- [ ] Popup lists the next upcoming appointment with date, time, and location
- [ ] If an appointment is within 2 hours: floating widget auto-opens with a tip like "Your appointment is in X minutes"
- [ ] Action chips on that tip include "Yes, help me prepare" and "Remind me later"
- [ ] Navigate away and come back — appointment tip does not re-fire for the same event within the same session

---

## 7. Guided task flow

**Smoke test**
- [ ] In the popup or widget, click "Yes, help me prepare" (after a calendar trigger) — get back a step-by-step plan with at least 2 steps

**Expand**
- [ ] First step is announced as text in the widget
- [ ] Click "Yes" or type a confirmation — widget advances to the next step
- [ ] Progress bar (if visible) updates to reflect current step
- [ ] Type "stop" mid-flow — widget says it's stopping, does not advance
- [ ] Complete all steps — widget says "We're all done!" or equivalent

---

## 8. Floating widget (content script)

**Smoke test**
- [ ] On any page, trigger the widget (either via auto-open or by a keyboard shortcut / popup button) — it appears without breaking the page layout

**Expand**
- [ ] Widget is draggable or positioned out of the way of page content
- [ ] Dismiss button closes the widget
- [ ] After dismissing, navigating back one page works normally (no double back-navigation)
- [ ] Widget text is readable at 150% browser zoom
- [ ] Widget does not interfere with forms on the host page (shadow DOM isolation)

---

## 9. Background polling

**Smoke test**
- [ ] Open `chrome://extensions` → SafeStep → "Service worker" link → console shows no uncaught errors after 60 seconds of idle

**Expand**
- [ ] After ~30 minutes (or force-trigger by temporarily lowering the alarm interval): background polls GCal, result written to `chrome.storage.local` — verify in DevTools → Application → Storage → Local Storage (extension)
- [ ] If a new appointment appears within 4 hours, background sends a reminder to the active tab without user interaction

---

## 10. Error handling & edge cases

- [ ] Turn off wifi, then ask something in the popup — get a graceful fallback message, not a blank screen or JS error
- [ ] Navigate to `chrome://newtab` — extension does not crash (content scripts don't run on chrome:// pages, which is expected)
- [ ] Navigate to a PDF in Chrome — extension does not crash
- [ ] Open two tabs side by side and interact in each — no cross-tab memory bleed

---

## Sign-off

When all smoke tests pass and the expanded checks you care about are green, the build is ready to deploy.
