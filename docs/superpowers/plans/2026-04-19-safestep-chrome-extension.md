# SafeStep Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vanilla JS Chrome extension that shows a toolbar popup fetching upcoming appointments from the existing Next.js backend at `localhost:3000/api/appointments`.

**Architecture:** A single Chrome MV3 extension with no background service worker and no content script. The toolbar icon opens `popup.html`, which loads `popup.js` on `DOMContentLoaded`. `popup.js` fetches `/api/appointments`, parses the response, and renders one of three states (loading, appointment card, error) by toggling CSS classes. All styling lives in `popup.css`.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES2020), Chrome Extension Manifest V3

---

## File Map

| File | Responsibility |
|---|---|
| `chrome-extension/manifest.json` | Extension metadata, declares popup entry point |
| `chrome-extension/popup.html` | HTML shell with three hidden state divs |
| `chrome-extension/popup.css` | Senior-friendly styles, state visibility logic |
| `chrome-extension/popup.js` | Fetch + render logic |
| `chrome-extension/icon.png` | 128×128 toolbar icon (generated via canvas) |

---

## Task 1: Scaffold the folder and manifest

**Files:**
- Create: `chrome-extension/manifest.json`

- [ ] **Step 1: Create the folder**

```bash
mkdir chrome-extension
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "manifest_version": 3,
  "name": "SafeStep",
  "version": "1.0",
  "description": "Your senior-friendly browser copilot",
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "128": "icon.png"
    }
  }
}
```

Save to `chrome-extension/manifest.json`.

- [ ] **Step 3: Generate a placeholder icon**

Create `chrome-extension/generate-icon.html` temporarily to produce the PNG, OR just copy any 128×128 PNG into `chrome-extension/icon.png`. For a quick placeholder, create `chrome-extension/icon.svg` and reference it — but Chrome requires PNG for the action icon, so use this one-liner in the browser console on any page to create a data URL you can save as `icon.png`:

Open any Chrome tab, open DevTools console, paste:

```js
const c = document.createElement('canvas');
c.width = 128; c.height = 128;
const ctx = c.getContext('2d');
ctx.fillStyle = '#1a6fad';
ctx.fillRect(0, 0, 128, 128);
ctx.fillStyle = '#fff';
ctx.font = 'bold 64px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('S', 64, 64);
c.toBlob(b => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'icon.png';
  a.click();
});
```

Save the downloaded `icon.png` into `chrome-extension/icon.png`.

- [ ] **Step 4: Verify folder contents**

```bash
ls chrome-extension/
```

Expected output includes: `manifest.json`, `icon.png`

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/manifest.json chrome-extension/icon.png
git commit -m "feat: scaffold chrome extension manifest and icon"
```

---

## Task 2: Write the HTML shell

**Files:**
- Create: `chrome-extension/popup.html`

- [ ] **Step 1: Write popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SafeStep</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header>
    <span class="logo">SafeStep</span>
  </header>

  <main>
    <!-- Loading state -->
    <div id="state-loading" class="state">
      <p class="loading-text">Getting your appointments…</p>
    </div>

    <!-- Appointment card state -->
    <div id="state-loaded" class="state hidden">
      <p class="section-label">Your next appointment</p>
      <div class="card">
        <p id="appt-summary" class="appt-title"></p>
        <p id="appt-when" class="appt-when"></p>
        <p id="appt-location" class="appt-location hidden"></p>
      </div>
      <div id="prep-block" class="prep hidden">
        <p class="section-label">To prepare</p>
        <p id="appt-prep" class="prep-text"></p>
      </div>
    </div>

    <!-- Error state -->
    <div id="state-error" class="state hidden">
      <p class="error-text">Could not load appointments.</p>
      <p class="error-sub">Make sure the app is running at localhost:3000.</p>
    </div>
  </main>

  <script src="popup.js"></script>
</body>
</html>
```

Save to `chrome-extension/popup.html`.

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.html
git commit -m "feat: add popup HTML shell with three states"
```

---

## Task 3: Write the CSS

**Files:**
- Create: `chrome-extension/popup.css`

- [ ] **Step 1: Write popup.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 380px;
  min-height: 400px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: #222;
  background: #fff;
}

header {
  background: #1a6fad;
  padding: 16px 20px;
}

.logo {
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

main {
  padding: 20px;
}

/* State visibility */
.state { display: block; }
.hidden { display: none; }

/* Loading */
.loading-text {
  font-size: 20px;
  color: #555;
  text-align: center;
  margin-top: 60px;
}

/* Appointment card */
.section-label {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #1a6fad;
  margin-bottom: 10px;
}

.card {
  background: #f0f7ff;
  border-left: 5px solid #1a6fad;
  border-radius: 6px;
  padding: 16px 18px;
  margin-bottom: 20px;
}

.appt-title {
  font-size: 22px;
  font-weight: 700;
  color: #111;
  margin-bottom: 6px;
}

.appt-when {
  font-size: 19px;
  color: #333;
}

.appt-location {
  font-size: 17px;
  color: #555;
  margin-top: 6px;
}

/* Prep advice */
.prep {
  background: #fffbea;
  border-left: 5px solid #e6a817;
  border-radius: 6px;
  padding: 14px 18px;
}

.prep-text {
  font-size: 17px;
  color: #333;
  line-height: 1.7;
}

/* Error */
.error-text {
  font-size: 20px;
  font-weight: 600;
  color: #c0392b;
  text-align: center;
  margin-top: 50px;
  margin-bottom: 10px;
}

.error-sub {
  font-size: 16px;
  color: #555;
  text-align: center;
}
```

Save to `chrome-extension/popup.css`.

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "feat: add senior-friendly popup styles"
```

---

## Task 4: Write the JavaScript fetch + render logic

**Files:**
- Create: `chrome-extension/popup.js`

- [ ] **Step 1: Write popup.js**

```js
const API_BASE = 'http://localhost:3000';

function showState(id) {
  ['state-loading', 'state-loaded', 'state-error'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function renderAppointment(data) {
  const appt = data.appointment;

  if (!appt) {
    // Connected but no upcoming appointments
    document.getElementById('appt-summary').textContent = 'No upcoming appointments found.';
    document.getElementById('appt-when').textContent = '';
    showState('state-loaded');
    return;
  }

  document.getElementById('appt-summary').textContent = appt.summary || 'Appointment';

  const when = [appt.whenLabel, appt.timeLabel].filter(Boolean).join(' at ');
  document.getElementById('appt-when').textContent = when;

  const locationEl = document.getElementById('appt-location');
  if (appt.location) {
    locationEl.textContent = appt.location;
    locationEl.classList.remove('hidden');
  }

  const prepBlock = document.getElementById('prep-block');
  const prepEl = document.getElementById('appt-prep');
  if (data.prep_advice) {
    prepEl.textContent = data.prep_advice;
    prepBlock.classList.remove('hidden');
  }

  showState('state-loaded');
}

document.addEventListener('DOMContentLoaded', () => {
  showState('state-loading');

  fetch(`${API_BASE}/api/appointments`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => renderAppointment(data))
    .catch(() => showState('state-error'));
});
```

Save to `chrome-extension/popup.js`.

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.js
git commit -m "feat: add popup fetch and render logic for appointments"
```

---

## Task 5: Load and test the extension in Chrome

**Files:** none (manual verification)

- [ ] **Step 1: Start the Next.js backend**

In a terminal in the repo root:

```bash
npm run dev
```

Expected: server starts at `http://localhost:3000`

- [ ] **Step 2: Load the extension unpacked**

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** on (top-right switch)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder inside this repo
5. "SafeStep" should appear in the extensions list with no errors

- [ ] **Step 3: Verify loading state**

Click the SafeStep icon in the Chrome toolbar while the backend is starting. The popup should show "Getting your appointments…"

- [ ] **Step 4: Verify appointment card renders**

Once the backend is running, click the SafeStep icon. Expected:
- Header shows "SafeStep" in blue
- Appointment title shown in large bold text
- When/time shown below it
- Prep advice shown in yellow card (if API returns `prep_advice`)

If source is `"demo"`, the demo appointment from `mock-context.ts` will display — this is expected when Google Calendar is not connected.

- [ ] **Step 5: Verify error state**

Stop the Next.js backend (`Ctrl+C`), then click the SafeStep icon again. Expected:
- Red "Could not load appointments." message
- "Make sure the app is running at localhost:3000." below it

- [ ] **Step 6: Final commit**

```bash
git add chrome-extension/
git commit -m "feat: complete SafeStep Chrome extension MVP — appointments popup"
```

---

## Self-Review Notes

- All three spec states (loading, loaded, error) are implemented in Tasks 2–4
- API fields used (`appointment.summary`, `appointment.whenLabel`, `appointment.timeLabel`, `appointment.location`, `prep_advice`) match the actual `/api/appointments` route verified in the spec
- No content script, no background worker — matches spec decision
- `API_BASE` constant at top of `popup.js` — easy to swap for production URL
- Senior-friendly typography (18px base, 22px titles, high contrast) — matches UX requirements
- No TDD possible for Chrome extension UI without a test harness — manual verification steps in Task 5 cover all states
