const API_BASE = 'http://localhost:3000';

// ─── Context (fetched once on open) ──────────────────────────────────────────

let pageUrl = '';
let pageTitle = '';
let pageContent = '';
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

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function appendMessage(text, role, tone, bullets) {
  const el = document.createElement('div');

  let bulletsHtml = '';
  if (bullets && bullets.length) {
    bulletsHtml = '<ul class="msg-bullets">' +
      bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') +
      '</ul>';
  }

  if (role === 'user') {
    el.className = 'msg msg-user';
    el.innerHTML = `<div class="msg-label">You</div><div>${escapeHtml(text)}</div>`;
  } else if (role === 'error') {
    el.className = 'msg msg-error';
    el.innerHTML = `<div class="msg-label">SafeStep</div><div>${escapeHtml(text)}</div>`;
  } else {
    el.className = 'msg msg-assistant';
    if (tone && tone !== 'neutral') el.dataset.tone = tone;
    el.innerHTML = `<div class="msg-label">SafeStep</div><div>${escapeHtml(text)}</div>${bulletsHtml}`;
  }

  const list = document.getElementById('chat-messages');
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

function getLastAssistantText() {
  const msgs = document.querySelectorAll('#chat-messages .msg-assistant');
  if (!msgs.length) return null;
  const last = msgs[msgs.length - 1];
  return last.querySelector('div:last-child')?.textContent || null;
}

function setActionButtonsDisabled(disabled) {
  ['btn-safe', 'btn-next', 'btn-memory', 'chat-send'].forEach(id => {
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
      body: JSON.stringify({ url: pageUrl, pageTitle, content: pageContent }),
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
        pageContent: pageContent || undefined,
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

function handleShowContent() {
  appendMessage('Show me the page text.', 'user');
  appendMessage(pageContent || '(no page text captured)', 'assistant', 'neutral');
}

async function triggerPageModal({ tone, explanation, bullets }) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SAFESTEP_ALERT', tone, explanation, bullets }).catch(() => {});
    }
  } catch { /* non-critical */ }
}

function showAlertBanner(tone, bullets) {
  const banner = document.getElementById('alert-banner');
  const title = document.getElementById('alert-title');
  const signalsList = document.getElementById('alert-signals');

  banner.className = `alert-banner tone-${tone}`;
  title.textContent = tone === 'danger'
    ? '🚨 This page looks dangerous — do not enter personal details'
    : '⚠️ This page has warning signs — proceed carefully';

  signalsList.innerHTML = '';
  if (bullets && bullets.length) {
    bullets.forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      signalsList.appendChild(li);
    });
  }

  document.getElementById('alert-details-btn').onclick = () => switchTab('chat');
}

async function autoAnalyzePage() {
  if (!pageContent && !pageUrl) return;

  // Cache per URL for the session — avoid re-calling on every popup open
  const cacheKey = `analysis:${pageUrl}`;
  const cached = await chrome.storage.session.get(cacheKey).catch(() => ({}));
  if (cached[cacheKey]) {
    const { explanation, tone, bullets } = cached[cacheKey];
    appendMessage(explanation, 'assistant', tone, bullets);
    if (tone === 'danger' || tone === 'warning') showAlertBanner(tone, bullets);
    if (tone === 'danger') {
      switchTab('chat');
      triggerPageModal({ tone, explanation, bullets });
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/scam-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: pageUrl, pageTitle, content: pageContent }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = deriveTone(data.classification || data.riskLevel);
    const bullets = Array.isArray(data.suspicious_signals) && data.suspicious_signals.length
      ? data.suspicious_signals : null;
    const explanation = data.explanation || 'I checked this page for you.';
    appendMessage(explanation, 'assistant', tone, bullets);
    if (tone === 'danger' || tone === 'warning') showAlertBanner(tone, bullets);
    if (tone === 'danger') {
      switchTab('chat');
      triggerPageModal({ tone, explanation, bullets });
    }
    chrome.storage.session.set({ [cacheKey]: { explanation, tone, bullets } }).catch(() => {});
  } catch {
    /* silent */
  }
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
  document.getElementById('btn-show-content').addEventListener('click', handleShowContent);

  // Chat input
  document.getElementById('chat-send').addEventListener('click', sendMessage);
  const chatInput = document.getElementById('chat-input');
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => autoResize(chatInput));

  // Fetch tab context + page content once
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    pageUrl = tab?.url || '';
    pageTitle = tab?.title || '';
    if (tab?.id) {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body?.innerText?.slice(0, 4000) || '',
      });
      pageContent = result || '';
    }
  } catch { /* non-critical */ }

  // Auto-analyze the current page
  void autoAnalyzePage();

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
