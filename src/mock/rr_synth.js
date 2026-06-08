/**
 * Synthetic RR-interval generator.
 * Baseline 800 ms (75 bpm) + RSA modulation + Gaussian noise.
 * RMSSD ≈ 40-60 ms at rest; stress scenario: baseline 650 ms.
 */
export class RRSynth {
  constructor({
    heartRateBpm = 75,
    rmssdTargetMs = 50,
    breathingRateHz = 0.25,
    stressScenario = false,
  } = {}) {
    this._baseRR = stressScenario ? 650 : 60000 / heartRateBpm;
    this._rsaAmp = stressScenario ? 20 : rmssdTargetMs * 0.8;
    this._breathHz = breathingRateHz;
    this._t0 = performance.now();
  }

  nextRR() {
    const t = (performance.now() - this._t0) / 1000;
    const rsa = this._rsaAmp * Math.sin(2 * Math.PI * this._breathHz * t);
    const noise = this._gaussNoise(15);
    return Math.max(300, Math.min(2000, this._baseRR + rsa + noise));
  }

  _gaussNoise(sigma) {
    // Box-Muller transform
    const u = 1 - Math.random();
    const v = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
