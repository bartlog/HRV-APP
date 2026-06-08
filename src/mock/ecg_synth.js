/**
 * Synthetic ECG at 130 Hz using Gaussian P+QRS+T morphology.
 * QRS amplitude modulated ±10% by breathing phase → enables EDR.
 */
export const ECG_SAMPLE_RATE = 130;

function gaussian(tArr, centerMs, amplitudeUv, sigmaMs) {
  return tArr.map(t => amplitudeUv * Math.exp(-0.5 * ((t - centerMs) / sigmaMs) ** 2));
}

export class ECGSynth {
  constructor({ breathingRateHz = 0.25 } = {}) {
    this._breathHz = breathingRateHz;
    this._t0 = performance.now();
  }

  /** Returns Int16Array of ECG samples for one heartbeat of rrMs duration. */
  nextBeat(rrMs) {
    const nSamples = Math.max(1, Math.round(rrMs * ECG_SAMPLE_RATE / 1000));
    const tArr = Array.from({ length: nSamples }, (_, i) => (i / ECG_SAMPLE_RATE) * 1000);
    const rOffset = rrMs * 0.45;

    const t = (performance.now() - this._t0) / 1000;
    const phase = 2 * Math.PI * this._breathHz * t;
    const qrsAmp = 800 * (1 + 0.1 * Math.sin(phase));

    const ecg = new Float32Array(nSamples);
    const waves = [
      gaussian(tArr, rOffset - 160, 150, 20),   // P wave
      gaussian(tArr, rOffset - 12, -200, 5),     // Q notch
      gaussian(tArr, rOffset, qrsAmp, 8),         // R peak
      gaussian(tArr, rOffset + 12, -150, 5),      // S notch
      gaussian(tArr, rOffset + 200, 300, 35),     // T wave
    ];
    for (const wave of waves) {
      for (let i = 0; i < nSamples; i++) ecg[i] += wave[i];
    }
    // Add baseline noise
    for (let i = 0; i < nSamples; i++) {
      ecg[i] += this._gaussNoise(20);
    }

    return Int16Array.from(ecg);
  }

  _gaussNoise(sigma) {
    const u = 1 - Math.random();
    const v = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
