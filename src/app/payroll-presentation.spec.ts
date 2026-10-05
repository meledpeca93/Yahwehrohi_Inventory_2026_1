import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';

vi.mock('chart.js', () => {
  class MockChart {
    static register = vi.fn();
    data: { labels: unknown[]; datasets: Array<Record<string, unknown>> };
    options: Record<string, unknown>;
    update = vi.fn();
    resize = vi.fn();
    destroy = vi.fn();

    constructor(_canvas: unknown, config: { data?: { labels?: unknown[]; datasets?: Array<Record<string, unknown>> }; options?: Record<string, unknown> } = {}) {
      this.data = {
        labels: config.data?.labels || [],
        datasets: config.data?.datasets || [],
      };
      this.options = config.options || {};
    }
  }

  return {
    ArcElement: class {},
    BarController: class {},
    BarElement: class {},
    CategoryScale: class {},
    Chart: MockChart,
    Filler: class {},
    Legend: class {},
    LineController: class {},
    LineElement: class {},
    LinearScale: class {},
    PieController: class {},
    PointElement: class {},
    Tooltip: class {},
  };
});

describe('Payroll presentation', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function setup() {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({ users: [] });
    const app = fixture.componentInstance as any;
    const groups = Array.from({ length: 26 }, (_, i) => ({
      user: { id: i + 1, name: i === 25 ? 'José Álvarez' : 'Empleado ' + i, role: 'Caja', area: 'Ventas' },
      weeks: [{ key: 'week-' + i, bonus: 12, grandTotal: i + 112, days: [] }],
      accumulatedSubtotal: i + 100, accumulatedBonus: 12, accumulatedTotal: i + 112,
    }));
    app.payrollUserGroups = signal(groups);
    return { app, groups };
  }
  it('searches all employees and preserves full weekly details outside the first page', () => {
    const { app, groups } = setup();
    const table = app.modalTables, rows = app.payrollHistoryRows(), config = app.payrollHistoryConfig;
    expect(table.pageRows('payrollHistory', rows, config)).toHaveLength(10);
    expect(table.pages('payrollHistory', rows, config)).toBe(3);
    table.go('payrollHistory', 3, rows, config);
    expect(table.pageRows('payrollHistory', rows, config)).toHaveLength(6);
    table.input('payrollHistory', 'search', { target: { value: 'jose alvarez' } });
    const filtered = table.pageRows('payrollHistory', rows, config);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].weeks).toBe(groups[25].weeks);
    expect(table.current('payrollHistory', rows, config)).toBe(1);
    expect(app.payrollUserGroups()).toHaveLength(26);
  });
  it('sorts numerically and exports selected totals without changing payroll or expansion', () => {
    const { app, groups } = setup();
    const before = JSON.stringify(groups);
    const table = app.modalTables, rows = app.payrollHistoryRows(), config = app.payrollHistoryConfig;
    table.sort('payrollHistory', 'accumulatedTotal');
    table.sort('payrollHistory', 'accumulatedTotal');
    expect(table.pageRows('payrollHistory', rows, config)[0].id).toBe(26);
    table.toggle('payrollHistory', rows[25]);
    table.patch('payrollHistory', { search: 'Empleado 0', density: 'compact' });
    expect(table.csv('payrollHistory', rows, config)).toContain('José Álvarez');
    expect(table.selectedRows('payrollHistory', rows)).toHaveLength(1);
    expect(JSON.stringify(groups)).toBe(before);
    expect(app.payrollExpandedUserIds()).toEqual([]);
  });
  it('starts collapsed and resets opened panels when entering again', () => {
    const { app } = setup();
    expect(app.payrollSummaryCollapsed()).toBe(true);
    app.payrollSummaryCollapsed.set(false);
    expect(app.payrollOverviewCollapsed()).toBe(true);
    app.payrollOverviewCollapsed.set(false);
    expect(app.payrollGenerationSummaryCollapsed()).toBe(true);
    app.payrollGenerationSummaryCollapsed.set(false);
    app.payrollExpandedUserIds.set([1]);
    app.payrollExpandedMonthKeys.set([1]);
    app.payrollExpandedWeekKeys.set([1]);
    vi.spyOn(app, 'loadPageData').mockImplementation(() => {});
    vi.spyOn(app, 'selectLatestPayrollWeekWithData').mockImplementation(() => {});
    vi.spyOn(app, 'scheduleVisibleChartsRefresh').mockImplementation(() => {});
    app.setPage('payroll');
    expect(app.payrollSummaryCollapsed()).toBe(true);
    expect(app.payrollOverviewCollapsed()).toBe(true);
    expect(app.payrollGenerationSummaryCollapsed()).toBe(true);
    expect(app.payrollExpandedUserIds()).toEqual([]);
    expect(app.payrollExpandedMonthKeys()).toEqual([]);
    expect(app.payrollExpandedWeekKeys()).toEqual([]);
  });

});
