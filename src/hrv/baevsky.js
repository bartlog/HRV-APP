/**
 * Baevsky Stress Index: SI = (AMo × 100) / (2 × Mo × VR)
 * Mo  = modal (most frequent) RR interval (histogram peak, 50ms bins)
 * AMo = amplitude of Mo (% of intervals in Mo bin)
 * VR  = variation range = max(RR) - min(RR)
 */
export function baevskySI(rrArray) {
  if (rrArray.length < 10) return NaN;

  const min = Math.min(...rrArray);
  const max = Math.max(...rrArray);
  const vr = max - min;
  if (vr === 0) return NaN;

  const BIN = 50; // ms
  const bins = {};
  for (const rr of rrArray) {
    const b = Math.floor(rr / BIN) * BIN;
    bins[b] = (bins[b] ?? 0) + 1;
  }

  let mo = 0, moCount = 0;
  for (const [b, count] of Object.entries(bins)) {
    if (count > moCount) { moCount = count; mo = +b + BIN / 2; }
  }

  const amo = (moCount / rrArray.length) * 100; // percentage 0-100
  const moSec = mo / 1000;   // modal RR in seconds
  const vrSec = vr / 1000;   // variation range in seconds
  return amo / (2 * moSec * vrSec);
}
