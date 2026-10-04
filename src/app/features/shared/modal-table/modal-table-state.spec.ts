import { describe, expect, it } from 'vitest';
import { ModalTableState, ModalTableConfig } from './modal-table-state';

const config: ModalTableConfig = { columns: [{ key: 'name', label: 'Producto' }, { key: 'amount', label: 'Monto' }], filterKey: 'status', filterLabel: 'Estado' };
const rows = Array.from({ length: 57 }, (_, i) => ({ id: i + 1, name: i === 12 ? 'Café especial' : `Producto ${i + 1}`, amount: 57 - i, status: i % 2 ? 'Activo' : 'Inactivo' }));
const event = (value: string) => ({ target: { value } }) as unknown as Event;

describe('ModalTableState', () => {
  it('combines accent-insensitive search and exact status filtering', () => {
    const view = new ModalTableState();
    view.input('products', 'search', event('CAFE'));
    expect(view.filtered('products', rows, config).map(r => r.id)).toEqual([13]);
    view.input('products', 'filter', event('Activo'));
    expect(view.filtered('products', rows, config)).toEqual([]);
    expect(view.pages('products', rows, config)).toBe(1);
  });
  it('sorts numeric columns both ways without mutating source rows', () => {
    const view = new ModalTableState();
    const original = rows.map(r => r.id);
    view.sort('products', 'amount');
    expect(view.pageRows('products', rows, config)[0].amount).toBe(1);
    view.sort('products', 'amount');
    expect(view.pageRows('products', rows, config)[0].amount).toBe(57);
    expect(rows.map(r => r.id)).toEqual(original);
  });
  it('clamps pages and resets pagination after filter or size changes', () => {
    const view = new ModalTableState();
    view.go('products', 999, rows, config);
    expect(view.current('products', rows, config)).toBe(6);
    expect(view.pageRows('products', rows, config)).toHaveLength(7);
    view.input('products', 'size', event('25'));
    expect(view.current('products', rows, config)).toBe(1);
    expect(view.pageRows('products', rows, config)).toHaveLength(25);
    view.go('products', 3, rows, config);
    expect(view.pageRows('products', rows.slice(0, 1), config)).toHaveLength(1);
    view.input('products', 'size', event('999'));
    expect(view.state('products').size).toBe(25);
  });
  it('keeps selection across pages and isolates table contexts', () => {
    const view = new ModalTableState();
    view.toggle('quote-1', rows[0]); view.toggle('quote-1', rows[25]);
    view.go('quote-1', 2, rows, config);
    expect(view.selectedRows('quote-1', rows)).toHaveLength(2);
    expect(view.selectedRows('quote-2', rows)).toEqual([]);
    view.reset('quote-1');
    expect(view.selectedRows('quote-1', rows)).toEqual([]);
    expect(view.current('quote-1', rows, config)).toBe(1);
  });
  it('escapes CSV quotes, lines and formula-like values', () => {
    const view = new ModalTableState();
    const record = { id: 1, name: '=A1,"texto"\nsegunda línea', amount: 9 };
    view.toggle('export', record);
    expect(view.csv('export', [record], config)).toBe('"Producto","Monto"\r\n"\'=A1,""texto""\nsegunda línea","9"');
  });
  it('has independent densities and resets them with their context', () => {
    const view = new ModalTableState();
    view.patch('cuts', { density: 'compact' });
    expect(view.state('cuts').density).toBe('compact');
    expect(view.state('customers').density).toBe('normal');
    view.reset('cuts');
    expect(view.state('cuts').density).toBe('normal');
  });
  it('does not mutate the full catalog while filtering its preview', () => {
    const view = new ModalTableState();
    view.input('catalog', 'search', event('Café'));
    expect(view.pageRows('catalog', rows, config)).toHaveLength(1);
    expect(rows).toHaveLength(57);
  });
});
