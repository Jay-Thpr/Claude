const API_BASE = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function applyBadge(tone) {
  if (tone === 'danger') {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else if (tone === 'warning') {
    chrome.action.setBadgeText({ text: '?' });
    chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ---------------------------------------------------------------------------
// Memory helpers (chrome.storage.local — survives restarts)
// ---------------------------------------------------------------------------

async function loadLocalMemory() {
  try {
    const result = await chrome.storage.local.get('safestep_memory');
    return result.safestep_memory || {};
  } catch {
    return {};
  }
}

async function saveLocalMemory(update) {
  try {
    const existing = await loadLocalMemory();
    const merged = { ...existing, ...update };
    await chrome.storage.local.set({ safestep_memory: merged });
  } catch {
    // Never crash
  }
}

// ---------------------------------------------------------------------------
// GCal polling
// ---------------------------------------------------------------------------

async function pollGCal() {
  try {
    const res = await fetch(`${API_BASE}/api/gcal/upcoming`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const appointments = Array.isArray(data.appointments) ? data.appointments : [];
    await chrome.storage.local.set({
      safestep_appointments: { appointments, lastFetched: Date.now() },
    });

    // Find upcoming appointments within 2 hours
    const soon = appointments.filter(
      (appt) => typeof appt.minutesUntil === 'number' && appt.minutesUntil <= 120
    );

    if (soon.length === 0) return;

    // Send reminders to the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    for (const appt of soon) {
      const announcement =
        appt.announcement ||
        `Reminder: "${appt.summary}" is coming up in ${appt.minutesUntil} minutes.`;
      chrome.tabs
        .sendMessage(tab.id, {
          type: 'SAFESTEP_REMIND',
          announcement,
          appointment: {
            summary: appt.summary,
            whenLabel: appt.whenLabel,
            timeLabel: appt.timeLabel,
            minutesUntil: appt.minutesUntil,
          },
        })
        .catch(() => {});
    }
  } catch {
    // Never crash
  }
}

// ---------------------------------------------------------------------------
// Per-tab orientation (replaces scam-check)
// ---------------------------------------------------------------------------

async function orientTab(tabId, url, pageTitle, pageText) {
  if (
    !url ||
    url.startsWith('chrome') ||
    url.startsWith('about') ||
    url.startsWith('extension')
  )
    return;

  const cacheKey = `orient:${url}`;
  const TEN_MINUTES = 10 * 60 * 1000;

  try {
    // Check session cache first
    const cached = await chrome.storage.session.get(cacheKey).catch(() => ({}));
    if (cached[cacheKey]) {
      const entry = cached[cacheKey];
      if (Date.now() - entry.cachedAt < TEN_MINUTES) {
        applyBadge(entry.safetyTone);
        if (entry.autoOpen) {
          chrome.tabs
            .sendMessage(tabId, {
              type: 'SAFESTEP_AUTO_OPEN',
              greeting: entry.greeting,
              suggestedActions: entry.suggestedActions,
              safetyTone: entry.safetyTone,
            })
            .catch(() => {});
        }
        if (entry.safetyTone === 'danger') {
          chrome.tabs
            .sendMessage(tabId, {
              type: 'SAFESTEP_ALERT',
              tone: entry.safetyTone,
              explanation: entry.explanation,
              bullets: entry.bullets,
            })
            .catch(() => {});
        }
        return;
      }
    }

    // Load persistent task memory to provide context
    const taskMemory = await loadLocalMemory();

    const res = await fetch(`${API_BASE}/api/orient`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url, pageTitle, pageText, taskMemory }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const safetyTone = data.safetyTone || 'safe';
    const greeting = data.greeting || '';
    const suggestedActions = Array.isArray(data.suggestedActions)
      ? data.suggestedActions
      : [];
    const autoOpen = !!data.autoOpen;
    const explanation = data.explanation || '';
    const bullets = Array.isArray(data.bullets) ? data.bullets : null;

    // Cache in session storage
    await chrome.storage.session
      .set({
        [cacheKey]: {
          safetyTone,
          greeting,
          suggestedActions,
          autoOpen,
          explanation,
          bullets,
          cachedAt: Date.now(),
        },
      })
      .catch(() => {});

    applyBadge(safetyTone);

    if (autoOpen) {
      chrome.tabs
        .sendMessage(tabId, {
          type: 'SAFESTEP_AUTO_OPEN',
          greeting,
          suggestedActions,
          safetyTone,
        })
        .catch(() => {});
    }

    if (safetyTone === 'danger') {
      chrome.tabs
        .sendMessage(tabId, {
          type: 'SAFESTEP_ALERT',
          tone: safetyTone,
          explanation,
          bullets,
        })
        .catch(() => {});
    }
  } catch {
    applyBadge('neutral');
  }
}

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'PAGE_CONTENT' && sender.tab?.id) {
    orientTab(sender.tab.id, msg.url, msg.title, msg.content);
  }

  if (msg.type === 'MEMORY_UPDATE' && msg.data) {
    saveLocalMemory(msg.data);
  }
});

// ---------------------------------------------------------------------------
// GCal alarm
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'gcal-poll') {
    await pollGCal();
  }
});

// ---------------------------------------------------------------------------
// Install / startup
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  // Create repeating alarm — fires every 30 minutes
  chrome.alarms.create('gcal-poll', { periodInMinutes: 30 });
  // Run immediately on install
  pollGCal();
});

chrome.runtime.onStartup.addListener(() => {
  // Ensure alarm exists after browser restart
  chrome.alarms.get('gcal-poll', (existing) => {
    if (!existing) {
      chrome.alarms.create('gcal-poll', { periodInMinutes: 30 });
    }
  });
  // Run immediately on startup
  pollGCal();
});
