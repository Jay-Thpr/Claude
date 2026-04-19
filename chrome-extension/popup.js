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
