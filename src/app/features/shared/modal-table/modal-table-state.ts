import { signal } from '@angular/core';

export interface ModalTableColumn { key: string; label: string; }
export interface ModalTableConfig { columns: ModalTableColumn[]; filterKey?: string; filterLabel?: string; }
export type RowDensity = 'compact' | 'normal' | 'spacious';
interface ViewState {
  search: string; filter: string; page: number; size: number;
  sort: string; direction: 1 | -1; density: RowDensity; selected: Set<string>;
}
const initial = (): ViewState => ({ search: '', filter: '', page: 1, size: 10, sort: '', direction: 1, density: 'normal', selected: new Set() });

/** Presentation-only state. Filtering and selection never mutate source records. */
export class ModalTableState {
  readonly sizes = [10, 25, 50, 100];
  readonly densities: { value: RowDensity; label: string; path: string }[] = [
    { value: 'compact', label: 'Compacta', path: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { value: 'normal', label: 'Normal', path: 'M4 5h16M4 12h16M4 19h16' },
    { value: 'spacious', label: 'Amplia', path: 'M4 6h16M4 18h16' },
  ];
  private readonly views = signal<Record<string, ViewState>>({});
  state(key: string): ViewState { return this.views()[key] ?? initial(); }
  patch(key: string, value: Partial<ViewState>): void { this.views.update(all => ({ ...all, [key]: { ...this.state(key), ...value } })); }
  reset(key: string): void { this.patch(key, initial()); }
  text(value: unknown): string { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  value(row: object, field: string): unknown { return (row as Record<string, unknown>)[field]; }
  id(row: object): string { return String(this.value(row, 'id') ?? this.value(row, 'invoiceId') ?? this.value(row, 'sku') ?? this.value(row, 'productId')); }
  input(key: string, field: 'search' | 'filter' | 'size', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'size') { if (this.sizes.includes(Number(value))) this.patch(key, { size: Number(value), page: 1 }); }
    else this.patch(key, { [field]: value, page: 1 });
  }
  options<T extends object>(rows: readonly T[], field: string): string[] {
    return [...new Set(rows.map(row => String(this.value(row, field) ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }
  filtered<T extends object>(key: string, rows: readonly T[], config?: ModalTableConfig): T[] {
    const state = this.state(key), search = this.text(state.search.trim());
    const filtered = rows.filter(row => (!search || this.text(Object.values(row).filter(v => ['string', 'number'].includes(typeof v)).join(' ')).includes(search)) && (!state.filter || !config?.filterKey || String(this.value(row, config.filterKey) ?? '') === state.filter));
    if (!state.sort) return filtered;
    return filtered.sort((a, b) => {
      const av = this.value(a, state.sort), bv = this.value(b, state.sort);
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'es', { numeric: true, sensitivity: 'base' })) * state.direction;
    });
  }
  pages(key: string, rows: readonly object[], config?: ModalTableConfig): number { return Math.max(1, Math.ceil(this.filtered(key, rows, config).length / this.state(key).size)); }
  current(key: string, rows: readonly object[], config?: ModalTableConfig): number { return Math.min(this.state(key).page, this.pages(key, rows, config)); }
  pageRows<T extends object>(key: string, rows: readonly T[], config?: ModalTableConfig): T[] {
    const all = this.filtered(key, rows, config), size = this.state(key).size;
    const page = Math.min(this.state(key).page, Math.max(1, Math.ceil(all.length / size)));
    return all.slice((page - 1) * size, page * size);
  }
  go(key: string, page: number, rows: readonly object[], config?: ModalTableConfig): void { this.patch(key, { page: Math.max(1, Math.min(page, this.pages(key, rows, config))) }); }
  sort(key: string, field: string): void { const old = this.state(key); this.patch(key, { sort: field, direction: old.sort === field && old.direction === 1 ? -1 : 1, page: 1 }); }
  ariaSort(key: string, field: string): string { const s = this.state(key); return s.sort === field ? (s.direction === 1 ? 'ascending' : 'descending') : 'none'; }
  sortLabel(key: string, field: string): string { const s = this.state(key); return s.sort === field ? (s.direction === 1 ? '↑' : '↓') : '↕'; }
  selected(key: string, row: object): boolean { return this.state(key).selected.has(this.id(row)); }
  toggle(key: string, row: object): void { const ids = new Set(this.state(key).selected), id = this.id(row); ids.has(id) ? ids.delete(id) : ids.add(id); this.patch(key, { selected: ids }); }
  selectedRows<T extends object>(key: string, rows: readonly T[]): T[] { return rows.filter(row => this.selected(key, row)); }
  clear(key: string): void { this.patch(key, { selected: new Set() }); }
  csv(key: string, rows: readonly object[], config: ModalTableConfig): string {
    const cell = (v: unknown) => { const s = String(v ?? ''); return '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"'; };
    return [config.columns.map(c => c.label), ...this.selectedRows(key, rows).map(row => config.columns.map(c => this.value(row, c.key)))].map(row => row.map(cell).join(',')).join('\r\n');
  }
  export(key: string, rows: readonly object[], config: ModalTableConfig): void {
    if (!this.selectedRows(key, rows).length) return;
    const url = URL.createObjectURL(new Blob(['\uFEFF' + this.csv(key, rows, config)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'facturacion-' + key + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
