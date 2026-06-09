/**
 * Time-domain HRV metrics: RMSSD and SDNN.
 * Input: Float64Array of RR intervals in milliseconds.
 * Returns NaN if fewer than 2 intervals provided.
 */

export function rmssd(rrArray) {
  if (rrArray.length < 2) return NaN;
  let sumSq = 0;
  for (let i = 1; i < rrArray.length; i++) {
    sumSq += (rrArray[i] - rrArray[i - 1]) ** 2;
  }
  return Math.sqrt(sumSq / (rrArray.length - 1));
}

export function sdnn(rrArray) {
  if (rrArray.length < 2) return NaN;
  const mean = rrArray.reduce((a, b) => a + b, 0) / rrArray.length;
  const variance = rrArray.reduce((sum, rr) => sum + (rr - mean) ** 2, 0) / rrArray.length;
  return Math.sqrt(variance);
}

export function median(arr) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
