const _entries = [];

export function log(level, msg) {
  _entries.push({ ts: new Date().toISOString(), level, msg });
}

export function exportAsText() {
  const header = [
    '=== HRV-Monitor Diagnose-Log ===',
    `Datum:   ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `URL:     ${location.href}`,
    '='.repeat(40),
    '',
  ].join('\n');
  const body = _entries
    .map(e => `[${e.ts.slice(11, 23)}] [${e.level.toUpperCase().padEnd(5)}] ${e.msg}`)
    .join('\n');
  return header + body;
}

export function clear() { _entries.length = 0; }
