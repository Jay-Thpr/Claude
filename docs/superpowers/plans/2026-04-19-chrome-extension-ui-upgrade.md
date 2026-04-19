# Chrome Extension UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the SafeStep Chrome extension popup to match the webapp's visual style and add quick-action buttons (scam check, next-step, memory, repeat) with tone-colored chat bubbles.

**Architecture:** Three files only — `popup.css` gets CSS variables and new component styles, `popup.html` gets the action button row and updated structure, `popup.js` gets tab/memory context fetched on open plus action button handlers and tone detection. No new files, no external dependencies.

**Tech Stack:** Vanilla HTML/CSS/JS, Chrome Extensions MV3, existing localhost:3000 API endpoints.

---

### Task 1: Add CSS variables and spinner to popup.css

**Files:**
- Modify: `chrome-extension/popup.css`

- [ ] **Step 1: Replace the top of popup.css with CSS variables block**

Open `chrome-extension/popup.css`. Replace the existing `*, *::before, *::after` block and `body` rule with:

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

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

body {
  width: 380px;
  min-height: 400px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-primary);
  background: #fff;
}
```

- [ ] **Step 2: Add spinner keyframe and class after the body rule**

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 48px auto 0;
  display: block;
}
```

- [ ] **Step 3: Update .loading-text to use a centered layout**

Replace the existing `.loading-text` rule:

```css
.loading-text {
  font-size: 17px;
  color: var(--text-muted);
  text-align: center;
  margin-top: 16px;
}
```

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "style: add CSS variables and spinner to extension"
```

---

### Task 2: Upgrade Appointments tab card styles

**Files:**
- Modify: `chrome-extension/popup.css`

- [ ] **Step 1: Replace .card, .section-label, .appt-*, .prep, .error-* rules**

Find and replace all existing rules for `.section-label`, `.card`, `.appt-title`, `.appt-when`, `.appt-location`, `.prep`, `.prep-text`, `.error-text`, `.error-sub` with:

```css
.section-label {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--primary);
  margin-bottom: 8px;
}

.card {
  background: var(--primary-light);
  border-left: 4px solid var(--primary);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  margin-bottom: 16px;
}

.appt-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.appt-when {
  font-size: 17px;
  color: #333;
}

.appt-location {
  font-size: 15px;
  color: var(--text-muted);
  margin-top: 4px;
}

.prep {
  background: var(--warning-bg);
  border-left: 4px solid var(--warning);
  border-radius: var(--radius-card);
  padding: 12px 16px;
}

.prep-text {
  font-size: 16px;
  color: #333;
  line-height: 1.7;
}

.error-text {
  font-size: 19px;
  font-weight: 600;
  color: var(--danger);
  text-align: center;
  margin-top: 40px;
  margin-bottom: 8px;
}

.error-sub {
  font-size: 15px;
  color: var(--text-muted);
  text-align: center;
}

.empty-text {
  font-size: 17px;
  color: var(--text-muted);
  text-align: center;
  padding: 32px 16px;
}
```

- [ ] **Step 2: Add padding to the appointments panel**

After the `.panel { display: block; }` rule add:

```css
#panel-appointments {
  padding: 16px;
  min-height: 300px;
}
```

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "style: upgrade appointments tab card styles"
```

---

### Task 3: Add action button styles to popup.css

**Files:**
- Modify: `chrome-extension/popup.css`

- [ ] **Step 1: Add action button row and button styles**

Append to the end of `popup.css`:

```css
/* Quick action buttons */
.action-row {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  background: #fff;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  line-height: 1.2;
  transition: border-color 0.15s, background 0.15s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-light);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-btn .btn-icon {
  font-size: 18px;
  line-height: 1;
}

.action-btn .btn-label {
  font-size: 11px;
  text-align: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "style: add quick action button styles"
```

---

### Task 4: Add tone-colored bubble styles and upgrade chat styles

**Files:**
- Modify: `chrome-extension/popup.css`

- [ ] **Step 1: Replace existing .msg-* and chat-related rules**

Find and replace all existing `.msg`, `.msg-user`, `.msg-assistant`, `.msg-error`, `.chat-input-row`, `.chat-input`, `.chat-send-btn` rules with:

```css
/* Chat messages */
.msg {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: var(--radius-bubble);
  font-size: 16px;
  line-height: 1.55;
  border: 1.5px solid transparent;
}

.msg-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 4px;
  color: var(--text-muted);
}

.msg-user {
  align-self: flex-end;
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  border-bottom-right-radius: 4px;
}

.msg-user .msg-label {
  color: rgba(255,255,255,0.75);
}

/* Tone variants for assistant bubbles */
.msg-assistant {
  align-self: flex-start;
  background: #f5f5f5;
  border-color: var(--border);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.msg-assistant[data-tone="safe"] {
  background: var(--safe-bg);
  border-color: var(--safe);
}

.msg-assistant[data-tone="warning"] {
  background: var(--warning-bg);
  border-color: var(--warning);
}

.msg-assistant[data-tone="danger"] {
  background: var(--danger-bg);
  border-color: var(--danger);
}

.msg-error {
  align-self: flex-start;
  background: var(--danger-bg);
  border-color: var(--danger);
  color: var(--danger);
  border-bottom-left-radius: 4px;
}

/* Chat input */
.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: #fff;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  font-size: 16px;
  padding: 9px 12px;
  border: 2px solid var(--border);
  border-radius: 10px;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
  overflow: hidden;
  transition: border-color 0.15s;
}

.chat-input:focus {
  outline: none;
  border-color: var(--primary);
}

.chat-send-btn {
  width: 40px;
  height: 40px;
  align-self: flex-end;
  background: var(--primary);
  color: #fff;
  font-size: 18px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}

.chat-send-btn:hover:not(:disabled) {
  background: #155d94;
}

.chat-send-btn:disabled {
  background: #aaa;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Update chat panel height**

Find the existing `#panel-chat` rule and replace it:

```css
#panel-chat {
  display: flex;
  flex-direction: column;
  height: 480px;
}
```

- [ ] **Step 3: Commit**

```bash
git add chrome-extension/popup.css
git commit -m "style: tone-colored bubbles and upgraded chat styles"
```

---

### Task 5: Update popup.html structure

**Files:**
- Modify: `chrome-extension/popup.html`

- [ ] **Step 1: Replace the entire popup.html body content**

Replace the full contents of `chrome-extension/popup.html` with:

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

  <!-- Appointments panel -->
  <div id="panel-appointments" class="panel">
    <div id="state-loading" class="state" role="status">
      <div class="spinner"></div>
      <p class="loading-text">Getting your appointments…</p>
    </div>

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

    <div id="state-empty" class="state hidden">
      <p class="empty-text">No upcoming appointments found.</p>
    </div>

    <div id="state-error" class="state hidden">
      <p class="error-text">Could not load appointments.</p>
      <p class="error-sub">Make sure the app is running at localhost:3000.</p>
    </div>
  </div>

  <!-- Chat panel -->
  <div id="panel-chat" class="panel hidden">
    <!-- Quick action buttons -->
    <div class="action-row">
      <button class="action-btn" id="btn-safe" title="Is this safe?">
        <span class="btn-icon">🛡️</span>
        <span class="btn-label">Is this safe?</span>
      </button>
      <button class="action-btn" id="btn-next" title="What do I do next?">
        <span class="btn-icon">👉</span>
        <span class="btn-label">What's next?</span>
      </button>
      <button class="action-btn" id="btn-memory" title="What was I doing?">
        <span class="btn-icon">🧠</span>
        <span class="btn-label">What was I doing?</span>
      </button>
      <button class="action-btn" id="btn-repeat" title="Say that again">
        <span class="btn-icon">🔄</span>
        <span class="btn-label">Repeat</span>
      </button>
    </div>

    <div id="chat-messages" class="chat-messages"></div>

    <div class="chat-input-row">
      <textarea id="chat-input" class="chat-input" placeholder="Ask me anything…" rows="1"></textarea>
      <button id="chat-send" class="chat-send-btn" aria-label="Send">→</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.html
git commit -m "feat: update extension HTML with action buttons and spinner"
```

---

### Task 6: Rewrite popup.js with full feature set

**Files:**
- Modify: `chrome-extension/popup.js`

- [ ] **Step 1: Replace entire popup.js with the upgraded version**

Replace the full contents of `chrome-extension/popup.js` with:

```js
const API_BASE = 'http://localhost:3000';

// ─── Context (fetched once on open) ──────────────────────────────────────────

let pageUrl = '';
let pageTitle = '';
let taskMemory = null;
let isSending = false;

// ─── Tone detection ───────────────────────────────────────────────────────────

function deriveTone(value) {
  if (!value) return 'neutral';
  if (/safe|ready|ok/i.test(value)) return 'safe';
  if (/warning|careful|not sure/i.test(value)) return 'warning';
  if (/risky|danger|stop/i.test(value)) return 'danger';
  return 'neutral';
}

// ─── State helpers ────────────────────────────────────────────────────────────

function showState(id) {
  ['state-loading', 'state-loaded', 'state-empty', 'state-error'].forEach(s => {
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
    showState('state-empty');
    return;
  }

  document.getElementById('appt-summary').textContent = appt.summary || 'Appointment';

  const when = [appt.whenLabel, appt.timeLabel].filter(Boolean).join(' at ');
  document.getElementById('appt-when').textContent = when;

  const locationEl = document.getElementById('appt-location');
  if (appt.location) {
    locationEl.textContent = '📍 ' + appt.location;
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

// ─── Chat helpers ─────────────────────────────────────────────────────────────

function appendMessage(text, role, tone) {
  const el = document.createElement('div');

  if (role === 'user') {
    el.className = 'msg msg-user';
    el.innerHTML = `<div class="msg-label">You</div><div>${escapeHtml(text)}</div>`;
  } else if (role === 'error') {
    el.className = 'msg msg-error';
    el.innerHTML = `<div class="msg-label">SafeStep</div><div>${escapeHtml(text)}</div>`;
  } else {
    el.className = 'msg msg-assistant';
    if (tone && tone !== 'neutral') el.dataset.tone = tone;
    el.innerHTML = `<div class="msg-label">SafeStep</div><div>${escapeHtml(text)}</div>`;
  }

  const list = document.getElementById('chat-messages');
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getLastAssistantText() {
  const msgs = document.querySelectorAll('#chat-messages .msg-assistant');
  if (!msgs.length) return null;
  const last = msgs[msgs.length - 1];
  return last.querySelector('div:last-child')?.textContent || null;
}

function setActionButtonsDisabled(disabled) {
  ['btn-safe', 'btn-next', 'btn-memory', 'btn-repeat', 'chat-send'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  });
  document.getElementById('chat-input').disabled = disabled;
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleSafe() {
  if (isSending) return;
  isSending = true;
  setActionButtonsDisabled(true);
  appendMessage('Is this safe?', 'user');

  try {
    const res = await fetch(`${API_BASE}/api/scam-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl, pageTitle, content: '' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = deriveTone(data.classification || data.riskLevel);
    appendMessage(data.explanation || data.message || 'I checked this page for you.', 'assistant', tone);
  } catch {
    appendMessage('Could not check this page right now. If unsure, it is safer to wait.', 'error');
  } finally {
    isSending = false;
    setActionButtonsDisabled(false);
  }
}

async function handleNext() {
  if (isSending) return;
  isSending = true;
  setActionButtonsDisabled(true);
  appendMessage('What do I do next?', 'user');

  try {
    const res = await fetch(`${API_BASE}/api/next-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: pageUrl,
        pageTitle,
        question: 'What do I do next?',
        taskMemory: taskMemory || undefined,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = deriveTone(data.riskLevel);
    appendMessage(data.message || data.explanation || data.next_step || 'I am ready to help.', 'assistant', tone);
  } catch {
    appendMessage('Could not connect right now. Please try again.', 'error');
  } finally {
    isSending = false;
    setActionButtonsDisabled(false);
  }
}

function handleMemory() {
  if (isSending) return;
  appendMessage('What was I doing?', 'user');

  const data = taskMemory;
  const parts = [
    data?.current_task ? `You were working on: ${data.current_task}.` : null,
    data?.current_stage_title ? `Current stage: ${data.current_stage_title}.` : null,
    data?.next_stage_title ? `Next stage: ${data.next_stage_title}.` : null,
    `Your last step was: ${data?.last_step || 'just getting started'}.`,
  ].filter(Boolean);

  appendMessage(
    parts.length
      ? parts.join(' ')
      : 'I do not have any saved tasks yet. Start browsing and I will keep track for you.',
    'assistant',
    'neutral'
  );
}

function handleRepeat() {
  const text = getLastAssistantText();
  if (!text) return;
  appendMessage('Say that again.', 'user');
  appendMessage(text, 'assistant', 'neutral');
}

async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  isSending = true;
  setActionButtonsDisabled(true);
  input.value = '';
  input.style.height = 'auto';
  appendMessage(text, 'user');

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, url: pageUrl, pageTitle }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = deriveTone(data.riskLevel);
    appendMessage(data.message || data.reply || 'I am here to help.', 'assistant', tone);
  } catch {
    appendMessage('Something went wrong. Please try again.', 'error');
  } finally {
    isSending = false;
    setActionButtonsDisabled(false);
    input.focus();
  }
}

// ─── Auto-resize textarea ─────────────────────────────────────────────────────

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Tab switching
  document.getElementById('tab-appointments').addEventListener('click', () => switchTab('appointments'));
  document.getElementById('tab-chat').addEventListener('click', () => switchTab('chat'));

  // Action buttons
  document.getElementById('btn-safe').addEventListener('click', handleSafe);
  document.getElementById('btn-next').addEventListener('click', handleNext);
  document.getElementById('btn-memory').addEventListener('click', handleMemory);
  document.getElementById('btn-repeat').addEventListener('click', handleRepeat);

  // Chat input
  document.getElementById('chat-send').addEventListener('click', sendMessage);
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => autoResize(chatInput));

  // Fetch tab context once
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    pageUrl = tab?.url || '';
    pageTitle = tab?.title || '';
  } catch { /* non-critical */ }

  // Fetch task memory silently
  fetch(`${API_BASE}/api/memory`)
    .then(r => r.json())
    .then(d => { taskMemory = d; })
    .catch(() => {});

  // Load appointments
  showState('state-loading');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  fetch(`${API_BASE}/api/appointments`, { signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => renderAppointment(data))
    .catch(() => showState('state-error'))
    .finally(() => clearTimeout(timer));
});
```

- [ ] **Step 2: Commit**

```bash
git add chrome-extension/popup.js
git commit -m "feat: upgrade extension JS with action buttons, tone detection, and context fetch"
```

---

### Task 7: Manual verification in Chrome

**Files:** None

- [ ] **Step 1: Load the extension in Chrome**

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" → select `chrome-extension/` folder
4. If already loaded, click the ↺ refresh button on the extension card

- [ ] **Step 2: Verify Appointments tab**

Click the SafeStep extension icon.
- Spinner should show briefly while loading
- Card should render with blue left-border and `#f0f7ff` background
- Prep advice (if present) should show amber left-border block
- If no appointments: "No upcoming appointments found." in muted text

- [ ] **Step 3: Verify Chat tab quick actions**

Switch to the Chat tab.
- Four action buttons visible in a row: 🛡️ Is this safe? / 👉 What's next? / 🧠 What was I doing? / 🔄 Repeat
- All buttons disabled while a request is in flight
- Click "Is this safe?" → user bubble appears right-aligned in primary blue, response bubble appears with correct tone color
- Click "Repeat" → last assistant message re-appears with "Say that again." user bubble, no API call made

- [ ] **Step 4: Verify tone colors**

If the API is not running, check CSS in DevTools:
- Add `data-tone="safe"` to a `.msg-assistant` element → background should be `#f0fdf4`, border `#16a34a`
- Add `data-tone="warning"` → `#fffbeb`, border `#d97706`
- Add `data-tone="danger"` → `#fef2f2`, border `#dc2626`

- [ ] **Step 5: Verify textarea auto-resize**

Type multiple lines in the chat input — textarea should expand up to ~4 lines then stop growing.

- [ ] **Step 6: Final commit if any fixes made**

```bash
git add chrome-extension/
git commit -m "fix: extension manual verification fixes"
```
