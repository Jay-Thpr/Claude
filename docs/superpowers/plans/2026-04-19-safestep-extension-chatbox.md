# SafeStep Chrome Extension — Chatbox Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-tab layout (Appointments | Chat) to the existing Chrome extension popup, where the Chat tab sends messages to `/api/chat` with the current tab's URL and title.

**Architecture:** A tab bar is inserted between the header and main content. The existing appointment states are wrapped in `#panel-appointments`. A new `#panel-chat` div holds the message list and input row. `popup.js` gains `switchTab()`, `appendMessage()`, and `sendMessage()` functions. No new files are created.

**Tech Stack:** Vanilla HTML5, CSS3, JavaScript (ES2020), Chrome Extension Manifest V3, `chrome.tabs` API

---

## File Map

| File | Change |
|---|---|
| `chrome-extension/manifest.json` | Add `"permissions": ["tabs"]` |
| `chrome-extension/popup.html` | Add tab bar + wrap existing states in panel div + add chat panel |
| `chrome-extension/popup.css` | Add tab bar styles + chat panel styles |
| `chrome-extension/popup.js` | Add `switchTab`, `appendMessage`, `sendMessage`, wire up events |

---

## Task 1: Add tabs permission to manifest

**Files:**
- Modify: `chrome-extension/manifest.json`

- [ ] **Step 1: Update manifest.json**

Replace the current contents with:

```json
{
  "manifest_version": 3,
  "name": "SafeStep",
  "version": "1.0",
  "description": "Your senior-friendly browser copilot",
  "permissions": ["tabs"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "128": "icon.png"
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
cat chrome-extension/manifest.json | python3 -m json.tool > /dev/null && echo "valid JSON"
```

Expected: `valid JSON`

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/manifest.json
git commit -m "feat: add tabs permission to manifest for chat tab"
```

---

## Task 2: Update popup.html — tab bar and panels

**Files:**
- Modify: `chrome-extension/popup.html`

The existing file has a `<header>` and a `<main>` containing three state divs. This task:
1. Adds a `<nav class="tab-bar">` between header and main
2. Wraps the existing `<main>` content in `<div id="panel-appointments" class="panel">`
3. Adds a new `<div id="panel-chat" class="panel hidden">` after the appointments panel

- [ ] **Step 1: Write the updated popup.html**

Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>SafeStep</title>
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <header>
    <h1 class="logo">SafeStep</h1>
  </header>

  <nav class="tab-bar">
    <button id="tab-appointments" class="tab active">Appointments</button>
    <button id="tab-chat" class="tab">Chat</button>
  </nav>

  <div id="panel-appointments" class="panel">
    <!-- Loading state -->
    <div id="state-loading" class="state" role="status">
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
  </div>

  <div id="panel-chat" class="panel hidden">
    <div id="chat-messages" class="chat-messages"></div>
    <div class="chat-input-row">
      <textarea id="chat-input" class="chat-input" placeholder="Ask me anything…" rows="1"></textarea>
      <button id="chat-send" class="chat-send-btn">Send</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.html
git commit -m "feat: add tab bar and chat panel to popup HTML"
```

---

## Task 3: Update popup.css — tab bar and chat styles

**Files:**
- Modify: `chrome-extension/popup.css`

Append the new rules to the end of the existing file. Do not change any existing rules.

- [ ] **Step 1: Append tab bar and chat styles**

Open `chrome-extension/popup.css` and append the following to the end of the file:

```css
/* Tab bar */
.tab-bar {
  display: flex;
  border-bottom: 2px solid #e0e0e0;
  background: #f8f8f8;
}

.tab {
  flex: 1;
  padding: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #555;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-family: inherit;
}

.tab.active {
  color: #1a6fad;
  border-bottom-color: #1a6fad;
}

/* Panel visibility */
.panel { display: block; }

/* Chat panel */
#panel-chat {
  display: flex;
  flex-direction: column;
  height: 440px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.msg {
  max-width: 85%;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 17px;
  line-height: 1.5;
}

.msg-user {
  align-self: flex-end;
  background: #1a6fad;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.msg-assistant {
  align-self: flex-start;
  background: #f0f0f0;
  color: #222;
  border-bottom-left-radius: 4px;
}

.msg-error {
  align-self: flex-start;
  background: #fdecea;
  color: #c0392b;
  border-bottom-left-radius: 4px;
}

.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  background: #fff;
}

.chat-input {
  flex: 1;
  font-size: 17px;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
}

.chat-send-btn {
  padding: 10px 18px;
  background: #1a6fad;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}

.chat-send-btn:disabled {
  background: #aaa;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "feat: add tab bar and chat styles to popup CSS"
```

---

## Task 4: Update popup.js — tab switching and chat logic

**Files:**
- Modify: `chrome-extension/popup.js`

Replace the entire file. The existing appointment logic is preserved exactly — new functions and event listeners are added.

- [ ] **Step 1: Write the updated popup.js**

Replace the entire file with:

```js
const API_BASE = 'http://localhost:3000';

// ─── State helpers ────────────────────────────────────────────────────────────

function showState(id) {
  ['state-loading', 'state-loaded', 'state-error'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  document.getElementById('panel-appointments').classList.toggle('hidden', tab !== 'appointments');
  document.getElementById('panel-chat').classList.toggle('hidden', tab !== 'chat');
  document.getElementById('tab-appointments').classList.toggle('active', tab === 'appointments');
  document.getElementById('tab-chat').classList.toggle('active', tab === 'chat');
}

// ─── Appointments ─────────────────────────────────────────────────────────────

function renderAppointment(data) {
  document.getElementById('appt-location').classList.add('hidden');
  document.getElementById('prep-block').classList.add('hidden');

  const appt = data.appointment;

  if (!appt || typeof appt !== 'object') {
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
  if (typeof data.prep_advice === 'string' && data.prep_advice) {
    prepEl.textContent = data.prep_advice;
    prepBlock.classList.remove('hidden');
  }

  showState('state-loaded');
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function appendMessage(text, role) {
  const el = document.createElement('div');
  el.className = `msg msg-${role}`;
  el.textContent = text;
  const list = document.getElementById('chat-messages');
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  btn.textContent = '…';
  btn.disabled = true;
  appendMessage(text, 'user');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, url: tab?.url, pageTitle: tab?.title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    appendMessage(data.message || data.reply || JSON.stringify(data), 'assistant');
  } catch (err) {
    console.error('[SafeStep] chat error:', err);
    appendMessage('Sorry, something went wrong. Please try again.', 'error');
  } finally {
    btn.textContent = 'Send';
    btn.disabled = false;
    input.focus();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.getElementById('tab-appointments').addEventListener('click', () => switchTab('appointments'));
  document.getElementById('tab-chat').addEventListener('click', () => switchTab('chat'));

  // Chat input
  document.getElementById('chat-send').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Load appointments on open
  showState('state-loading');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  fetch(`${API_BASE}/api/appointments`, { signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => renderAppointment(data))
    .catch((err) => { console.error('[SafeStep] fetch error:', err); showState('state-error'); })
    .finally(() => clearTimeout(timer));
});
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.js
git commit -m "feat: add tab switching and chat logic to popup JS"
```

---

## Task 5: Manual verification in Chrome

**Files:** none (manual testing)

- [ ] **Step 1: Reload the extension**

In Chrome, go to `chrome://extensions`, find SafeStep, click the **reload** icon (circular arrow). This picks up all file changes without needing to re-load unpacked.

- [ ] **Step 2: Verify tab bar renders**

Click the SafeStep toolbar icon. Expected:
- "SafeStep" header at top
- Two tabs below: **Appointments** (active, blue underline) and **Chat**
- Appointment data loads as before

- [ ] **Step 3: Verify tab switching**

Click **Chat** tab. Expected:
- Chat panel appears (empty message list, textarea + Send button at bottom)
- Appointments panel hidden
- Chat tab shows blue underline, Appointments tab is gray

Click **Appointments** tab. Expected: switches back to appointment card.

- [ ] **Step 4: Verify chat send**

Switch to Chat tab. Type a message (e.g. "What should I bring to my appointment?") and press Send or Enter. Expected:
- User message appears right-aligned in blue bubble immediately
- Send button shows "…" and is disabled while waiting
- Assistant reply appears left-aligned in gray bubble
- Send button returns to "Send" and textarea is focused

- [ ] **Step 5: Verify error state**

Stop the Next.js backend (`Ctrl+C`), reload the extension, switch to Chat, send a message. Expected:
- Red error bubble: "Sorry, something went wrong. Please try again."
- Send button re-enables

- [ ] **Step 6: Final commit (if any fixups were needed)**

```bash
git add chrome-extension/
git commit -m "fix: chatbox manual verification fixups"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Tab bar (Appointments | Chat) — Task 2
- ✅ `"tabs"` permission — Task 1
- ✅ Chat panel: message list + input row — Tasks 2 & 3
- ✅ Message + URL + title sent to `/api/chat` — Task 4
- ✅ Chat resets on popup close (in-memory only, no persistence) — Task 4
- ✅ Appointments panel and its three states unchanged — Task 4 (preserved verbatim)
- ✅ No new files created — all changes in 4 existing files

**Type consistency:** `switchTab`, `appendMessage`, `sendMessage` defined and called consistently throughout Task 4. `showState` signature unchanged from original.
