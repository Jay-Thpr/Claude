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

// ─── Right-side page prompt ──────────────────────────────────────────────────

function getPromptDismissKey(url) {
  return `pagePromptDismissed:${url}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function isPromptDismissed(url) {
  if (!url) return false;
  const cached = await chrome.storage.session.get(getPromptDismissKey(url)).catch(() => ({}));
  return Boolean(cached[getPromptDismissKey(url)]);
}

async function dismissPromptForPage(url) {
  if (!url) return;
  await chrome.storage.session.set({ [getPromptDismissKey(url)]: true }).catch(() => {});
}

function showSafeStepPrompt({ tone, title, nextStep, explanation, bullets, url }) {
  if (document.getElementById('safestep-page-prompt')) return;

  const accent = tone === 'danger' ? '#dc2626' : tone === 'warning' ? '#d97706' : '#1a6fad';
  const tint = tone === 'danger' ? '#fef2f2' : tone === 'warning' ? '#fffbeb' : '#f0f7ff';
  const badgedText = tone === 'danger'
    ? 'Careful'
    : tone === 'warning'
      ? 'Need a check'
      : 'Next step';

  if (!document.getElementById('safestep-page-prompt-style')) {
    const style = document.createElement('style');
    style.id = 'safestep-page-prompt-style';
    style.textContent = `
      @keyframes ss-slide-right {
        from { opacity: 0; transform: translateX(24px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const overlay = document.createElement('div');
  overlay.id = 'safestep-page-prompt';
  overlay.style.cssText = `
    position: fixed;
    top: 96px;
    right: 24px;
    z-index: 2147483646;
    width: min(390px, calc(100vw - 32px));
    pointer-events: none;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const bulletsHtml = bullets && bullets.length
    ? `<ul style="margin:14px 0 0;padding-left:20px;font-size:15px;line-height:1.65;color:#334155;">
        ${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>`
    : '';

  overlay.innerHTML = `
    <div style="
      pointer-events: auto;
      background: rgba(255,255,255,0.98);
      border: 1px solid rgba(148,163,184,0.24);
      border-left: 5px solid ${accent};
      border-radius: 22px;
      box-shadow: 0 18px 50px rgba(15,23,42,0.18);
      overflow: hidden;
      animation: ss-slide-right 220ms ease-out;
    ">
      <div style="
        padding: 14px 16px 12px;
        background: linear-gradient(180deg, ${tint}, rgba(255,255,255,0.96));
        border-bottom: 1px solid rgba(148,163,184,0.18);
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <span style="
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:5px 10px;
            border-radius:999px;
            font-size:12px;
            font-weight:700;
            color:${accent};
            background:${tint};
            border:1px solid rgba(148,163,184,0.18);
          ">SafeStep • ${badgedText}</span>
          <button id="safestep-page-prompt-close" style="
            border:none;
            background:transparent;
            color:#64748b;
            font-size:20px;
            line-height:1;
            cursor:pointer;
            padding:0;
          " aria-label="Dismiss this suggestion">×</button>
        </div>
        <h2 style="margin:0;color:#0f172a;font-size:22px;line-height:1.25;font-weight:900;letter-spacing:-0.3px;">
          ${escapeHtml(title)}
        </h2>
        <p style="margin:10px 0 0;color:#334155;font-size:16px;line-height:1.65;font-weight:500;">
          ${escapeHtml(explanation)}
        </p>
      </div>
      <div style="padding: 14px 16px 16px;">
        <div style="
          margin:0 0 10px;
          color:#0f172a;
          font-size:17px;
          line-height:1.55;
          font-weight:800;
        ">${escapeHtml(nextStep)}</div>
        ${bulletsHtml}
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button id="safestep-page-prompt-open" style="
            flex:1;
            min-height:46px;
            border:none;
            border-radius:14px;
            background:${accent};
            color:#fff;
            font-size:16px;
            font-weight:800;
            cursor:pointer;
            box-shadow:0 8px 20px rgba(26,111,173,0.18);
          ">Open SafeStep</button>
          <button id="safestep-page-prompt-hide" style="
            min-height:46px;
            padding:0 14px;
            border:1px solid rgba(148,163,184,0.28);
            border-radius:14px;
            background:#fff;
            color:#334155;
            font-size:15px;
            font-weight:700;
            cursor:pointer;
          ">Not now</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closePrompt = async () => {
    await dismissPromptForPage(url || location.href);
    overlay.remove();
  };

  document.getElementById('safestep-page-prompt-close').onclick = () => {
    void closePrompt();
  };
  document.getElementById('safestep-page-prompt-hide').onclick = () => {
    void closePrompt();
  };
  document.getElementById('safestep-page-prompt-open').onclick = () => {
    if (!shadow) {
      createWidget();
    }
    togglePanel();
    void closePrompt();
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      void closePrompt();
    }
  });

  if (window.speechSynthesis) {
    const msg = new SpeechSynthesisUtterance(nextStep || explanation || title || 'SafeStep has a suggestion for you.');
    msg.rate = 0.9;
    msg.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  }
}

// ─── Floating widget shell ───────────────────────────────────────────────────

let shadow = null;
let widgetOpen = false;
const popupUrl = chrome.runtime.getURL('popup.html');

const WIDGET_CSS = `
  :host {
    all: initial;
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: block !important;
    overflow: visible !important;
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

  #panel {
    position: absolute;
    bottom: 72px;
    right: 0;
    width: min(92vw, 380px);
    height: min(92vh, 560px);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.2);
    background: transparent;
    transform-origin: bottom right;
    animation: panel-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes panel-in {
    from { opacity: 0; transform: scale(0.92) translateY(12px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  #panel iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: transparent;
  }
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

function createWidget() {
  if (document.getElementById('ss-widget-root')) return;

  const root = document.createElement('div');
  root.id = 'ss-widget-root';
  root.style.cssText = `
    all: initial;
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 2147483647 !important;
    display: block !important;
    overflow: visible !important;
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

  shadow.getElementById('fab').addEventListener('click', () => void handleFabClick());
}

// ─── Demo flow ────────────────────────────────────────────────────────────────

async function handleFabClick() {
  const stored = await chrome.storage.local.get('safestep_demo_done').catch(() => ({}));
  if (!stored.safestep_demo_done) {
    togglePanel();
    showDemoGreeting();
  } else {
    togglePanel();
  }
}

function showDemoGreeting() {
  if (document.getElementById('ss-demo-card')) return;

  if (!document.getElementById('ss-demo-anim')) {
    const s = document.createElement('style');
    s.id = 'ss-demo-anim';
    s.textContent = `
      @keyframes ss-demo-in { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
    `;
    document.head.appendChild(s);
  }

  const card = document.createElement('div');
  card.id = 'ss-demo-card';
  card.style.cssText = `
    position: fixed; top: 96px; right: 24px; z-index: 2147483646;
    width: min(370px, calc(100vw - 32px));
    font-family: system-ui, -apple-system, sans-serif;
    animation: ss-demo-in 220ms ease-out;
  `;

  card.innerHTML = `
    <div style="background:#fff;border:1px solid rgba(148,163,184,0.24);border-left:5px solid #1a6fad;
      border-radius:22px;box-shadow:0 18px 50px rgba(15,23,42,0.18);overflow:hidden;">
      <div style="padding:14px 16px 12px;background:linear-gradient(180deg,#f0f7ff,#fff);
        border-bottom:1px solid rgba(148,163,184,0.15);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:12px;font-weight:700;color:#1a6fad;padding:4px 10px;
            border-radius:999px;background:#f0f7ff;border:1px solid rgba(26,111,173,0.2);">
            SafeStep
          </span>
          <button id="ss-demo-close" style="border:none;background:transparent;color:#94a3b8;
            font-size:20px;line-height:1;cursor:pointer;padding:2px 4px;">×</button>
        </div>
        <h2 style="margin:0;font-size:20px;font-weight:900;color:#0f172a;line-height:1.3;">
          Hi Jay! Happy Sunday 👋
        </h2>
        <p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:#334155;font-weight:500;">
          It looks like it's time for your routine CVS ordering.
          I can add your usual health items to the cart automatically.
        </p>
      </div>
      <div style="padding:12px 16px 16px;">
        <div id="ss-demo-status" style="display:none;font-size:14px;color:#1a6fad;
          font-weight:600;margin-bottom:10px;"></div>
        <div style="display:flex;gap:10px;">
          <button id="ss-demo-start" style="flex:1;min-height:44px;border:none;border-radius:14px;
            background:#1a6fad;color:#fff;font-size:15px;font-weight:800;cursor:pointer;
            box-shadow:0 6px 16px rgba(26,111,173,0.25);">
            Add items to cart →
          </button>
          <button id="ss-demo-skip" style="min-height:44px;padding:0 14px;border:1px solid #e2e8f0;
            border-radius:14px;background:#fff;color:#64748b;font-size:14px;font-weight:600;cursor:pointer;">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(card);

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(
      "Hi Jay! It's Sunday and it's time for your routine CVS ordering. I can add your usual health items to the cart right now."
    );
    utt.rate = 0.88;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }

  document.getElementById('ss-demo-close').onclick = () => card.remove();
  document.getElementById('ss-demo-skip').onclick = () => card.remove();
  document.getElementById('ss-demo-start').onclick = () => void runDemoCVS(card);
}

async function runDemoCVS(card) {
  const startBtn = document.getElementById('ss-demo-start');
  const skipBtn = document.getElementById('ss-demo-skip');
  const statusEl = document.getElementById('ss-demo-status');

  if (startBtn) startBtn.disabled = true;
  if (skipBtn) skipBtn.disabled = true;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ Adding your items to the cart…';
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(
      "Got it! I'm adding your multivitamin, blood pressure monitor, and bandages to your CVS cart now."
    );
    utt.rate = 0.88;
    window.speechSynthesis.speak(utt);
  }

  try {
    const res = await fetch(`${API_BASE}/api/demo/cvs`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      if (statusEl) statusEl.textContent = '✅ 3 items added to your cart.';

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(
          "Done! Your cart is ready. Now let's check your calendar for tomorrow."
        );
        utt.rate = 0.88;
        window.speechSynthesis.speak(utt);
      }

      await chrome.storage.local.set({ safestep_demo_done: true }).catch(() => {});

      // Swap buttons to show calendar navigation
      const btnRow = startBtn?.parentElement;
      if (btnRow) {
        btnRow.innerHTML = `
          <button id="ss-demo-cal" style="flex:1;min-height:44px;border:none;border-radius:14px;
            background:#1a6fad;color:#fff;font-size:15px;font-weight:800;cursor:pointer;
            box-shadow:0 6px 16px rgba(26,111,173,0.25);">
            View my calendar →
          </button>
        `;
        document.getElementById('ss-demo-cal').onclick = () => {
          card.remove();
          window.location.href = 'https://calendar.google.com';
        };
      }
    } else {
      const msg = data.error || 'Browser agent is not running. Start the Python backend on port 8000.';
      if (statusEl) statusEl.textContent = `⚠️ ${msg}`;
      if (startBtn) startBtn.disabled = false;
      if (skipBtn) skipBtn.disabled = false;
    }
  } catch {
    if (statusEl) statusEl.textContent = '⚠️ Could not reach the server. Is the dev server running?';
    if (startBtn) startBtn.disabled = false;
    if (skipBtn) skipBtn.disabled = false;
  }
}

function togglePanel() {
  widgetOpen = !widgetOpen;

  const existing = shadow?.getElementById('panel');
  if (!widgetOpen) {
    existing?.remove();
    return;
  }

  if (existing) {
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'panel';
  panel.innerHTML = `
    <iframe
      title="SafeStep"
      src="${popupUrl}"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  `;
  shadow.appendChild(panel);
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SAFESTEP_ALERT') {
    void (async () => {
      if (await isAlertDismissed(location.href)) return;
      showSafeStepAlert(msg);
    })();
  }

  if (msg.type === 'SAFESTEP_PAGE_PROMPT') {
    void (async () => {
      if (await isPromptDismissed(msg.url || location.href)) return;
      showSafeStepPrompt(msg);
    })();
  }
});

// ─── Send page content to background ─────────────────────────────────────────

let lastPageSignature = '';
let lastKnownUrl = location.href;
let navigationHooksInstalled = false;

function collectPageContext() {
  return {
    url: location.href,
    title: document.title,
    content: document.body?.innerText?.slice(0, 4000) || '',
  };
}

function sendPageContext(force = false) {
  const context = collectPageContext();
  const signature = `${context.url}|${context.title}|${context.content.slice(0, 1200)}`;
  if (!force && signature === lastPageSignature) {
    return;
  }

  lastPageSignature = signature;
  lastKnownUrl = context.url;
  chrome.runtime.sendMessage({
    type: 'PAGE_CONTENT',
    ...context,
  });
}

function installNavigationHooks() {
  if (navigationHooksInstalled) {
    return;
  }
  navigationHooksInstalled = true;

  const scheduleSend = () => {
    window.setTimeout(() => {
      sendPageContext(true);
    }, 0);
  };

  const wrapHistoryMethod = (method) => {
    const original = history[method];
    if (typeof original !== 'function') {
      return;
    }

    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleSend();
      return result;
    };
  };

  wrapHistoryMethod('pushState');
  wrapHistoryMethod('replaceState');
  window.addEventListener('popstate', scheduleSend);
  window.addEventListener('hashchange', scheduleSend);

  window.setInterval(() => {
    if (location.href !== lastKnownUrl) {
      lastKnownUrl = location.href;
      sendPageContext(true);
    }
  }, 1000);
}

installNavigationHooks();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sendPageContext(true), { once: true });
  window.addEventListener('load', () => sendPageContext(true), { once: true });
} else {
  sendPageContext(true);
}

// ─── Boot widget ──────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createWidget);
} else {
  createWidget();
}
