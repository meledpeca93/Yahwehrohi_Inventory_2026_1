import { Chart, Plugin } from 'chart.js';

export const dashboardChartColors = ['#087568', '#8060ae', '#c18a24', '#397cad', '#c26078'];

/** Scoped glow: other canvases retain their original chart settings. */
export const dashboardGlowPlugin: Plugin = {
  id: 'dashboardFinancialGlow',
  beforeDatasetDraw(chart, args) {
    if (chart.canvas.dataset['premiumDashboard'] !== 'true') return;
    chart.ctx.save();
    chart.ctx.shadowColor = String(chart.data.datasets[args.index].borderColor || '#087568');
    chart.ctx.shadowBlur = 4;
    chart.ctx.shadowOffsetY = 0;
  },
  afterDatasetDraw(chart) {
    if (chart.canvas.dataset['premiumDashboard'] === 'true') chart.ctx.restore();
  },
};

export function applyDashboardChartDesign(chart: Chart<'line', number[], string>, dark = chart.canvas.closest('[data-theme="yr-dark"]') !== null): void {
  if (!chart.canvas.closest('.dashboard-premium')) return;
  // Chart.js exposes resolved proxies through chart.options; spreading those
  // evaluates internal scriptable descriptors. Use the raw configuration instead.
  const options = chart.config?.options || chart.options;
  chart.canvas.dataset['premiumDashboard'] = 'true';
  options.interaction = { mode: 'index', intersect: false };
  options.animation = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : { duration: 450 };
  options.layout = { padding: { top: 12, right: 14, bottom: 0, left: 0 } };
  const plugins = options.plugins || (options.plugins = {});
  plugins.legend = { ...plugins.legend, position: 'bottom', labels: {
    color: dark ? '#b4c5d2' : '#526a78', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 18,
    font: { size: 11, weight: 500, family: 'Inter, system-ui, sans-serif' },
  } };
  const oldTooltip = plugins.tooltip || {};
  plugins.tooltip = { ...oldTooltip, backgroundColor: dark ? '#222e3c' : '#ffffff', borderColor: dark ? '#3b4e60' : '#d7e2ea', borderWidth: 1,
    titleColor: dark ? '#edf3f8' : '#203440', bodyColor: dark ? '#b4c5d2' : '#526a78', padding: 12, cornerRadius: 12, displayColors: true,
    titleFont: { size: 12, weight: 500 }, bodyFont: { size: 12, weight: 400 },
  };
  for (const [key, scale] of Object.entries(options.scales || {})) {
    if (!scale) continue;
    scale.border = { ...scale.border, display: false };
    scale.grid = { ...scale.grid, color: key === 'x' ? 'transparent' : dark ? '#ffffff12' : '#e8eef3', drawTicks: false };
    scale.ticks = { ...scale.ticks, color: dark ? '#b4c5d2' : '#526a78', padding: 10, maxTicksLimit: key === 'x' ? 8 : 5,
      font: { size: 10, weight: 400, family: 'Inter, system-ui, sans-serif' },
    };
  }
  chart.data.datasets.forEach((dataset, index) => {
    const colors = dark ? ['#75dbc6', '#c9a8f5', '#f4d677', '#87bbff', '#f49fae'] : dashboardChartColors;
    const color = colors[index % colors.length];
    dataset.borderColor = color;
    dataset.borderWidth = 2;
    dataset.borderDash = [];
    dataset.pointRadius = dataset.data.length <= 2 ? 3 : 0;
    dataset.pointHoverRadius = 5;
    dataset.pointBackgroundColor = color;
    dataset.pointBorderColor = '#ffffff';
    dataset.pointHoverBackgroundColor = color;
    dataset.pointHoverBorderColor = '#ffffff';
    dataset.pointHoverBorderWidth = 2;
    dataset.tension = .36;
    dataset.cubicInterpolationMode = 'monotone';
    dataset.fill = 'origin';
    dataset.backgroundColor = (context) => {
      const area = context.chart.chartArea;
      if (!area) return color + '20';
      const gradient = context.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      gradient.addColorStop(0, color + '3b');
      gradient.addColorStop(.65, color + '0d');
      gradient.addColorStop(1, color + '00');
      return gradient;
    };
  });
}
