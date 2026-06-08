import { db } from '../storage/db.js';

/**
 * Download session data as CSV.
 * Two sections: raw RR intervals + windowed HRV metrics (300-beat windows).
 */
export async function exportSessionCSV(sessionId) {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session nicht gefunden');

  const rrRows = await db.rrIntervals
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp');

  const metricRows = await db.hrvMetrics
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp');

  const startDate = new Date(session.startTime);
  const durationH = session.durationH ?? '—';
  const rrCount = rrRows.length;

  const lines = [];

  // Header comments
  lines.push(`# HRV Monitor — Session Export`);
  lines.push(`# Datum: ${startDate.toLocaleString('de-DE')}`);
  lines.push(`# Dauer: ${durationH} h`);
  lines.push(`# RR-Intervalle: ${rrCount}`);
  lines.push(`# Export: ${new Date().toISOString()}`);
  lines.push(`#`);

  // Section 1: RR intervals
  lines.push(`# === RR-Intervalle ===`);
  lines.push(`timestamp_iso,timestamp_ms,rr_ms,artifact`);
  for (const row of rrRows) {
    const iso = new Date(row.timestamp).toISOString();
    lines.push(`${iso},${row.timestamp},${row.rrMs},${row.artifactFlag ? 1 : 0}`);
  }

  lines.push(`#`);

  // Section 2: windowed HRV metrics
  lines.push(`# === HRV-Fenster (je 300 Schläge) ===`);
  lines.push(`timestamp_iso,timestamp_ms,rmssd_ms,sdnn_ms,stress_index`);
  for (const m of metricRows) {
    const iso = new Date(m.timestamp).toISOString();
    const si = isNaN(m.si) ? '' : Math.round(m.si);
    lines.push(`${iso},${m.timestamp},${Math.round(m.rmssd)},${Math.round(m.sdnn)},${si}`);
  }

  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const isoDate = startDate.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const filename = `hrv_session_${isoDate}.csv`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
