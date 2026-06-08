/**
 * Synthetic 3-axis ACC at 50 Hz.
 * Baseline: [0, 0, 1000 mg] + Gaussian noise σ=5 mg.
 * Optional motion bursts every 30 s (±500 mg) — tests Body Shock detection.
 */
export const ACC_SAMPLE_RATE = 50;
const BURST_INTERVAL_MS = 30_000;
const BURST_DURATION_MS = 200;

export class ACCSynth {
  constructor({ motionBursts = true } = {}) {
    this._motionBursts = motionBursts;
    this._t0 = performance.now();
    this._lastBurst = this._t0;
  }

  nextSample() {
    const now = performance.now();
    let ax = this._gaussNoise(5);
    let ay = this._gaussNoise(5);
    let az = 1000 + this._gaussNoise(5);

    if (this._motionBursts && (now - this._lastBurst) >= BURST_INTERVAL_MS) {
      if ((now - this._lastBurst) < BURST_INTERVAL_MS + BURST_DURATION_MS) {
        ax += (Math.random() - 0.5) * 1000;
        ay += (Math.random() - 0.5) * 1000;
        az += (Math.random() - 0.5) * 1000;
      } else {
        this._lastBurst = now;
      }
    }

    return [Math.round(ax), Math.round(ay), Math.round(az)];
  }

  _gaussNoise(sigma) {
    const u = 1 - Math.random();
    const v = Math.random();
    return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
