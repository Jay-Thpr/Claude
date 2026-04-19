const API_BASE = 'http://localhost:3000';

function toneFromResponse(data) {
  const val = (data.classification || data.riskLevel || '').toLowerCase();
  if (val === 'risky') return 'danger';
  if (val === 'uncertain' || val === 'not-sure') return 'warning';
  return 'safe';
}

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

async function analyzeTab(tabId, url, title, content) {
  if (!url || url.startsWith('chrome') || url.startsWith('about') || url.startsWith('extension')) return;

  const cacheKey = `analysis:${url}`;
  const cached = await chrome.storage.session.get(cacheKey).catch(() => ({}));
  if (cached[cacheKey]) {
    applyBadge(cached[cacheKey].tone);
    if (cached[cacheKey].tone === 'danger') {
      chrome.tabs.sendMessage(tabId, { type: 'SAFESTEP_ALERT', ...cached[cacheKey] }).catch(() => {});
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/scam-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, pageTitle: title, content }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = toneFromResponse(data);
    const bullets = Array.isArray(data.suspicious_signals) && data.suspicious_signals.length
      ? data.suspicious_signals : null;
    const explanation = data.explanation || 'I checked this page for you.';

    await chrome.storage.session.set({ [cacheKey]: { explanation, tone, bullets } }).catch(() => {});
    applyBadge(tone);

    if (tone === 'danger') {
      chrome.tabs.sendMessage(tabId, { type: 'SAFESTEP_ALERT', tone, explanation, bullets }).catch(() => {});
    }
  } catch {
    applyBadge('neutral');
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'PAGE_CONTENT' && sender.tab?.id) {
    analyzeTab(sender.tab.id, msg.url, msg.title, msg.content);
  }
});
