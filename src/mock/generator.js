/**
 * Mock generator — fills RxJS Subjects with synthetic data in real-time.
 * Drop-in replacement for ble/connector.js: identical Subject interface.
 */
import { Subject } from 'rxjs';
import { RRSynth } from './rr_synth.js';
import { ECGSynth, ECG_SAMPLE_RATE } from './ecg_synth.js';
import { ACCSynth, ACC_SAMPLE_RATE } from './acc_synth.js';

export class MockGenerator {
  rrStream$ = new Subject();   // emits: number (RR ms)
  ecgStream$ = new Subject();  // emits: { samples: Int16Array, timestampMs: number }
  accStream$ = new Subject();  // emits: { samples: Int16Array (N*3), timestampMs: number }

  constructor(config = {}) {
    const m = config.mock ?? {};
    this._rr = new RRSynth({
      heartRateBpm: m.heartRateBpm ?? 75,
      rmssdTargetMs: m.rmssdTargetMs ?? 50,
      breathingRateHz: m.breathingRateHz ?? 0.25,
      stressScenario: m.stressScenario ?? false,
    });
    this._ecg = new ECGSynth({ breathingRateHz: m.breathingRateHz ?? 0.25 });
    this._acc = new ACCSynth({ motionBursts: m.motionBursts ?? true });
    this._running = false;
  }

  start() {
    this._running = true;
    this._rrLoop();
    this._accLoop();
  }

  stop() {
    this._running = false;
    this.rrStream$.complete();
    this.ecgStream$.complete();
    this.accStream$.complete();
  }

  async _rrLoop() {
    while (this._running) {
      const rr = this._rr.nextRR();
      this.rrStream$.next(rr);

      const samples = this._ecg.nextBeat(rr);
      this.ecgStream$.next({ samples, timestampMs: performance.now() });

      await this._sleep(rr);
    }
  }

  async _accLoop() {
    const intervalMs = 1000 / ACC_SAMPLE_RATE;
    while (this._running) {
      const [ax, ay, az] = this._acc.nextSample();
      const samples = new Int16Array([ax, ay, az]);
      this.accStream$.next({ samples, timestampMs: performance.now() });
      await this._sleep(intervalMs);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
