import { Chart, BasicPlatform, registerables } from 'chart.js';
import { applyDashboardChartDesign, dashboardGlowPlugin } from './dashboard-chart-design';
import { chartThemePlugin } from '../shared/theme/chart-theme';

describe('Dashboard chart rendering', () => {
  it('updates real Chart.js scales repeatedly in the dark theme', () => {
    Chart.register(...registerables, chartThemePlugin, dashboardGlowPlugin);
    const shell = document.createElement('main');
    shell.className = 'app-shell dashboard-premium';
    shell.dataset['theme'] = 'yr-dark';
    const canvas = document.createElement('canvas');
    canvas.width = 700; canvas.height = 290;
    shell.append(canvas); document.body.append(shell);
    const context = new Proxy({ canvas, measureText: (text: string) => ({ width: String(text).length * 6 }), createLinearGradient: () => ({ addColorStop() {} }), getLineDash: () => [] }, {
      get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
    });
    canvas.getContext = (() => context) as any;
    let chart: Chart<'line', number[], string> | undefined;
    try {
      chart = new Chart(canvas, { type: 'line', platform: BasicPlatform, data: { labels: ['Enero', 'Febrero'], datasets: [{ label: 'Ventas', data: [10, 20] }] }, options: { responsive: false, animation: false } });
      for (let i = 0; i < 3; i++) {
        applyDashboardChartDesign(chart, true);
        chart.update('none');
      }
      expect(chart.getDatasetMeta(0).data.length).toBe(2);
      expect(chart.chartArea.width).toBeGreaterThan(0);
    } finally { chart?.destroy(); shell.remove(); }
  });
});
