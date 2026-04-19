function showSafeStepAlert({ tone, explanation, bullets }) {
  if (document.getElementById('safestep-overlay')) return;

  const isDanger = tone === 'danger';
  const accentColor = isDanger ? '#dc2626' : '#d97706';
  const bgColor = isDanger ? '#7f1d1d' : '#78350f';

  const overlay = document.createElement('div');
  overlay.id = 'safestep-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    background: rgba(0,0,0,0.72);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    animation: ss-fade-in 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes ss-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ss-slide-in { from { transform: translateY(-24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    #safestep-card { animation: ss-slide-in 0.25s ease; }
    #safestep-dismiss:hover { background: rgba(255,255,255,0.15) !important; }
    #safestep-proceed:hover { opacity: 0.8; }
  `;
  document.head.appendChild(style);

  const bulletsHtml = bullets && bullets.length
    ? `<ul style="margin:12px 0 0 0;padding-left:22px;font-size:16px;line-height:1.8;opacity:0.92;">
        ${bullets.map(b => `<li>${b}</li>`).join('')}
       </ul>`
    : '';

  overlay.innerHTML = `
    <div id="safestep-card" style="
      background: ${bgColor};
      border: 3px solid ${accentColor};
      border-radius: 16px;
      padding: 32px 36px;
      max-width: 520px;
      width: 90%;
      color: #fff;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    ">
      <div style="font-size: 52px; text-align: center; margin-bottom: 16px; line-height: 1;">
        ${isDanger ? '🚨' : '⚠️'}
      </div>
      <h2 style="font-size: 24px; font-weight: 900; text-align: center; margin: 0 0 12px; line-height: 1.3;">
        ${isDanger ? 'This page looks dangerous' : 'This page has warning signs'}
      </h2>
      <p style="font-size: 17px; line-height: 1.6; margin: 0; opacity: 0.95; text-align: center;">
        ${explanation}
      </p>
      ${bulletsHtml}
      <div style="display: flex; gap: 12px; margin-top: 28px;">
        <button id="safestep-dismiss" style="
          flex: 1; padding: 14px; font-size: 17px; font-weight: 700;
          background: rgba(255,255,255,0.12); color: #fff;
          border: 2px solid rgba(255,255,255,0.4); border-radius: 10px;
          cursor: pointer; font-family: inherit;
        ">I understand — dismiss</button>
        <button id="safestep-proceed" style="
          padding: 14px 20px; font-size: 15px; font-weight: 600;
          background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.2); border-radius: 10px;
          cursor: pointer; font-family: inherit;
        ">Proceed anyway</button>
      </div>
      <p style="font-size: 13px; text-align: center; margin: 14px 0 0; opacity: 0.6;">
        SafeStep · Your safety copilot
      </p>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('safestep-dismiss').onclick = () => overlay.remove();
  document.getElementById('safestep-proceed').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SAFESTEP_ALERT') {
    showSafeStepAlert(msg);
  }
});
