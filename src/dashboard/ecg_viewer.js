/**
 * ECG viewer: draws a 10s window of ECG samples on a <canvas> element.
 * Reads from an array buffer — no Chart.js overhead needed for 1300 points.
 */
export const ECG_WINDOW_SAMPLES = 1300; // 10s @ 130Hz

export class ECGViewer {
  constructor(canvasId) {
    this._canvas = document.getElementById(canvasId);
    this._ctx = this._canvas?.getContext('2d') ?? null;
    this._samples = null;
  }

  /** Draw a live beat-by-beat ECG buffer (real-time mode). */
  drawLive(sampleBuffer) {
    this._samples = sampleBuffer;
    this._render();
  }

  /** Draw a stored chunk from IndexedDB (session review mode). */
  drawChunk(int16Array) {
    this._samples = int16Array;
    this._render();
  }

  _render() {
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!ctx || !this._samples || this._samples.length < 2) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    // Canvas has 0 size when inside a hidden tab — skip rendering
    if (W <= 0 || H <= 0) return;
    canvas.width = W;
    canvas.height = H;

    const samples = this._samples;
    const n = Math.min(samples.length, ECG_WINDOW_SAMPLES);

    // Find range
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < n; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    const range = max - min || 1;
    const padding = H * 0.1;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W;
      const y = padding + ((max - samples[i]) / range) * (H - 2 * padding);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw baseline grid
    ctx.strokeStyle = '#2a2d3e';
    ctx.lineWidth = 0.5;
    for (let g = 1; g < 4; g++) {
      const y = (g / 4) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
}
