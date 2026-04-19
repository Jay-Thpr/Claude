const API_BASE = 'http://localhost:3000';

// ─── Danger modal ─────────────────────────────────────────────────────────────

function getAlertDismissKey(url) {
  return `alertDismissed:${url}`;
}

async function isAlertDismissed(url) {
  if (!url) return false;
  const cached = await chrome.storage.session.get(getAlertDismissKey(url)).catch(() => ({}));
  return Boolean(cached[getAlertDismissKey(url)]);
}

async function dismissAlertForPage(url) {
  if (!url) return;
  await chrome.storage.session.set({ [getAlertDismissKey(url)]: true }).catch(() => {});
}

function showSafeStepAlert({ tone, explanation, bullets }) {
  if (document.getElementById('safestep-overlay')) return;

  const isDanger = tone === 'danger';
  const accentColor = isDanger ? '#dc2626' : '#d97706';
  const bgColor = isDanger ? '#7f1d1d' : '#78350f';

  const overlay = document.createElement('div');
  overlay.id = 'safestep-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(0,0,0,0.72);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    animation: ss-fade-in 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes ss-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ss-slide-in { from { transform: translateY(-32px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes ss-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7), 0 24px 64px rgba(0,0,0,0.6); } 50% { box-shadow: 0 0 0 16px rgba(220,38,38,0), 0 24px 64px rgba(0,0,0,0.6); } }
    #safestep-card { animation: ss-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    #safestep-card.danger { animation: ss-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1), ss-pulse 1.8s ease-in-out 0.3s 3; }
    #safestep-dismiss:hover { background: rgba(255,255,255,0.2) !important; }
    #safestep-proceed:hover { opacity: 0.8; }
  `;
  document.head.appendChild(style);

  const bulletsHtml = bullets && bullets.length
    ? `<ul style="margin:16px 0 0 0;padding-left:24px;font-size:17px;line-height:1.9;opacity:0.95;font-weight:500;">
        ${bullets.map(b => `<li>${b}</li>`).join('')}
       </ul>`
    : '';

  overlay.innerHTML = `
    <div id="safestep-card" class="${isDanger ? 'danger' : ''}" style="
      background: ${bgColor};
      border: 4px solid ${accentColor};
      border-radius: 20px;
      padding: 40px 40px 32px;
      max-width: 560px;
      width: 92%;
      color: #fff;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    ">
      <div style="font-size: 72px; text-align: center; margin-bottom: 20px; line-height: 1;">🚨</div>
      <h2 style="font-size: 30px; font-weight: 900; text-align: center; margin: 0 0 16px; line-height: 1.25; letter-spacing: -0.5px;">
        STOP — This page is dangerous
      </h2>
      <p style="font-size: 19px; line-height: 1.65; margin: 0; opacity: 0.97; text-align: center; font-weight: 500;">
        ${explanation}
      </p>
      ${bulletsHtml}
      <button id="safestep-dismiss" style="
        display: block; width: 100%; margin-top: 32px;
        padding: 18px; font-size: 20px; font-weight: 800;
        background: #fff; color: ${accentColor};
        border: none; border-radius: 12px;
        cursor: pointer; font-family: inherit;
      ">✓ I understand — go back to safety</button>
      <button id="safestep-proceed" style="
        display: block; width: 100%; margin-top: 10px;
        padding: 12px; font-size: 15px; font-weight: 600;
        background: transparent; color: rgba(255,255,255,0.55);
        border: 1px solid rgba(255,255,255,0.25); border-radius: 10px;
        cursor: pointer; font-family: inherit;
      ">I know the risks — proceed anyway</button>
    </div>
  `;

  document.body.appendChild(overlay);

  if (window.speechSynthesis) {
    const msg = new SpeechSynthesisUtterance(
      isDanger
        ? 'Warning! This page looks dangerous. Do not enter any personal information.'
        : 'Caution. This page has warning signs. Please be careful.'
    );
    msg.rate = 0.88;
    msg.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  }

  const closeOverlay = async () => {
    await dismissAlertForPage(location.href);
    overlay.remove();
  };

  document.getElementById('safestep-dismiss').onclick = () => {
    void closeOverlay();
  };
  document.getElementById('safestep-proceed').onclick = () => {
    void closeOverlay();
  };
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      void closeOverlay();
    }
  });
}

// ─── Floating voice-chat widget (Shadow DOM for full isolation) ───────────────

let shadow = null;
let widgetOpen = false;
let widgetRecording = false;
let widgetRecognition = null;
let widgetIsSending = false;

const WIDGET_CSS = `
  :host {
    all: initial;
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: block !important;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  #fab {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #1a6fad;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(26,111,173,0.5), 0 2px 8px rgba(0,0,0,0.25);
    transition: transform 180ms ease, background 150ms ease;
    touch-action: manipulation;
  }
  #fab:hover { background: #155d94; transform: scale(1.08); }
  #fab:active { transform: scale(0.94); }
  #fab svg { width: 26px; height: 26px; stroke: #fff; fill: none; }

  @keyframes pulse-ring {
    0%   { box-shadow: 0 4px 20px rgba(220,38,38,0.5), 0 0 0 0 rgba(220,38,38,0.6); }
    70%  { box-shadow: 0 4px 20px rgba(220,38,38,0.5), 0 0 0 14px rgba(220,38,38,0); }
    100% { box-shadow: 0 4px 20px rgba(220,38,38,0.5), 0 0 0 0 rgba(220,38,38,0); }
  }
  #fab.recording { background: #dc2626 !important; animation: pulse-ring 1.2s ease-in-out infinite; }

  #panel {
    position: absolute;
    bottom: 66px;
    right: 0;
    width: 320px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(15,23,42,0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    animation: panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }
  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.85) translateY(16px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  #panel-header {
    background: #1a6fad;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
    flex-shrink: 0;
  }
  #panel-header svg { width: 15px; height: 15px; stroke: #fff; fill: none; flex-shrink: 0; }
  #panel-title { font-size: 15px; font-weight: 700; flex: 1; color: #fff; }
  #close-btn {
    background: none; border: none; color: rgba(255,255,255,0.75);
    cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 4px;
    border-radius: 6px;
  }
  #close-btn:hover { color: #fff; background: rgba(255,255,255,0.15); }

  #messages {
    flex: 1;
    max-height: 230px;
    min-height: 80px;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 7px;
    background: #f8fafc;
    scroll-behavior: smooth;
  }
  #messages::-webkit-scrollbar { width: 3px; }
  #messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

  .msg {
    max-width: 90%;
    padding: 8px 11px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
    color: #0a0f1e;
    border: 1px solid transparent;
  }
  .msg-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.55;
    margin-bottom: 3px;
    color: inherit;
  }
  .msg-user {
    align-self: flex-end;
    background: #1a6fad;
    color: #fff !important;
    border-color: #155d94;
    border-bottom-right-radius: 4px;
  }
  .msg-assistant {
    align-self: flex-start;
    background: #fff;
    border-color: #e2e8f0;
    border-bottom-left-radius: 4px;
  }
  .msg-error {
    align-self: flex-start;
    background: #fef2f2;
    color: #dc2626 !important;
    border-color: #fecaca;
    border-bottom-left-radius: 4px;
  }

  #input-row {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    background: #fff;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  #text-input {
    flex: 1;
    font-size: 14px;
    padding: 8px 11px;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    resize: none;
    font-family: inherit;
    line-height: 1.4;
    overflow: hidden;
    color: #0a0f1e;
    background: #f8fafc;
    min-height: 36px;
    transition: border-color 150ms;
  }
  #text-input:focus { outline: none; border-color: #1a6fad; }
  #text-input::placeholder { color: #94a3b8; }

  #mic-btn, #send-btn {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 10px;
    border: 1.5px solid #e2e8f0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms;
    touch-action: manipulation;
  }
  #mic-btn svg, #send-btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none; }

  #mic-btn { background: #f1f5f9; color: #1e3a5f; }
  #mic-btn:hover { background: #f0f7ff; border-color: #1a6fad; color: #1a6fad; }
  #mic-btn.recording { background: #dc2626 !important; border-color: #dc2626 !important; color: #fff !important; }
  #mic-btn:disabled { opacity: 0.35; cursor: not-allowed; }

  #send-btn { background: #1a6fad; border-color: #1a6fad; color: #fff; }
  #send-btn:hover { background: #155d94; border-color: #155d94; }
  #send-btn:disabled { background: #e2e8f0; border-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
`;

const WIDGET_HTML = `
  <button id="fab" aria-label="Open SafeStep voice assistant" title="SafeStep — Ask me anything">
    <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  </button>
`;

const PANEL_HTML = `
  <div id="panel">
    <div id="panel-header">
      <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span id="panel-title">SafeStep</span>
      <button id="close-btn" aria-label="Close">✕</button>
    </div>
    <div id="messages" aria-live="polite"></div>
    <div id="input-row">
      <textarea id="text-input" placeholder="Ask me anything…" rows="1"></textarea>
      <button id="mic-btn" aria-label="Speak">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      <button id="send-btn" aria-label="Send">
        <svg viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
    </div>
  </div>
`;

function createWidget() {
  if (document.getElementById('ss-widget-root')) return;

  const root = document.createElement('div');
  root.id = 'ss-widget-root';

  // Reset every inherited style so the host element is invisible to the page
  root.style.cssText = `
    all: initial;
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: block !important;
    width: 56px;
    height: 56px;
  `;

  shadow = root.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = WIDGET_CSS;
  shadow.appendChild(styleEl);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = WIDGET_HTML;
  shadow.appendChild(wrapper);

  document.documentElement.appendChild(root);

  shadow.getElementById('fab').addEventListener('click', togglePanel);
}

function togglePanel() {
  widgetOpen = !widgetOpen;

  const existing = shadow.getElementById('panel');
  if (!widgetOpen) {
    if (existing) existing.remove();
    return;
  }

  const panelWrapper = document.createElement('div');
  panelWrapper.innerHTML = PANEL_HTML;
  shadow.appendChild(panelWrapper.firstElementChild);

  const panel = shadow.getElementById('panel');
  const input = shadow.getElementById('text-input');

  shadow.getElementById('close-btn').addEventListener('click', togglePanel);
  shadow.getElementById('send-btn').addEventListener('click', widgetSend);
  shadow.getElementById('mic-btn').addEventListener('click', widgetToggleMic);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); widgetSend(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = shadow.getElementById('mic-btn');
  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = 'Voice input not available';
  } else if (!widgetRecognition) {
    widgetRecognition = new SpeechRecognition();
    widgetRecognition.lang = 'en-US';
    widgetRecognition.continuous = false;
    widgetRecognition.interimResults = false;
    widgetRecognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const inp = shadow.getElementById('text-input');
      if (inp) inp.value = transcript;
      widgetStopMic();
      widgetSend();
    };
    widgetRecognition.onerror = widgetStopMic;
    widgetRecognition.onend = widgetStopMic;
  }

  widgetAppend('Hi! I\'m SafeStep. Ask me if this page is safe, or anything else.', 'assistant');
  setTimeout(() => { if (input) input.focus(); }, 80);
  void panel;
}

function widgetAppend(text, role) {
  const list = shadow && shadow.getElementById('messages');
  if (!list) return;
  const el = document.createElement('div');
  el.className = `msg msg-${role}`;
  const label = role === 'user' ? 'You' : 'SafeStep';
  el.innerHTML = `<div class="msg-label">${label}</div><div>${escapeWidget(text)}</div>`;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

function escapeWidget(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function widgetSetBusy(busy) {
  if (!shadow) return;
  ['mic-btn', 'send-btn', 'text-input'].forEach(id => {
    const el = shadow.getElementById(id);
    if (el) el.disabled = busy;
  });
}

async function widgetSend() {
  if (widgetIsSending) return;
  const input = shadow && shadow.getElementById('text-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  widgetIsSending = true;
  widgetSetBusy(true);
  input.value = '';
  input.style.height = 'auto';
  widgetAppend(text, 'user');

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        url: location.href,
        pageTitle: document.title,
        visibleText: document.body?.innerText?.slice(0, 2000) || undefined,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.message || data.reply || 'I am here to help.';
    widgetAppend(reply, 'assistant');
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(reply);
      utt.rate = 0.88;
      window.speechSynthesis.speak(utt);
    }
  } catch {
    widgetAppend('Could not connect right now. Please try again.', 'error');
  } finally {
    widgetIsSending = false;
    widgetSetBusy(false);
    const inp = shadow && shadow.getElementById('text-input');
    if (inp) inp.focus();
  }
}

function widgetStartMic() {
  if (!widgetRecognition || widgetRecording) return;
  widgetRecording = true;
  const btn = shadow && shadow.getElementById('mic-btn');
  if (btn) btn.classList.add('recording');
  try { widgetRecognition.start(); } catch { widgetStopMic(); }
}

function widgetStopMic() {
  widgetRecording = false;
  const btn = shadow && shadow.getElementById('mic-btn');
  if (btn) btn.classList.remove('recording');
  try { widgetRecognition?.stop(); } catch { /* stopped */ }
}

function widgetToggleMic() {
  if (widgetRecording) widgetStopMic();
  else widgetStartMic();
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SAFESTEP_ALERT') {
    void (async () => {
      if (await isAlertDismissed(location.href)) return;
      showSafeStepAlert(msg);
    })();
  }
});

// ─── Send page content to background ─────────────────────────────────────────

chrome.runtime.sendMessage({
  type: 'PAGE_CONTENT',
  url: location.href,
  title: document.title,
  content: document.body?.innerText?.slice(0, 4000) || '',
});

// ─── Boot widget ──────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createWidget);
} else {
  createWidget();
}
