import { applyDashboardChartDesign } from './dashboard-chart-design';
import { chartThemePlugin } from '../shared/theme/chart-theme';

describe('Dashboard financial chart design', () => {
  function chart(premium = true): any {
    return {
      canvas: { closest: (selector: string) => selector === '.dashboard-premium' && premium ? {} : null, dataset: {} },
      options: { plugins: { tooltip: { callbacks: { label: () => 'L100.00' } } }, scales: { y: { ticks: { callback: () => 'L100' } } } },
      data: { datasets: [{ label: 'Ventas', data: [10, 20] }] },
    };
  }
  it('preserves actual values and currency formatters when applying the light design', () => {
    const target = chart();
    const tooltip = target.options.plugins.tooltip.callbacks.label;
    const ticks = target.options.scales.y.ticks.callback;
    applyDashboardChartDesign(target);
    expect(target.data.datasets[0].data).toEqual([10, 20]);
    expect(target.data.datasets[0].pointRadius).toBe(3);
    expect(target.options.plugins.tooltip.callbacks.label).toBe(tooltip);
    expect(target.options.scales.y.ticks.callback).toBe(ticks);
    expect(target.canvas.dataset.premiumDashboard).toBe('true');
    expect(target.options.plugins.tooltip.backgroundColor).toBe('#ffffff');
    expect(target.options.scales.y.ticks.color).toBe('#526a78');
  });
  it('leaves charts outside the financial Dashboard cards untouched', () => {
    const target = chart(false);
    const before = JSON.stringify(target.options);
    applyDashboardChartDesign(target);
    expect(JSON.stringify(target.options)).toBe(before);
    expect(target.canvas.dataset.premiumDashboard).toBeUndefined();
  });
  it('uses luminous series and readable labels/tooltips on dark surfaces', () => {
    const target = chart();
    applyDashboardChartDesign(target, true);
    expect(target.options.plugins.tooltip.backgroundColor).toBe('#222e3c');
    expect(target.options.scales.y.ticks.color).toBe('#b4c5d2');
    expect(target.data.datasets[0].borderColor).toBe('#75dbc6');
    expect(target.data.datasets[0].data).toEqual([10, 20]);
  });
  it('applies shared theme tokens without removing currency callbacks', () => {
    const shell = document.createElement('main');
    shell.className = 'app-shell';shell.dataset['theme'] = 'yr-dark';
    shell.style.setProperty('--yr-text', '#edf3f8');
    shell.style.setProperty('--yr-text-muted', '#b4c5d2');
    shell.style.setProperty('--yr-surface-elevated', '#293747');
    const canvas = document.createElement('canvas');shell.append(canvas);document.body.append(shell);
    try {
      const target = chart();target.canvas = canvas;
      const callback = target.options.plugins.tooltip.callbacks.label;
      chartThemePlugin.beforeUpdate!(target, { mode: 'default', cancelable: true }, {});
      expect(target.options.scales.y.ticks.color).toBe('#b4c5d2');
      expect(target.options.plugins.tooltip.backgroundColor).toBe('#293747');
      expect(target.options.plugins.tooltip.callbacks.label).toBe(callback);
    } finally { shell.remove(); }
  });
});
