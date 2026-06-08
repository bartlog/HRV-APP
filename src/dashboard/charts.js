import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

const CHART_MAX_POINTS = 300; // 5-min rolling window at 1-per-second

function makeChart(canvasId, label, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { labels: { color: '#7c8db0', font: { size: 11 } } },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { color: '#7c8db0', font: { size: 10 }, maxTicksLimit: 6 },
          grid: { color: '#2a2d3e' },
        },
        y: {
          ticks: { color: '#7c8db0', font: { size: 10 } },
          grid: { color: '#2a2d3e' },
        },
      },
    },
  });
}

export class DashboardCharts {
  constructor() {
    this._rmssdChart = makeChart('chart-rmssd', 'RMSSD (ms)', '#4f8ef7');
    this._siChart    = makeChart('chart-si',    'Stress-Index', '#f87171');
  }

  addPoint(timestampMs, rmssd, si) {
    const label = new Date(timestampMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this._push(this._rmssdChart, label, rmssd);
    this._push(this._siChart,    label, si);
  }

  _push(chart, label, value) {
    if (!chart || value == null || isNaN(value)) return;
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(+value.toFixed(2));
    if (chart.data.labels.length > CHART_MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update('none');
  }
}
