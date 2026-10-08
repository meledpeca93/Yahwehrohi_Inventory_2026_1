import type { Plugin } from 'chart.js';

/** Read the selected theme from each chart's own application shell. */
export const chartThemePlugin: Plugin = {
  id: 'inventoryTheme',
  beforeUpdate(chart) {
    const shell = chart.canvas.closest('.app-shell[data-theme]');
    if (!shell) return;
    const style = getComputedStyle(shell);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    // Mutate raw options, not Chart.js context-resolving option proxies.
    const options = chart.config?.options || chart.options;
    const text = token('--yr-text', '#20343f');
    const muted = token('--yr-text-muted', '#536a76');
    const border = token('--yr-border', '#cbd8df');
    for (const scale of Object.values(options.scales || {})) {
      if (!scale) continue;
      scale.ticks = { ...scale.ticks, color: muted };
      if ('border' in scale) scale.border = { ...scale.border, color: border };
      if (scale.grid?.color !== 'transparent') scale.grid = { ...scale.grid, color: border };
    }
    const plugins = options.plugins || (options.plugins = {});
    if (plugins.legend) plugins.legend.labels = { ...plugins.legend.labels, color: muted };
    if (plugins.tooltip) Object.assign(plugins.tooltip, {
      backgroundColor: token('--yr-surface-elevated', '#edf3f5'),
      titleColor: text, bodyColor: text, borderColor: border, borderWidth: 1,
    });
  },
};
