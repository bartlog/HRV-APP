/**
 * UI management: tab switching, BLE status, mode badge, metric display.
 * Also handles browser compatibility check on startup.
 */

// --- Browser compatibility check ---

export function checkBrowserCompat() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const hasWebBluetooth = typeof navigator.bluetooth !== 'undefined';

  if (hasWebBluetooth) return { supported: true };

  const isFirefox = ua.includes('Firefox');
  const isSafari = ua.includes('Safari') && !ua.includes('Chrome');

  let message;
  if (isIOS) {
    message = 'iOS Safari unterstützt Web Bluetooth nicht. Installiere die Bluefy-App und öffne diese Seite in Bluefy.';
  } else if (isFirefox) {
    message = 'Firefox unterstützt Web Bluetooth nicht. Bitte Chrome oder Edge ≥ 89 verwenden.';
  } else if (isSafari) {
    message = 'Safari unterstützt Web Bluetooth nicht. Bitte Chrome oder Edge ≥ 89 verwenden.';
  } else {
    message = 'Dein Browser unterstützt Web Bluetooth nicht. Bitte Chrome oder Edge ≥ 89 verwenden.';
  }

  return { supported: false, message };
}

export function showCompatWarning(message) {
  const el = document.getElementById('compat-warning');
  const msg = document.getElementById('compat-message');
  if (msg) msg.textContent = message;
  el?.classList.remove('hidden');

  document.getElementById('compat-dismiss')?.addEventListener('click', () => {
    el?.classList.add('hidden');
  }, { once: true });
}

// --- Tab switching ---

export function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('tab--active'));
      panels.forEach(p => p.classList.remove('tab-content--active'));
      tab.classList.add('tab--active');
      document.getElementById(`tab-${target}`)?.classList.add('tab-content--active');
    });
  });
}

// --- Mode badge ---

export function setMode(mode) {
  const badge = document.getElementById('mode-badge');
  if (!badge) return;
  badge.className = `mode-badge mode-badge--${mode}`;
  badge.textContent = { mock: 'SIMULATION', live: 'LIVE', offline: 'OFFLINE' }[mode] ?? mode.toUpperCase();
}

// --- BLE status ---

export function setBLEStatus(state) {
  const el = document.getElementById('ble-status');
  if (!el) return;
  const states = {
    off:        { text: '⬤ Getrennt',            cls: '' },
    connecting: { text: '⬤ Verbinde...',         cls: 'ble-status--connecting' },
    on:         { text: '⬤ Verbunden',           cls: 'ble-status--on' },
    recording:  { text: '⬤ Aufzeichnung läuft', cls: 'ble-status--recording' },
  };
  const s = states[state] ?? states.off;
  el.textContent = s.text;
  el.className = `ble-status ${s.cls}`.trim();
}

// --- Metric display ---

const _fmt = v => (v == null || isNaN(v)) ? '--' : Number(v).toFixed(1);

export function updateMetrics({ rmssd, sdnn, si, lfhf, hr, edr }) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = _fmt(val);
  };
  set('metric-rmssd', rmssd);
  set('metric-sdnn', sdnn);
  set('metric-si', si);
  set('metric-lfhf', lfhf);
  set('metric-hr', hr ? hr.toFixed(0) : null);
  set('metric-edr', edr);
}
