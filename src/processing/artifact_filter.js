/**
 * RR artifact filtering:
 * 1. Physiological bounds: 300–2000 ms
 * 2. Local consistency: ±20% change from previous RR
 */
export function filterRR(rrMs, prevRR = null) {
  if (rrMs < 300 || rrMs > 2000) return null;
  if (prevRR !== null && Math.abs(rrMs - prevRR) / prevRR > 0.2) return null;
  return rrMs;
}

export function filterBuffer(rrArray) {
  const out = [];
  for (let i = 0; i < rrArray.length; i++) {
    const filtered = filterRR(rrArray[i], i > 0 ? out[out.length - 1] ?? null : null);
    if (filtered !== null) out.push(filtered);
  }
  return out;
}
