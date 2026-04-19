# SafeStep Chrome Extension — Chatbox Tab Design Spec
Date: 2026-04-19

## Overview

Add a two-tab layout to the existing SafeStep Chrome extension popup. Tab 1: Appointments (existing). Tab 2: Chat — a senior-friendly message interface that sends user messages to `/api/chat` along with the current tab's URL and title.

## Scope

- Tab bar (Appointments | Chat) added below the SafeStep header
- Chat panel: scrollable message list + pinned input row
- Chat resets each time the popup is opened (no persistence)
- Message + current tab URL + page title sent to `/api/chat`
- No content script, no DOM injection, no new files

## Files Changed

| File | Change |
|---|---|
| `chrome-extension/manifest.json` | Add `"permissions": ["tabs"]` |
| `chrome-extension/popup.html` | Add tab bar + chat panel HTML |
| `chrome-extension/popup.css` | Add tab bar + chat bubble styles |
| `chrome-extension/popup.js` | Add tab switching + chat send logic |

## manifest.json

Add `"permissions": ["tabs"]` to enable `chrome.tabs.query`.

## popup.html Changes

### Tab bar (between `<header>` and `<main>`)

```html
<nav class="tab-bar">
  <button id="tab-appointments" class="tab active">Appointments</button>
  <button id="tab-chat" class="tab">Chat</button>
</nav>
```

### Wrap existing `<main>` content in panel div

```html
<div id="panel-appointments" class="panel">
  <!-- existing loading/loaded/error states unchanged -->
</div>
```

### New chat panel (sibling to panel-appointments)

```html
<div id="panel-chat" class="panel hidden">
  <div id="chat-messages" class="chat-messages"></div>
  <div class="chat-input-row">
    <textarea id="chat-input" class="chat-input" placeholder="Ask me anything…" rows="1"></textarea>
    <button id="chat-send" class="chat-send-btn">Send</button>
  </div>
</div>
```

## popup.css Changes

### Tab bar styles

```css
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
}

.tab.active {
  color: #1a6fad;
  border-bottom-color: #1a6fad;
}
```

### Panel visibility

```css
.panel { display: block; }
/* .hidden already defined as display: none */
```

### Chat panel styles

```css
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

## popup.js Changes

### Tab switching

```js
function switchTab(tab) {
  document.getElementById('panel-appointments').classList.toggle('hidden', tab !== 'appointments');
  document.getElementById('panel-chat').classList.toggle('hidden', tab !== 'chat');
  document.getElementById('tab-appointments').classList.toggle('active', tab === 'appointments');
  document.getElementById('tab-chat').classList.toggle('active', tab === 'chat');
}
```

Wire up in DOMContentLoaded:
```js
document.getElementById('tab-appointments').addEventListener('click', () => switchTab('appointments'));
document.getElementById('tab-chat').addEventListener('click', () => switchTab('chat'));
```

### Chat send logic

```js
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
  } catch {
    appendMessage('Sorry, something went wrong. Please try again.', 'error');
  } finally {
    btn.textContent = 'Send';
    btn.disabled = false;
    input.focus();
  }
}
```

Wire up:
```js
document.getElementById('chat-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
```

## API Contract

**Endpoint:** `POST http://localhost:3000/api/chat`

**Request:**
```json
{ "message": "string", "url": "string|undefined", "pageTitle": "string|undefined" }
```

**Response field used:** `data.message` (string). Fallback: `data.reply`. Last resort: `JSON.stringify(data)`.

## What This Does NOT Change

- Appointments panel and its three states are untouched
- No content script added
- No new HTML/JS/CSS files created
- Chat history is in-memory only, resets on popup close
