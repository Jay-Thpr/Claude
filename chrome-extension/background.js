const API_BASE = 'http://localhost:3000';

function deriveTone(value) {
  if (!value) return 'neutral';
  if (/safe|ready|ok/i.test(value)) return 'safe';
  if (/warning|careful|not sure/i.test(value)) return 'warning';
  if (/risky|danger|stop/i.test(value)) return 'danger';
  return 'neutral';
}

async function analyzeTab(tabId, url, title) {
  // Skip chrome:// pages, new tabs, extensions
  if (!url || url.startsWith('chrome') || url.startsWith('about') || url.startsWith('extension')) return;

  const cacheKey = `analysis:${url}`;
  const cached = await chrome.storage.session.get(cacheKey).catch(() => ({}));
  if (cached[cacheKey]) {
    applyBadge(cached[cacheKey].tone);
    return;
  }

  let pageContent = '';
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body?.innerText?.slice(0, 4000) || '',
    });
    pageContent = result || '';
  } catch { /* page may not be injectable */ }

  try {
    const res = await fetch(`${API_BASE}/api/scam-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, pageTitle: title, content: pageContent }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tone = deriveTone(data.classification || data.riskLevel);
    const bullets = Array.isArray(data.suspicious_signals) && data.suspicious_signals.length
      ? data.suspicious_signals : null;
    const explanation = data.explanation || 'I checked this page for you.';

    await chrome.storage.session.set({ [cacheKey]: { explanation, tone, bullets } }).catch(() => {});
    applyBadge(tone);

    if (tone === 'danger' || tone === 'warning') {
      chrome.tabs.sendMessage(tabId, { type: 'SAFESTEP_ALERT', tone, explanation, bullets }).catch(() => {});
    }
  } catch {
    applyBadge('neutral');
  }
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    analyzeTab(tabId, tab.url, tab.title || '');
  }
});
