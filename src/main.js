import { MockGenerator } from './mock/generator.js';
import { rmssd, sdnn } from './hrv/time_domain.js';
import { baevskySI } from './hrv/baevsky.js';
import { filterRR } from './processing/artifact_filter.js';
import { DashboardCharts } from './dashboard/charts.js';
import { ECGViewer } from './dashboard/ecg_viewer.js';
import { initTabs, setMode, setBLEStatus, updateMetrics, checkBrowserCompat, showCompatWarning } from './dashboard/ui.js';
import { initGuidePanel } from './guides/guide_panel.js';
import { createSession, saveRR, saveHRVMetrics, listSessions, deleteSession, db, getSessionMetrics } from './storage/db.js';
import { exportSessionCSV } from './export/csv_export.js';
import ChartAuto from 'chart.js/auto';
import { PFTPSession, BlockerError } from './ble/session_sync.js';
import { LiveSession } from './ble/live_session.js';
import './app.css';

// --- State ---
let activeGenerator = null;
let activeSessionId = null;
let activeLiveSession = null;
let offlineRecordingActive = false;
let prevRR = null;
const rrBuffer = [];
const ecgLiveBuffer = [];
const HRV_WINDOW = 300;
const METRICS_INTERVAL = 30;

// --- Charts & ECG viewer (init after DOM ready) ---
let charts = null;
let ecgViewer = null;

function ensureCharts() {
  if (!charts) charts = new DashboardCharts();
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  ecgViewer = new ECGViewer('ecg-canvas');

  initTabs();
  initGuidePanel();

  const compat = checkBrowserCompat();
  if (!compat.supported) showCompatWarning(compat.message);

  document.getElementById('btn-mock')?.addEventListener('click', startMockSession);
  document.getElementById('btn-connect')?.addEventListener('click', startLiveSession);
  document.getElementById('btn-start-recording')?.addEventListener('click', startOfflineRecording);
  document.getElementById('btn-sync')?.addEventListener('click', syncOfflineSession);
  document.getElementById('btn-pftp-test')?.addEventListener('click', pftpChannelTest);
  document.getElementById('btn-connected-rec-test')?.addEventListener('click', connectedRecordingTest);
  document.getElementById('btn-pmd-test')?.addEventListener('click', pmdDirectTest);
  document.getElementById('btn-rec-format-test')?.addEventListener('click', recordingFormatTest);
  document.getElementById('btn-hr-first-test')?.addEventListener('click', deviceInfoAndHrTest);
  document.getElementById('btn-psftp-correct')?.addEventListener('click', psftpCorrectServiceTest);

  // Re-render ECG when Live tab becomes visible (ECG is now part of dashboard/live tab)
  document.querySelector('[data-tab="dashboard"]')?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (ecgLiveBuffer.length > 1) ecgViewer?.drawLive(new Int16Array(ecgLiveBuffer));
    });
  });

  // Load sessions on start and whenever the sessions tab is clicked
  renderSessionList();
  document.querySelector('[data-tab="sessions"]')?.addEventListener('click', renderSessionList);

  // Restore recording state after page refresh
  const savedRecording = sessionStorage.getItem('offlineRecording');
  if (savedRecording) {
    try {
      const { startedAt } = JSON.parse(savedRecording);
      offlineRecordingActive = true;
      setBLEStatus('recording');
      updateRecordingButtons();
      const elapsedMin = Math.round((Date.now() - startedAt) / 60000);
      const statusEl = document.getElementById('offline-status');
      if (statusEl) {
        statusEl.textContent = `Aufzeichnung läuft seit ${elapsedMin} Min. H10 zeichnet autonom auf.`;
        statusEl.classList.remove('hidden');
      }
    } catch {}
  }

  startMockSession();
});

// --- Mock session ---
function startMockSession() {
  stopActiveSession();
  setMode('mock');
  if (!offlineRecordingActive) setBLEStatus('off');
  ensureCharts();

  const gen = new MockGenerator();
  activeGenerator = gen;

  let beatCount = 0;

  // RR → HRV metrics
  gen.rrStream$.subscribe(rr => {
    const filtered = filterRR(rr, prevRR);
    prevRR = filtered ?? prevRR;
    if (!filtered) return;

    rrBuffer.push(filtered);
    if (rrBuffer.length > HRV_WINDOW) rrBuffer.shift();

    if (activeSessionId) saveRR(activeSessionId, filtered).catch(() => {});

    beatCount++;
    if (beatCount % METRICS_INTERVAL === 0 && rrBuffer.length >= 10) {
      const r = rmssd(rrBuffer);
      const s = sdnn(rrBuffer);
      const si = baevskySI(rrBuffer);
      const meanRR = rrBuffer.reduce((a, b) => a + b, 0) / rrBuffer.length;
      const hr = 60000 / meanRR;

      updateMetrics({ rmssd: r, sdnn: s, si, hr, lfhf: NaN, edr: NaN });
      charts?.addPoint(Date.now(), r, si);

      if (activeSessionId) {
        saveHRVMetrics(activeSessionId, { rmssd: r, sdnn: s, si, lf: NaN, hf: NaN, lfhf: NaN, edr: NaN }).catch(() => {});
      }
    }
  });

  // ECG → live viewer
  gen.ecgStream$.subscribe(({ samples }) => {
    for (const s of samples) ecgLiveBuffer.push(s);
    if (ecgLiveBuffer.length > 1300) ecgLiveBuffer.splice(0, ecgLiveBuffer.length - 1300);
    ecgViewer?.drawLive(new Int16Array(ecgLiveBuffer));
    const hint = document.getElementById('ecg-hint');
    if (hint) hint.style.display = 'none';
  });

  gen.start();

  // DB session — non-blocking, failure doesn't affect data flow
  createSession('mock').then(id => { activeSessionId = id; }).catch(err => {
    console.warn('IndexedDB not available, running without persistence:', err);
  });
}

// --- Live BLE ---
async function startLiveSession() {
  // Wenn bereits verbunden → trennen
  if (activeLiveSession) {
    activeLiveSession.disconnect();
    return;
  }

  if (offlineRecordingActive) {
    alert('Eine Offline-Aufzeichnung läuft. Bitte zuerst "Aufzeichnung beenden und speichern" ausführen.');
    return;
  }

  if (!navigator.bluetooth) {
    alert('Web Bluetooth nicht verfügbar. Bitte Chrome oder Edge ≥ 89 verwenden.');
    return;
  }

  const btn = document.getElementById('btn-connect');
  if (btn) { btn.disabled = true; btn.textContent = 'Verbinde…'; }

  stopActiveSession();
  setMode('live');
  setBLEStatus('connecting');
  ensureCharts();

  const session = new LiveSession();

  const onDisconnected = () => {
    activeLiveSession = null;
    setBLEStatus('off');
    setMode('mock');
    if (btn) { btn.textContent = 'H10 verbinden'; btn.disabled = false; }
    startMockSession();
  };

  try {
    const name = await session.connect();
    activeLiveSession = session;
    session.onDisconnect = onDisconnected;

    setBLEStatus('on');
    if (btn) { btn.textContent = 'Verbindung trennen'; btn.disabled = false; }

    let beatCount = 0;
    createSession('live').then(id => { activeSessionId = id; }).catch(() => {});

    await session.startStreaming((rrMs, hr) => {
      const filtered = filterRR(rrMs, prevRR);
      prevRR = filtered ?? prevRR;
      if (!filtered) return;

      rrBuffer.push(filtered);
      if (rrBuffer.length > HRV_WINDOW) rrBuffer.shift();

      if (activeSessionId) saveRR(activeSessionId, filtered).catch(() => {});

      beatCount++;
      if (beatCount % METRICS_INTERVAL === 0 && rrBuffer.length >= 10) {
        const r = rmssd(rrBuffer);
        const s = sdnn(rrBuffer);
        const si = baevskySI(rrBuffer);
        updateMetrics({ rmssd: r, sdnn: s, si, hr, lfhf: NaN, edr: NaN });
        charts?.addPoint(Date.now(), r, si);
        if (activeSessionId) {
          saveHRVMetrics(activeSessionId, { rmssd: r, sdnn: s, si, lf: NaN, hf: NaN, lfhf: NaN, edr: NaN }).catch(() => {});
        }
      }
    });

  } catch (err) {
    activeLiveSession = null;
    session.disconnect();
    setBLEStatus('off');
    if (btn) { btn.textContent = 'H10 verbinden'; btn.disabled = false; }
    const cancelled = /cancel|denied|chosen/i.test(err.message);
    if (!cancelled) alert(`Verbindung fehlgeschlagen: ${err.message}`);
    startMockSession();
  }
}

// --- Offline recording (Phase 1a) ---
async function startOfflineRecording() {
  if (offlineRecordingActive) {
    alert('Eine Aufzeichnung läuft bereits. Bitte zuerst "Aufzeichnung beenden und speichern" klicken.');
    return;
  }
  if (activeLiveSession) {
    alert('Live-Verbindung aktiv. Bitte zuerst die Verbindung trennen, bevor eine Aufzeichnung gestartet wird.');
    return;
  }
  if (!navigator.bluetooth) {
    alert('Web Bluetooth nicht verfügbar. Bitte Chrome oder Edge ≥ 89 verwenden.');
    return;
  }
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-start-recording');
  const btnSync = document.getElementById('btn-sync');
  if (btn) btn.disabled = true;

  function log(msg) {
    console.log(msg);
    if (statusEl) { statusEl.textContent = msg; statusEl.classList.remove('hidden'); }
  }

  const session = new PFTPSession();
  try {
    log('Verbinde mit Polar H10…');
    const deviceName = await session.connect();
    log(`Verbunden: ${deviceName}`);
    // Short hex timestamp (8 chars) — H10 FAT filesystem has trouble with long/underscore IDs
    const exerciseId = Math.floor(Date.now() / 1000).toString(16).toUpperCase();
    await session.startRecording(exerciseId);
    offlineRecordingActive = true;
    sessionStorage.setItem('offlineRecording', JSON.stringify({ exerciseId, startedAt: Date.now() }));
    setBLEStatus('recording');
    updateRecordingButtons();
    log(`Aufzeichnung aktiv. H10 zeichnet autonom auf. ID: ${exerciseId}`);
  } catch (err) {
    if (err instanceof BlockerError && err.code === 'UNSYNCED_SESSION') {
      const choice = confirm(
        `${err.message}\n\nOK = Löschen und neu starten\nAbbrechen = Abbrechen`
      );
      if (choice) {
        try {
          await session.removeExercise(err.exerciseId);
          session.disconnect();
          if (btn) btn.disabled = false;
          await startOfflineRecording(); // retry
          return;
        } catch (e2) { log(`Fehler: ${e2.message}`); }
      } else {
        log('Abgebrochen.');
      }
    } else {
      log(`Fehler: ${err.message}`);
    }
    session.disconnect();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function syncOfflineSession() {
  if (!navigator.bluetooth) {
    alert('Web Bluetooth nicht verfügbar. Bitte Chrome oder Edge ≥ 89 verwenden.');
    return;
  }
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-sync');
  const btnStart = document.getElementById('btn-start-recording');
  if (btn) btn.disabled = true;

  const session = new PFTPSession(({ bytes }) => {
    if (statusEl) statusEl.textContent = `Lade herunter… ${bytes} Bytes empfangen`;
  });

  try {
    const result = await session.sync(msg => {
      if (statusEl) { statusEl.textContent = msg; statusEl.classList.remove('hidden'); }
    });
    const { sessionId, rrValues, rrWithTimestamps, durationH } = result;

    if (sessionId) {
      await db.rrIntervals.bulkAdd(
        rrWithTimestamps.map(({ timestamp, rrMs }) => ({ sessionId, timestamp, rrMs, artifactFlag: false }))
      );
      const windowSize = 300;
      for (let i = windowSize; i <= rrValues.length; i += windowSize) {
        const w = rrValues.slice(i - windowSize, i);
        await saveHRVMetrics(sessionId, {
          rmssd: rmssd(w), sdnn: sdnn(w), si: baevskySI(w),
          lf: NaN, hf: NaN, lfhf: NaN, edr: NaN,
        });
      }
    }

    if (statusEl) statusEl.textContent =
      `Synchronisiert: ${rrValues.length} RR-Werte, ${durationH} h — ` +
      `RMSSD ${Math.round(rmssd(rrValues))} ms, SI ${Math.round(baevskySI(rrValues))}`;

    offlineRecordingActive = false;
    sessionStorage.removeItem('offlineRecording');
    setBLEStatus('off');
    updateRecordingButtons();
    renderSessionList();
  } catch (err) {
    if (statusEl) { statusEl.textContent = `Fehler: ${err.message}`; statusEl.classList.remove('hidden'); }
    console.error('[Sync error]', err);
    session.disconnect();
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- Sessions list ---
async function renderSessionList() {
  const container = document.getElementById('session-list');
  if (!container) return;
  const all = await listSessions();
  const sessions = all.filter(s => s.mode === 'offline');
  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">Noch keine Offline-Sitzungen gespeichert.</p>';
    return;
  }
  container.innerHTML = sessions.map(s => {
    const date = new Date(s.startTime).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
    const duration = s.durationH != null ? `${s.durationH} h` : '—';
    const rrCount = s.rrCount != null ? `${s.rrCount} RR` : '—';
    return `<div class="session-item">
      <div class="session-card">
        <div class="session-meta">
          <span class="session-label session-label--offline">Offline</span>
          <span class="session-date">${date}</span>
          <span class="session-stat">${duration}</span>
          <span class="session-stat">${rrCount}</span>
        </div>
        <div class="session-actions">
          <button class="btn-analyze" data-id="${s.id}">Analysieren</button>
          <button class="btn-export-csv" data-id="${s.id}" title="Als CSV herunterladen">CSV</button>
          <button class="btn-session-delete" data-id="${s.id}" title="Sitzung löschen">✕</button>
        </div>
      </div>
      <div class="session-analysis hidden" data-sid="${s.id}"></div>
    </div>`;
  }).join('');
  container.querySelectorAll('.btn-analyze').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = Number(btn.dataset.id);
      const panel = container.querySelector(`.session-analysis[data-sid="${sid}"]`);
      if (!panel) return;
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) await analyzeSession(sid, panel);
    });
  });
  container.querySelectorAll('.btn-export-csv').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await exportSessionCSV(Number(btn.dataset.id));
      } catch (e) {
        alert(`Export fehlgeschlagen: ${e.message}`);
      }
    });
  });
  container.querySelectorAll('.btn-session-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteSession(Number(btn.dataset.id));
      renderSessionList();
    });
  });
}

// --- Session analysis ---
async function analyzeSession(sessionId, panel) {
  if (panel.dataset.rendered) return;
  panel.dataset.rendered = 'true';

  const rrRows = await db.rrIntervals.where('sessionId').equals(sessionId).sortBy('timestamp');
  const rrValues = rrRows.map(r => r.rrMs);

  if (rrValues.length === 0) {
    panel.innerHTML = '<p class="empty-state">Keine RR-Daten in der Datenbank gefunden.</p>';
    return;
  }

  const avgRR = rrValues.reduce((a, b) => a + b, 0) / rrValues.length;
  const avgBpm = Math.round(60000 / avgRR);
  const wRmssd = Math.round(rmssd(rrValues));
  const wSdnn  = Math.round(sdnn(rrValues));
  const wSi    = Math.round(baevskySI(rrValues));

  // Windowed RMSSD + SI — 50-beat windows for smooth curve, real clock times on x-axis
  const WIN = 50;
  const rmssdSeries = [], siSeries = [], timeLabels = [];
  for (let i = WIN; i <= rrValues.length; i += WIN) {
    const w = rrValues.slice(i - WIN, i);
    rmssdSeries.push(Math.round(rmssd(w)));
    siSeries.push(Math.round(baevskySI(w)));
    timeLabels.push(new Date(rrRows[i - 1].timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  }

  // Poincaré data (max 500 points)
  const poincare = [];
  for (let i = 0; i < Math.min(rrValues.length - 1, 500); i++) {
    poincare.push({ x: rrValues[i], y: rrValues[i + 1] });
  }

  panel.innerHTML = `
    <div class="analysis-stats">
      <div class="analysis-stat"><div class="stat-label">Ø HR</div><div class="stat-value">${avgBpm}<small> bpm</small></div></div>
      <div class="analysis-stat"><div class="stat-label">RMSSD</div><div class="stat-value">${wRmssd}<small> ms</small></div></div>
      <div class="analysis-stat"><div class="stat-label">SDNN</div><div class="stat-value">${wSdnn}<small> ms</small></div></div>
      <div class="analysis-stat"><div class="stat-label">Stress-Index</div><div class="stat-value">${wSi}</div></div>
    </div>
    <div class="analysis-charts">
      <div class="analysis-chart-wrap">
        <p class="chart-label">RMSSD <span style="color:#4f8ef7">■</span> &amp; Stress-Index <span style="color:#a78bfa">■</span> (50-Schlag-Fenster)</p>
        <canvas id="ac-rmssd-${sessionId}"></canvas>
      </div>
      <div class="analysis-chart-wrap">
        <p class="chart-label">Poincaré-Plot</p>
        <canvas id="ac-poincare-${sessionId}"></canvas>
      </div>
    </div>`;

  const gridColor = '#2a2d3e', tickColor = '#7c8db0';

  if (rmssdSeries.length > 1) {
    new ChartAuto(document.getElementById(`ac-rmssd-${sessionId}`), {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [
          { label: 'RMSSD', data: rmssdSeries, borderColor: '#4f8ef7', backgroundColor: 'rgba(79,142,247,.08)', tension: 0.35, pointRadius: 3, fill: true, yAxisID: 'y' },
          { label: 'SI',    data: siSeries,    borderColor: '#a78bfa', backgroundColor: 'transparent',            tension: 0.35, pointRadius: 3, fill: false, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true, animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x:  { ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 }, grid: { color: gridColor } },
          y:  { position: 'left',  ticks: { color: '#4f8ef7', font: { size: 10 } }, grid: { color: gridColor }, title: { display: true, text: 'RMSSD ms', color: '#4f8ef7' } },
          y1: { position: 'right', ticks: { color: '#a78bfa', font: { size: 10 } }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Stress-Index', color: '#a78bfa' } },
        },
      },
    });
  }

  new ChartAuto(document.getElementById(`ac-poincare-${sessionId}`), {
    type: 'scatter',
    data: {
      datasets: [{ data: poincare, backgroundColor: 'rgba(79,142,247,.4)', pointRadius: 2 }],
    },
    options: {
      responsive: true, animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor }, title: { display: true, text: 'RR[n] ms', color: tickColor } },
        y: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor }, title: { display: true, text: 'RR[n+1] ms', color: tickColor } },
      },
    },
  });
}

// --- PFTP channel test (Go/No-Go diagnostic) ---
async function pftpChannelTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-pftp-test');
  if (btn) btn.disabled = true;

  function log(msg) {
    console.log(msg);
    if (statusEl) { statusEl.textContent = msg; statusEl.classList.remove('hidden'); }
  }

  const session = new PFTPSession();
  try {
    log('Verbinde…');
    const name = await session.connect();
    log(`Verbunden: ${name}`);

    // Filesystem exploration: probe these paths to understand H10 directory structure
    const fsPaths = ['/', '/E/', '/R/', '/U/', '/U/0/', '/U/0/E/'];
    log('--- Filesystem-Scan ---');
    for (const path of fsPaths) {
      try {
        const resp = await session.rawProbe(path);
        log(`${path.padEnd(12)} → [${resp.hex}] (${resp.length} bytes)${resp.length > 3 ? ' ← INHALT!' : ''}`);
      } catch (e) {
        log(`${path.padEnd(12)} → Fehler: ${e.message}`);
      }
    }
    log('-----------------------');

    const exercises = await session.listExercises();
    log(`listExercises(/E/): [${exercises.join(', ') || 'leer'}]`);
  } catch (err) {
    log(`✗ ${err.message}`);
    console.error('[PFTP test]', err);
  } finally {
    session.disconnect();
    if (btn) btn.disabled = false;
  }
}

// --- Device info + HR-first recording test ---
async function deviceInfoAndHrTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-hr-first-test');
  if (btn) btn.disabled = true;

  const lines = [];
  function log(msg) {
    console.log('[HRfirst]', msg);
    lines.push(msg);
    if (statusEl) { statusEl.textContent = lines.slice(-6).join('\n'); statusEl.classList.remove('hidden'); }
  }

  let device = null;
  try {
    log('Verbinde (mit HR + DIS Service)…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar H10' }],
      optionalServices: [
        'fb005c80-02e7-f387-1cad-8acd2d8df0c8',
        0x180D, // HR Service
        0x180A, // Device Information Service
        0x180F, // Battery
      ],
    });
    const server = await device.gatt.connect();
    log(`Verbunden: ${device.name}`);

    // 1. Read firmware version from Device Information Service
    try {
      const disSvc = await server.getPrimaryService(0x180A);
      const tryRead = async (uuid, label) => {
        try {
          const chr = await disSvc.getCharacteristic(uuid);
          const val = await chr.readValue();
          const str = new TextDecoder().decode(val);
          log(`${label}: ${str}`);
        } catch {}
      };
      await tryRead(0x2A24, 'Modell');
      await tryRead(0x2A26, 'Firmware');
      await tryRead(0x2A27, 'Hardware');
      await tryRead(0x2A28, 'Software');
      await tryRead(0x2A29, 'Hersteller');
    } catch (e) {
      log(`DIS nicht verfügbar: ${e.message}`);
    }

    // 2. Subscribe to HR service to "wake up" the HR sensor
    log('Subscribing HR service (0x2A37)…');
    let hrCount = 0;
    try {
      const hrSvc = await server.getPrimaryService(0x180D);
      const hrChar = await hrSvc.getCharacteristic(0x2A37);
      hrChar.addEventListener('characteristicvaluechanged', (e) => {
        hrCount++;
        const view = e.target.value;
        const flags = view.getUint8(0);
        const hr = (flags & 0x01) ? view.getUint16(1, true) : view.getUint8(1);
        if (hrCount <= 3) log(`HR Messung ${hrCount}: ${hr} bpm`);
      });
      await hrChar.startNotifications();
      log('HR Notifications aktiv. Warte 5s auf HR-Daten…');
      await new Promise(r => setTimeout(r, 5000));
      log(`${hrCount} HR-Messungen empfangen.`);
    } catch (e) {
      log(`HR Service Fehler: ${e.message}`);
    }

    // 3. Now try startRecording via PFTP while HR is active
    log('Starte PFTP Recording MIT aktivem HR…');
    const pftpSvc = await server.getPrimaryService('fb005c80-02e7-f387-1cad-8acd2d8df0c8');
    const cp = await pftpSvc.getCharacteristic('fb005c81-02e7-f387-1cad-8acd2d8df0c8');
    await cp.startNotifications();

    const { buildStartRecordingCmd, buildStopRecordingCmd } = await import('./ble/polar_pmd.js');

    // Mini inline sender (avoids PFTPSession initialization complexity)
    const sendRaw = async (bytes) => {
      const pkt = new Uint8Array([0x10, ...bytes]); // single packet, seq=0, isLast=1
      const result = await new Promise((resolve, reject) => {
        const handler = (e) => {
          cp.removeEventListener('characteristicvaluechanged', handler);
          resolve(Array.from(new Uint8Array(e.target.value.buffer)));
        };
        cp.addEventListener('characteristicvaluechanged', handler);
        setTimeout(() => reject(new Error('timeout')), 8000);
        cp.writeValueWithResponse(pkt);
      });
      return result;
    };

    // GET /R/ before start
    const before = await sendRaw([0x0a, 0x03, 0x2f, 0x52, 0x2f]);
    log(`/R/ vor Start: [${before.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);

    // PUT /R/ with exerciseId="1", sampleType=3, interval=1s
    const cmd = buildStartRecordingCmd('1');
    // Build single-packet if ≤19 bytes, else warn
    if (cmd.length <= 19) {
      const start = await sendRaw(cmd);
      log(`startRecording("1") → [${start.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
    } else {
      log(`Payload ${cmd.length} bytes → zu lang für inline-Test, braucht 2 Pakete`);
    }

    await new Promise(r => setTimeout(r, 3000));

    // GET /R/ after start
    const after = await sendRaw([0x0a, 0x03, 0x2f, 0x52, 0x2f]);
    log(`/R/ nach Start: [${after.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);

    // DELETE /R/ (stop)
    const stop = await sendRaw([0x0a, 0x03, 0x2f, 0x52, 0x2f, 0x10, 0x02]);
    log(`stopRecording → [${stop.map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);

    // GET /E/
    await new Promise(r => setTimeout(r, 2000));
    const el = await sendRaw([0x0a, 0x03, 0x2f, 0x45, 0x2f]);
    log(`/E/ → [${el.map(b=>b.toString(16).padStart(2,'0')).join(' ')}] ${el.length > 3 ? '★ HAT INHALT!' : ''}`);

  } catch (err) {
    log(`✗ ${err.message}`);
    console.error('[hr-first]', err);
  } finally {
    try { device?.gatt?.disconnect(); } catch {}
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = lines.join('\n');
  }
}

// --- PMD Control Point direct test (no RFC-76 framing, raw PMD format) ---
async function pmdDirectTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-pmd-test');
  if (btn) btn.disabled = true;

  const lines = [];
  function log(msg) {
    console.log('[PMD-direct]', msg);
    lines.push(msg);
    if (statusEl) { statusEl.textContent = lines.slice(-4).join(' | '); statusEl.classList.remove('hidden'); }
  }

  let device = null;
  try {
    log('Verbinde…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar H10' }],
      optionalServices: ['fb005c80-02e7-f387-1cad-8acd2d8df0c8', 0x180F],
    });
    const server = await device.gatt.connect();
    log(`Verbunden: ${device.name}`);

    const svc = await server.getPrimaryService('fb005c80-02e7-f387-1cad-8acd2d8df0c8');
    const cp = await svc.getCharacteristic('fb005c81-02e7-f387-1cad-8acd2d8df0c8');

    // Subscribe so we receive the response notification
    const responsePromise = new Promise((resolve) => {
      const handler = (e) => {
        cp.removeEventListener('characteristicvaluechanged', handler);
        const bytes = Array.from(new Uint8Array(e.target.value.buffer));
        resolve(bytes);
      };
      cp.addEventListener('characteristicvaluechanged', handler);
    });
    await cp.startNotifications();

    // Send RAW PMD CP command: 0x01 = REQUEST, 0x00 = first measurement type
    // Expected PMD response format: [0xF0, 0x01, type, 0x00, ...settings]
    log('Sende PMD CP REQUEST (0x01 0x00) ohne RFC-76…');
    await cp.writeValueWithResponse(new Uint8Array([0x01, 0x00]));

    const resp = await Promise.race([
      responsePromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    const hex = resp.map(b => b.toString(16).padStart(2,'0')).join(' ');
    log(`PMD response (${resp.length} bytes): [${hex}]`);
    if (resp[0] === 0xF0) {
      log('→ Echter PMD-Response! F0 = PMD Antwort-Opcode. FB005C81 ist PMD CP.');
    } else if (resp[0] !== undefined) {
      log(`→ Nicht-PMD Response (erster Byte 0x${resp[0].toString(16)}) — möglicherweise PFTP-Fehler`);
    }

    // Also try REQUEST for type 0x03 (PPI on some firmware)
    const resp2Promise = new Promise((resolve) => {
      const handler = (e) => {
        cp.removeEventListener('characteristicvaluechanged', handler);
        resolve(Array.from(new Uint8Array(e.target.value.buffer)));
      };
      cp.addEventListener('characteristicvaluechanged', handler);
    });
    log('Sende PMD CP REQUEST (0x01 0x03)…');
    await cp.writeValueWithResponse(new Uint8Array([0x01, 0x03]));
    const resp2 = await Promise.race([
      resp2Promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    log(`0x01 0x03 → [${resp2.map(b=>b.toString(16).padStart(2,'0')).join(' ')}] (${resp2.length} bytes)`);

  } catch (err) {
    log(`✗ ${err.message}`);
    console.error('[pmd-direct]', err);
  } finally {
    try { device?.gatt?.disconnect(); } catch {}
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = lines.join('\n');
  }
}

// --- Recording format probe: try sampleType 0,1,2,3 and watch stopRecording response ---
async function recordingFormatTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-rec-format-test');
  if (btn) btn.disabled = true;

  const lines = [];
  function log(msg) {
    console.log('[RecFmt]', msg);
    lines.push(msg);
    if (statusEl) { statusEl.textContent = lines.slice(-5).join('\n'); statusEl.classList.remove('hidden'); }
  }

  const { buildStartRecordingCmd } = await import('./ble/polar_pmd.js');
  const { PFTPSession } = await import('./ble/session_sync.js');

  // The CANARY: if DELETE /R/ returns 0x02 instead of 0x01, recording was active
  const CANARY_OK   = byte => byte === 0x02;
  const CANARY_FAIL = byte => byte === 0x01;

  const testCases = [
    { sampleType: 0, label: 'type=0 (DELTA?)' },
    { sampleType: 1, label: 'type=1 (PPI/IMMEDIATE?)' },
    { sampleType: 2, label: 'type=2 (unknown)' },
    { sampleType: 3, label: 'type=3 (RR_INTERVAL, current)' },
  ];

  const session = new PFTPSession();
  try {
    log('Verbinde…');
    await session.connect();
    log('Verbunden. Teste sampleType 0–3…');

    for (const tc of testCases) {
      // Build command with this sampleType
      // Temporarily patch: build manually from polar_pmd exports
      const cmd = buildStartRecordingCmd('T1', 1, tc.sampleType);
      const startResp = await session.sendCommand(cmd);
      const startBytes = Array.from(new Uint8Array(startResp));
      const startCode = startBytes[startBytes.length - 1];
      log(`START ${tc.label} → 0x${startCode.toString(16)}`);

      // 2s pause so H10 can process
      await new Promise(r => setTimeout(r, 2000));

      // Stop and check the canary
      const stopResp = await session.sendCommand(
        (await import('./ble/polar_pmd.js')).buildStopRecordingCmd()
      );
      const stopBytes = Array.from(new Uint8Array(stopResp));
      const stopCode = stopBytes[stopBytes.length - 1];
      log(`STOP ${tc.label} → 0x${stopCode.toString(16)} ${CANARY_OK(stopCode) ? '★ RECORDING WAS ACTIVE!' : '(leer)'}`);

      // Check /E/ after stop
      const eProbe = await session.rawProbe('/E/');
      log(`/E/ → ${eProbe.length > 3 ? '★ HAT INHALT: ' + eProbe.hex : 'leer'}`);

      await new Promise(r => setTimeout(r, 1000));
    }

    log('Fertig. Sieh oben welches ★ hat.');
  } catch (err) {
    log(`✗ ${err.message}`);
    console.error('[recfmt]', err);
  } finally {
    session.disconnect();
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = lines.join('\n');
  }
}

// --- PSFTP correct-service test (uses 0xFEEE, FB005C52/53, RFC76 with status bits) ---
async function psftpCorrectServiceTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-psftp-correct');
  if (btn) btn.disabled = true;

  const lines = [];
  function log(msg) {
    console.log('[PSFTP]', msg);
    lines.push(msg);
    if (statusEl) { statusEl.textContent = lines.slice(-6).join('\n'); statusEl.classList.remove('hidden'); }
  }

  let device = null;
  try {
    log('Verbinde (PSFTP 0xFEEE)…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Polar H10' }],
      optionalServices: ['0000feee-0000-1000-8000-00805f9b34fb', 0x180F],
    });
    // Chrome/Windows: after fresh OS pairing the first GATT operation triggers a
    // BLE security re-exchange that drops the connection. Retry up to 3 times.
    let server = null;
    let svc = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        server = await device.gatt.connect();
        const delay = attempt * 600; // 600ms, 1200ms, 1800ms
        log(`Verbindungsversuch ${attempt}/3 — warte ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        if (!server.connected) { log(`Versuch ${attempt}: GATT nicht stabil, retry…`); continue; }
        log(`Verbunden: ${device.name} (Versuch ${attempt}, GATT stabil)`);
        svc = await server.getPrimaryService('0000feee-0000-1000-8000-00805f9b34fb');
        log('✓ PSFTP Service erhalten');
        break;
      } catch (e) {
        log(`Versuch ${attempt} fehlgeschlagen: ${e.message}`);
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (!svc) throw new Error('PSFTP Service nach 3 Versuchen nicht erreichbar');
    // Log characteristic properties to understand write mode requirements
    const allChars = await svc.getCharacteristics();
    for (const c of allChars) {
      const props = ['read','write','writeWithoutResponse','notify','indicate'].filter(p => c.properties[p]);
      log(`  Char ${c.uuid.slice(0,8)}: [${props.join(', ')}]`);
    }

    // Correct char assignment (verified from polar-ble-sdk BlePsFtpClient.kt):
    //   FB005C51 (cmd)  write+notify  — write commands HERE; notify = per-packet ACKs
    //   FB005C52 (d2h)  notify        — response data from device
    //   FB005C53 (h2d)  write         — host→device app notifications (NOT commands)
    const cmd = await svc.getCharacteristic('fb005c51-02e7-f387-1cad-8acd2d8df0c8');
    const d2h = await svc.getCharacteristic('fb005c52-02e7-f387-1cad-8acd2d8df0c8');
    const h2d = await svc.getCharacteristic('fb005c53-02e7-f387-1cad-8acd2d8df0c8'); // write-only: host→dev notifications

    // Subscribe FB005C51 for per-packet ACKs (write side); also for any unsolicited init notifications
    await cmd.startNotifications();
    cmd.addEventListener('characteristicvaluechanged', e => {
      const raw = new Uint8Array(e.target.value.buffer);
      log(`  RX CMD/ACK (51): [${Array.from(raw).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
    });
    log('✓ CMD (FB005C51) subscribed');

    // Subscribe FB005C52 for response data
    await d2h.startNotifications();
    log('✓ D2H (FB005C52) subscribed');

    // Wait for any unsolicited init notification
    await new Promise(r => setTimeout(r, 400));
    log('--- Init-Warte abgeschlossen ---');

    // Response architecture (from SDK source analysis):
    //   QUERY/REQUEST responses → FB005C51 notifications
    //     status=LAST(1): complete response payload (small responses)
    //     status=MORE(3): data chunk (large responses, followed by LAST on 51 or D2H on 52)
    //     status=RESP(0): error/terminator — payload[0..1] = LE error code
    //   FILE data chunks → FB005C52 (D2H) notifications (for large file transfers)
    const waitResp = (timeoutMs = 8000) => new Promise((resolve, reject) => {
      const dataChunks = [];
      let done = false;
      const finish = (ok, data, errorCode) => {
        if (done) return; done = true;
        cmd.removeEventListener('characteristicvaluechanged', cmdHandler);
        d2h.removeEventListener('characteristicvaluechanged', d2hHandler);
        clearTimeout(timer);
        resolve({ ok, data, errorCode });
      };

      // FB005C51: QUERY/small responses come here
      const cmdHandler = (e) => {
        const raw = new Uint8Array(e.target.value.buffer);
        const status = (raw[0] >> 1) & 0x03;
        const payload = raw.slice(1);
        const hex = Array.from(raw).map(b=>b.toString(16).padStart(2,'0')).join(' ');
        log(`  RX 51: [${hex}] status=${status}`);
        if (status === 0) {
          // Error/terminator: LE uint16 error code in bytes 1-2
          const errorCode = (payload[0] ?? 0) | ((payload[1] ?? 0) << 8);
          const total = dataChunks.reduce((s,c) => s+c.length, 0);
          const combined = new Uint8Array(total);
          let off = 0; for (const c of dataChunks) { combined.set(c, off); off += c.length; }
          finish(errorCode === 0, errorCode === 0 ? combined : new Uint8Array(0), errorCode);
        } else if (status === 1) {
          // LAST data packet on CMD char = complete response (typical for QUERY responses)
          const total = dataChunks.reduce((s,c) => s+c.length, 0) + payload.length;
          const combined = new Uint8Array(total);
          let off = 0; for (const c of dataChunks) { combined.set(c, off); off += c.length; }
          combined.set(payload, off);
          finish(true, combined, 0);
        } else {
          // MORE: accumulate chunk
          dataChunks.push(Array.from(payload));
        }
      };

      // FB005C52: large file data chunks
      const d2hHandler = (e) => {
        const raw = new Uint8Array(e.target.value.buffer);
        const status = (raw[0] >> 1) & 0x03;
        const payload = raw.slice(1);
        log(`  RX 52: [${Array.from(raw).map(b=>b.toString(16).padStart(2,'0')).join(' ')}] status=${status}`);
        if (status === 0) {
          const errorCode = (payload[0] ?? 0) | ((payload[1] ?? 0) << 8);
          const total = dataChunks.reduce((s,c) => s+c.length, 0);
          const combined = new Uint8Array(total);
          let off = 0; for (const c of dataChunks) { combined.set(c, off); off += c.length; }
          finish(errorCode === 0, errorCode === 0 ? combined : new Uint8Array(0), errorCode);
        } else {
          dataChunks.push(Array.from(payload));
        }
      };

      const timer = setTimeout(() => {
        cmd.removeEventListener('characteristicvaluechanged', cmdHandler);
        d2h.removeEventListener('characteristicvaluechanged', d2hHandler);
        reject(new Error('timeout'));
      }, timeoutMs);
      cmd.addEventListener('characteristicvaluechanged', cmdHandler);
      d2h.addEventListener('characteristicvaluechanged', d2hHandler);
    });

    const send = async (label, payloadBytes) => {
      const pkt = new Uint8Array([0x02, ...payloadBytes]); // RFC76: LAST, seq=0
      log(`TX ${label} → FB005C51: [${Array.from(pkt).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
      const respPromise = waitResp();
      // SDK uses writeWithoutResponse by default
      await cmd.writeValueWithoutResponse(pkt);
      const result = await respPromise;
      log(`  → errorCode=${result.errorCode} data=${result.data.length}b ${result.ok ? '✓' : '✗'}`);
      return result;
    };

    // 0. SET_LOCAL_TIME (QUERY 3) — H10 needs a valid timestamp to create exercise files.
    //    PbPFtpSetLocalTimeParams { date: PbDate(year,month,day), time: PbTime(h,m,s), tz_offset }
    log('--- Query: setLocalTime (id=3) ---');
    {
      const now = new Date();
      function encV(v) {
        const b = [];
        while (v > 0x7f) { b.push((v & 0x7f) | 0x80); v >>>= 7; }
        b.push(v & 0x7f);
        return b;
      }
      function fv(num, v) { return [(num << 3) | 0, ...encV(v)]; }
      function fl(num, bytes) { return [(num << 3) | 2, bytes.length, ...bytes]; }
      const dateBytes = [...fv(1, now.getFullYear()), ...fv(2, now.getMonth() + 1), ...fv(3, now.getDate())];
      const timeBytes = [...fv(1, now.getHours()), ...fv(2, now.getMinutes()), ...fv(3, now.getSeconds())];
      const tzMin = -now.getTimezoneOffset(); // JS offset is negative of UTC offset
      const params = [...fl(1, dateBytes), ...fl(2, timeBytes), ...fv(3, tzMin)];
      log(`  Zeit: ${now.toLocaleString('de-DE')} TZ-Offset=${tzMin}min`);
      try {
        await send('setLocalTime', [0x03, 0x80, ...params]);
        log('✓ Systemzeit gesetzt');
      } catch (e) {
        log(`  setLocalTime warning: ${e.message} (fahre fort)`);
      }
    }
    await new Promise(r => setTimeout(r, 300));

    // 1. Recording status query (id=16 = 0x10): RFC60 QUERY = [0x10, 0x80]
    log('--- Query: recordingStatus (id=16) ---');
    await send('recStatus', [0x10, 0x80]);

    // 2. List exercises: RFC60 REQUEST GET /E/
    //    PbPFtpOperation{GET=0, path="/E/"}: [0x08, 0x00, 0x12, 0x03, 0x2f, 0x45, 0x2f] = 7b
    //    RFC60: [0x07, 0x00, ...]
    log('--- Request: GET /E/ ---');
    await send('listExercises', [0x07, 0x00, 0x08, 0x00, 0x12, 0x03, 0x2f, 0x45, 0x2f]);

    // 3. Filesystem-Scan + Cleanup
    //    GET /E/1/ — probe exercise directory directly (might exist even if GET /E/ returns 103)
    //    REMOVE /E/1/ — remove if found
    //    REQUEST_SYNCHRONIZATION (QUERY 13) — flush internal state
    const buildGet = (path) => {
      const pb = new TextEncoder().encode(path);
      const proto = new Uint8Array([0x08, 0x00, 0x12, pb.length, ...pb]);
      return new Uint8Array([proto.length & 0xFF, (proto.length >> 8) & 0x7F, ...proto]);
    };
    const buildRemove = (path) => {
      const pb = new TextEncoder().encode(path);
      const proto = new Uint8Array([0x08, 0x03, 0x12, pb.length, ...pb]);
      return new Uint8Array([proto.length & 0xFF, (proto.length >> 8) & 0x7F, ...proto]);
    };

    // Check root filesystem and pre-clean existing exercise directories
    // H10 blocks startRecording (106) if any exercise dir exists — must remove first
    // IMPORTANT: REMOVE on non-empty dir → 103 ("not empty") — delete files first!
    log('--- Filesystem-Check + Pre-Cleanup ---');
    let isZombie = false;
    try {
      const rootR = await send('get/', Array.from(buildGet('/')));
      if (rootR.ok) {
        const rootBytes = rootR.data;
        log(`  GET / → ${rootBytes.length}b: [${Array.from(rootBytes.slice(0,32)).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
        // Parse directory entries looking for exercise dirs (numeric names like "1/")
        const hasDirEntry = new TextDecoder().decode(rootBytes).includes('1/');
        if (hasDirEntry) {
          // Check if dir has real data or is zombie (zombie = GET /1/ returns 103)
          const probe = await send('get/1/', Array.from(buildGet('/1/')));
          if (probe.ok && probe.data.length > 4) {
            log('  /1/ hat Inhalt — lösche Dateien vor REMOVE:');
            for (const f of ['SAMPLES.BPB', 'RR.BIN', 'AUTO.BIN', '00000000.BIN', 'SAMPLES.GZ']) {
              try {
                const rf = await send(`rm/1/${f}`, Array.from(buildRemove(`/1/${f}`)));
                if (rf.ok) log(`    ✓ REMOVE /1/${f}`);
              } catch {}
            }
            const rmDir = await send('rm/1/', Array.from(buildRemove('/1/')));
            log(`  REMOVE /1/ → ${rmDir.ok ? '✓ OK' : `✗ errorCode=${rmDir.errorCode}`}`);
          } else if (probe.errorCode === 103) {
            isZombie = true;
            log('  ZOMBIE erkannt: /1/ in Root-Liste aber GET /1/ → 103 (korrupter Eintrag)');
          }
        } else {
          log('  / → kein Exercise-Verzeichnis, sauber ✓');
        }
      }
    } catch (e) { log(`  Filesystem-Check: ${e.message}`); }
    await new Promise(r => setTimeout(r, 300));

    // 4. Start recording (QUERY 14 = 0x0E)
    //
    // recording_interval = SAMPLE INTERVAL in seconds (1 or 5), NOT total duration.
    // SDK: PbDuration.newBuilder().setSeconds(INTERVAL_1S.value=1) → PbDuration.seconds=1
    // H10 returns 106 if same exerciseId already exists on device → always clean up first.
    const variants = [
      // Primary: RR 1s + id="1" (after cleanup above)
      { label: 'RR 1s + id="1"',  bytes: [0x0e, 0x80, 0x08, 0x10, 0x12, 0x02, 0x18, 0x01, 0x1a, 0x01, 0x31] },
      // Fallback: fresh id="2" (in case id="1" is still somehow blocked)
      { label: 'RR 1s + id="2"',  bytes: [0x0e, 0x80, 0x08, 0x10, 0x12, 0x02, 0x18, 0x01, 0x1a, 0x01, 0x32] },
      // HR variant: sampleType=HR(1), in case RR needs ECG contact that we don't have
      { label: 'HR 1s + id="1"',  bytes: [0x0e, 0x80, 0x08, 0x01, 0x12, 0x02, 0x18, 0x01, 0x1a, 0x01, 0x31] },
      // RR minimal (no id)
      { label: 'RR 1s no id',     bytes: [0x0e, 0x80, 0x08, 0x10, 0x12, 0x02, 0x18, 0x01] },
    ];

    let startOk = false;
    for (const v of variants) {
      log(`--- startRecording variant: ${v.label} ---`);
      let result = null;
      try {
        result = await send(`startRec(${v.label})`, v.bytes);
      } catch (e) {
        log(`  variant timeout/error: ${e.message}`);
      }

      // Whether or not we got a response, check recording status immediately
      log('  Prüfe recordingStatus nach Versuch…');
      await new Promise(r => setTimeout(r, 500));
      let statusResult = null;
      try {
        statusResult = await send('recStatus?', [0x10, 0x80]);
        const proto = statusResult.data;
        // parse field1 (recording bool) from proto bytes
        const recording = proto.length >= 2 && proto[0] === 0x08 && proto[1] !== 0x00;
        log(`  recordingStatus: recording=${recording} (${Array.from(proto).map(b=>b.toString(16).padStart(2,'0')).join(' ')})`);
        if (recording) { startOk = true; break; }
      } catch (e) {
        log(`  recordingStatus check failed: ${e.message}`);
      }
      if (result?.ok) { startOk = true; break; }
    }

    if (isZombie) {
      log('');
      log('━━━ ZOMBIE-ZUSTAND ERKANNT ━━━');
      log('/1/ in Root-Liste, aber GET /1/ → 103: korrupter Flash-Filesystem-Eintrag.');
      log('Dateien sind nicht zugänglich, REMOVE scheitert → Factory Reset einzige Lösung.');
      log('');
      log('▶ Polar Flow App → H10 → Einstellungen → Werkseinstellungen zurücksetzen');
      log('  Danach: Windows BT-Kopplung erneuern → Polar Flow schließen → Test erneut');
    } else if (startOk) {
      log('★★★ startRecording WORKED! ★★★');
      // H10 only writes RR data to flash in autonomous mode (BLE disconnected).
      // While BLE stays connected, data stays in RAM → exercise directory remains empty.
      // Production flow: startRecording → disconnect → H10 records autonomously → reconnect → stop → download
      log('Trenne BLE — H10 nimmt jetzt autonom auf…');
      device.gatt.disconnect();
      await new Promise(r => setTimeout(r, 500));

      const autoMinutes = 3;
      log(`H10 nimmt ${autoMinutes} Minuten autonom auf (BLE getrennt) …`);
      for (let i = autoMinutes * 60; i > 0; i -= 30) {
        await new Promise(r => setTimeout(r, 30000));
        log(`  … noch ${i - 30}s`);
      }

      // Reconnect
      log('Reconnect für stopRecording…');
      let reconnServer = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          reconnServer = await device.gatt.connect();
          await new Promise(r => setTimeout(r, attempt * 700));
          if (reconnServer.connected) break;
        } catch (e) { log(`  Reconnect ${attempt}: ${e.message}`); }
      }
      if (!reconnServer?.connected) throw new Error('Reconnect für stopRecording fehlgeschlagen');

      const reconnSvc  = await reconnServer.getPrimaryService('0000feee-0000-1000-8000-00805f9b34fb');
      const reconnCmd  = await reconnSvc.getCharacteristic('fb005c51-02e7-f387-1cad-8acd2d8df0c8');
      const reconnD2h  = await reconnSvc.getCharacteristic('fb005c52-02e7-f387-1cad-8acd2d8df0c8');
      await reconnCmd.startNotifications();
      await reconnD2h.startNotifications();
      log('✓ Reconnect OK');

      // Replace send() to use reconnected chars, with proper MORE/LAST accumulation
      const sendR = async (label, payloadBytes) => {
        const pkt = new Uint8Array([0x02, ...payloadBytes]);
        log(`TX ${label} → FB005C51: [${Array.from(pkt).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
        const chunks = [];
        const p = new Promise((res, rej) => {
          const t = setTimeout(() => { reconnCmd.removeEventListener('characteristicvaluechanged', h); rej(new Error('timeout')); }, 15000);
          function h(e) {
            const raw = new Uint8Array(e.target.value.buffer);
            const status = (raw[0] >> 1) & 0x03;
            log(`  RX 51: [${Array.from(raw.slice(0,32)).map(b=>b.toString(16).padStart(2,'0')).join(' ')}${raw.length>32?'…':''} len=${raw.length}] status=${status}`);
            if (status === 3) {
              // MORE: accumulate this chunk, keep listening
              chunks.push(raw.slice(1));
            } else if (status === 1) {
              // LAST: accumulate + done
              chunks.push(raw.slice(1));
              reconnCmd.removeEventListener('characteristicvaluechanged', h);
              clearTimeout(t);
              const total = chunks.reduce((a,c)=>a+c.length,0);
              const combined = new Uint8Array(total);
              let off = 0; for (const c of chunks) { combined.set(c, off); off += c.length; }
              res({ ok: true, errorCode: 0, data: combined });
            } else if (status === 0) {
              // ERROR/ACK
              reconnCmd.removeEventListener('characteristicvaluechanged', h);
              clearTimeout(t);
              const ec = (raw[1]??0)|((raw[2]??0)<<8);
              res({ ok: ec===0, errorCode: ec, data: new Uint8Array(0) });
            }
          }
          reconnCmd.addEventListener('characteristicvaluechanged', h);
          reconnCmd.writeValueWithoutResponse(pkt);
        });
        const r = await p;
        log(`  → errorCode=${r.errorCode} data=${r.data.length}b ${r.ok?'✓':'✗'}`);
        return r;
      };

      log('--- stopRecording (id=15) ---');
      try { await sendR('stop', [0x0f, 0x80]); } catch (e) { log(`stop: ${e.message}`); }
      await new Promise(r => setTimeout(r, 3000));
      // Exercises are stored at ROOT level (/1/, /2/, etc.), NOT under /E/
      log('--- GET / after stop (root listing, via reconnected chars) ---');
      try {
        const rootResult = await sendR('listRoot', Array.from(buildGet('/')));
        if (rootResult.ok && rootResult.data.length > 0) {
          log(`GET / → ${rootResult.data.length}b`);
          log(`  raw: [${Array.from(rootResult.data.slice(0,48)).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
          // Parse PbPFtpDirectory to find exercise directories (names ending with /)
          const dirs = [];
          let i = 0;
          const bytes = rootResult.data;
          while (i < bytes.length) {
            const tag = bytes[i++];
            if ((tag & 0x07) !== 2) { while (i < bytes.length && (bytes[i++] & 0x80)); continue; }
            const outerLen = bytes[i++];
            const outerEnd = i + outerLen;
            let name = '', size = 0;
            while (i < outerEnd) {
              const innerTag = bytes[i++];
              const innerField = innerTag >>> 3;
              if ((innerTag & 0x07) === 2) {
                const sLen = bytes[i++]; const sb = bytes.slice(i, i+sLen); i += sLen;
                if (innerField === 1) name = new TextDecoder().decode(Uint8Array.from(sb));
              } else if ((innerTag & 0x07) === 0) {
                let v = 0, sh = 0;
                while (i < outerEnd) { const b = bytes[i++]; v |= (b&0x7f)<<sh; if(!(b&0x80)) break; sh+=7; }
                if (innerField === 2) size = v;
              } else { i++; }
            }
            i = outerEnd;
            log(`  Eintrag: "${name}" size=${size}`);
            if (name.endsWith('/') && !['DEVICE.BPB','ERRORLOG.BPB'].some(f => name.startsWith(f))) dirs.push(name.replace(/\/$/, ''));
          }

          if (dirs.length === 0) {
            log('Keine Exercise-Verzeichnisse in / — H10 hat nach 3 Minuten autonomer Aufnahme noch nichts auf Flash geschrieben.');
            log('→ Prüfe /1/ direkt:');
            try {
              const probe1 = await sendR('get/1/', Array.from(buildGet('/1/')));
              log(`  GET /1/: errorCode=${probe1.errorCode} data=${probe1.data.length}b ${probe1.ok?'✓ EXISTS':'✗'}`);
              if (probe1.ok && probe1.data.length > 0) {
                log(`    raw: [${Array.from(probe1.data).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
              }
            } catch (e) { log(`  GET /1/: ${e.message}`); }
          } else {
            for (const dir of dirs) {
              const fullPath = `/${dir}/`;
              log(`--- Lese Exercise: ${fullPath} ---`);
              // List directory contents first
              try {
                const dl = await sendR(`list${fullPath}`, Array.from(buildGet(fullPath)));
                if (dl.ok && dl.data.length > 0) {
                  log(`  Verzeichnis-Inhalt (${dl.data.length}b): [${Array.from(dl.data).map(b=>b.toString(16).padStart(2,'0')).join(' ')}]`);
                } else {
                  log(`  Verzeichnis leer (errorCode=${dl.errorCode})`);
                }
              } catch (e) { log(`  Listing ${fullPath}: ${e.message}`); }

              let rrDownloaded = 0;
              for (const fname of ['SAMPLES.BPB', 'RR.BIN', 'AUTO.BIN', '00000000.BIN', 'SAMPLES.GZ']) {
                const filePath = `${fullPath}${fname}`;
                try {
                  const fr = await sendR(`get${filePath}`, Array.from(buildGet(filePath)));
                  log(`  ${fname}: errorCode=${fr.errorCode} size=${fr.data.length}b ${fr.ok?'✓':''}`);
                  if (fr.ok && fr.data.length > 4) {
                    const { parseExerciseData } = await import('./ble/polar_pmd.js');
                    const rr = parseExerciseData(fr.data);
                    if (rr.length > 10) {
                      const avg = Math.round(rr.reduce((a,b)=>a+b,0)/rr.length);
                      const bpm = Math.round(60000/avg);
                      log(`  ★★★ ${rr.length} RR-Werte: [${rr.slice(0,10).join(', ')}] ms — Ø ${avg}ms = ${bpm}bpm`);
                      rrDownloaded = rr.length;
                      break; // SAMPLES.BPB has the data — skip remaining filenames
                    }
                  }
                } catch (e) { log(`  ${fname}: ${e.message}`); }
              }

              // REMOVE: H10 requires files deleted before directory (no recursive REMOVE)
              // Error 103 from REMOVE /1/ = "directory not empty", not "not found"
              log(`--- REMOVE Dateien in ${fullPath} ---`);
              for (const fname of ['SAMPLES.BPB', 'RR.BIN', 'AUTO.BIN', '00000000.BIN', 'SAMPLES.GZ']) {
                try {
                  const rf = await sendR(`rm${fullPath}${fname}`, Array.from(buildRemove(`${fullPath}${fname}`)));
                  if (rf.ok) log(`  ✓ REMOVE ${fname}`);
                  // 103 = file doesn't exist — ignore
                } catch {}
              }
              log(`--- REMOVE Verzeichnis ${fullPath} ---`);
              try {
                const rm = await sendR(`removeDir${fullPath}`, Array.from(buildRemove(fullPath)));
                if (rm.ok) {
                  log(`  ✓ REMOVE ${fullPath} OK — H10 bereit für nächste Aufzeichnung`);
                } else {
                  log(`  ✗ REMOVE ${fullPath} → errorCode=${rm.errorCode}`);
                }
              } catch (e) { log(`  REMOVE dir: ${e.message}`); }

              // Verify: GET / should no longer contain exercise dir
              try {
                const verify = await sendR('verify GET /', Array.from(buildGet('/')));
                if (verify.ok) {
                  const hasDir = new TextDecoder().decode(verify.data).includes('1/');
                  log(`  GET / nach REMOVE: ${hasDir ? '✗ 1/ noch vorhanden!' : '✓ 1/ entfernt — clean state'}`);
                }
              } catch (e) { log(`  Verify: ${e.message}`); }
            }
          }
        } else {
          log(`GET / → errorCode=${rootResult.errorCode} — kein Inhalt`);
        }
      } catch (e) { log(`GET /: ${e.message}`); }
    } else {
      log('✗ startRecording fehlgeschlagen — unbekannter Grund (kein Zombie erkannt).');
      log('Prüfe: Polar Flow App vollständig schließen? H10 korrekt anlegen (LED blinkt)?');
    }

  } catch (err) {
    log(`✗ ${err.message}`);
    console.error('[psftp-correct]', err);
  } finally {
    try { device?.gatt?.disconnect(); } catch {}
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = lines.join('\n');
  }
}

// --- Connected recording test (diagnoses BLE-disconnect vs. command issue) ---
async function connectedRecordingTest() {
  const statusEl = document.getElementById('offline-status');
  const btn = document.getElementById('btn-connected-rec-test');
  if (btn) btn.disabled = true;

  const lines = [];
  function log(msg) {
    console.log(msg);
    lines.push(msg);
    if (statusEl) { statusEl.textContent = lines.slice(-3).join(' | '); statusEl.classList.remove('hidden'); }
  }

  const session = new PFTPSession();
  try {
    log('Verbinde…');
    await session.connect();
    log('Verbunden. Starte Aufzeichnung (BLE bleibt offen)…');

    // Use a fixed short ID for easier probing
    const exerciseId = 'TEST0001';
    // Use the session's internal send method with the proto builder
    const { buildStartRecordingCmd } = await import('./ble/polar_pmd.js');
    const startResp = await session.sendCommand(buildStartRecordingCmd(exerciseId));
    const startCode = Array.from(new Uint8Array(startResp)).pop();
    log(`startRecording → code=0x${startCode.toString(16)} ${startCode === 2 ? '✓ OK' : '✗ FAIL'}`);

    // Immediately check /R/ status while still connected
    log('GET /R/ (während verbunden)…');
    const rStatus1 = await session.rawProbe('/R/');
    log(`/R/ direkt nach Start: [${rStatus1.hex}] — ${rStatus1.length > 3 ? 'HAT INHALT!' : '3-byte ACK'}`);

    log('Warte 30 Sekunden…');
    await new Promise(r => setTimeout(r, 30000));

    // Check /R/ status again after 30s
    const rStatus2 = await session.rawProbe('/R/');
    log(`/R/ nach 30s: [${rStatus2.hex}] — ${rStatus2.length > 3 ? 'HAT INHALT!' : '3-byte ACK'}`);

    // Stop recording
    log('Stoppe Aufzeichnung…');
    await session.stopRecording();
    await new Promise(r => setTimeout(r, 3000));

    // List exercises
    const exercises = await session.listExercises();
    log(`/E/ nach Stop: [${exercises.join(', ') || 'leer'}]`);

    // Probe the exerciseId path
    const probe = await session.rawProbe(`/E/${exerciseId}/`);
    log(`/E/${exerciseId}/: [${probe.hex}] — ${probe.length > 3 ? '✓ GEFUNDEN!' : 'leer'}`);

    // Also probe /E/1/
    const probe1 = await session.rawProbe('/E/1/');
    log(`/E/1/: [${probe1.hex}] — ${probe1.length > 3 ? '✓ GEFUNDEN!' : 'leer'}`);

  } catch (err) {
    log(`✗ Fehler: ${err.message}`);
    console.error('[connected rec test]', err);
  } finally {
    session.disconnect();
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = lines.join('\n');
  }
}

// --- Recording button state ---
function updateRecordingButtons() {
  const btnStart = document.getElementById('btn-start-recording');
  const btnSync  = document.getElementById('btn-sync');
  if (!btnStart || !btnSync) return;
  if (offlineRecordingActive) {
    btnStart.className = 'btn btn--secondary';
    btnSync.className  = 'btn btn--primary';
  } else {
    btnStart.className = 'btn btn--primary';
    btnSync.className  = 'btn btn--secondary';
  }
}

// --- Teardown ---
function stopActiveSession() {
  activeGenerator?.stop();
  activeGenerator = null;
  activeLiveSession?.disconnect();
  activeLiveSession = null;
  activeSessionId = null;
  rrBuffer.length = 0;
  ecgLiveBuffer.length = 0;
  prevRR = null;
  if (!offlineRecordingActive) setBLEStatus('off');
}
