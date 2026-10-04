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

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  describe('invoice analysis', () => {
    function setupInvoices() {
      const fixture = TestBed.createComponent(App);
      TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({ users: [] });
      const app = fixture.componentInstance as any;
      app.invoiceDate.set('2026-09-25');
      const row = (id: number, date: string, total = 100, paymentTypeId = 1, statusName = 'Activa') => ({
        invoiceId: id, customerName: `Cliente ${id}`, customerPhone: null,
        userName: 'Ana', createdAt: date, total, itemCount: 1, paymentTypeId,
        paymentTypeName: paymentTypeId === 2 ? 'Crédito' : 'Efectivo', statusName,
      });
      return { app, row };
    }

    it('keeps totals, payment breakdown and chart consistent while excluding annulled amounts', () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set([row(1, '2026-09-25T08:00:00', 100), row(2, '2026-09-25T09:00:00', 200, 2),
        row(3, '2026-09-25T10:00:00', 900, 1, 'Anulada'), row(4, '2026-09-24T10:00:00', 500)]);
      expect(app.invoiceAnalysis()).toEqual({ invoiceCount: 3, activeTotal: 300, annulledCount: 1, creditTotal: 200 });
      expect(app.invoicePaymentBreakdown().reduce((sum: number, r: any) => sum + r.total, 0)).toBe(300);
      expect(app.invoiceTrendPoints().reduce((sum: number, r: any) => sum + r[1], 0)).toBe(300);
      app.updateInvoiceStatusFilter({ target: { value: 'Anulada' } });
      expect(app.invoiceAnalysis()).toEqual({ invoiceCount: 1, activeTotal: 0, annulledCount: 1, creditTotal: 0 });
      expect(app.invoicePaymentBreakdown()).toEqual([]);
    });

    it('uses local calendar day, Monday-based week, and month boundaries', () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set([row(1, '2026-09-20T23:59:59'), row(2, '2026-09-21T00:00:00'),
        row(3, '2026-09-25T23:59:59'), row(4, '2026-09-27T23:59:59'), row(5, '2026-09-28T00:00:00'),
        row(6, '2026-10-01T00:00:00'), row(7, '')]);
      expect(app.filteredInvoiceRows().map((r: any) => r.invoiceId)).toEqual([3]);
      app.setInvoicePeriod('week');
      expect(app.filteredInvoiceRows().map((r: any) => r.invoiceId)).toEqual([4, 3, 2]);
      app.setInvoicePeriod('month');
      expect(app.filteredInvoiceRows().length).toBe(5);
      app.setInvoicePeriod('all');
      expect(app.filteredInvoiceRows().length).toBe(7);
    });

    it('paginates invoices and resets the page when changing grouping or filters', () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set(Array.from({ length: 26 }, (_, i) => row(i + 1, '2026-09-25T10:00:00')));
      expect(app.paginatedInvoices().length).toBe(10);
      app.nextInvoicePage(); app.nextInvoicePage();
      expect(app.paginatedInvoices().length).toBe(6);
      app.updateInvoicePageSize({ target: { value: '25' } });
      expect(app.invoicePage()).toBe(1);
      expect(app.paginatedInvoices().length).toBe(25);
      app.updateInvoiceGrouping({ target: { value: 'payment' } });
      expect(app.invoicePaginationTotal()).toBe(1);
      expect(app.paginatedInvoiceGroups()[0].invoices.length).toBe(26);
      app.updateInvoiceSearch({ target: { value: 'sin coincidencias' } });
      expect(app.invoicePageStart()).toBe(0);
      expect(app.invoicePageEnd()).toBe(0);
      expect(app.invoicePageCount()).toBe(1);
    });

    it('ignores a late preview response after selecting another invoice or closing the panel', async () => {
      const { app, row } = setupInvoices();
      const first = row(1, '2026-09-25T08:00:00'), second = row(2, '2026-09-25T09:00:00');
      app.invoiceRows.set([first, second]);
      const http = TestBed.inject(HttpTestingController);
      const firstLoad = app.openInvoicePreview(first);
      const firstRequest = http.expectOne('/api/invoices/1/details');
      const secondLoad = app.openInvoicePreview(second);
      http.expectOne('/api/invoices/2/details').flush({ lines: [{ id: 2, productName: 'Segundo' }] });
      await secondLoad;
      firstRequest.flush({ lines: [{ id: 1, productName: 'Primero' }] });
      await firstLoad;
      expect(app.invoicePreviewLines()[0].id).toBe(2);
      expect(app.invoicePreview().invoiceId).toBe(2);
      const pending = app.openInvoicePreview(first);
      app.closeInvoicePreview();
      http.expectOne('/api/invoices/1/details').flush({ lines: [{ id: 1 }] });
      await pending;
      expect(app.invoicePreview()).toBeNull();
      expect(app.invoicePreviewLines()).toEqual([]);
    });

    it('recovers a failed load when changing the date and does not depend on global summaries', async () => {
      const { app, row } = setupInvoices();
      const http = TestBed.inject(HttpTestingController);
      const failed = app.loadInvoicesPageData();
      http.expectOne('/api/invoices').flush({ message: 'Error al obtener facturas' }, { status: 500, statusText: 'Server Error' });
      await failed;
      expect(app.invoiceError()).toBe('Error al obtener facturas');
      expect(app.invoiceLoading()).toBe(false);
      app.updateInvoiceDate({ target: { value: '2026-09-24' } });
      expect(app.invoiceLoading()).toBe(true);
      http.expectOne('/api/invoices').flush({ invoices: [row(1, '2026-09-24T10:00:00')] });
      await Promise.resolve();
      http.expectNone('/api/invoices/summary');
      http.expectOne('/api/dashboard/sales-trend?period=month').flush({ message: 'History unavailable' }, { status: 500, statusText: 'Server Error' });
      await Promise.resolve();
      expect(app.invoiceLoading()).toBe(false);
      expect(app.invoiceError()).toBe('');
      expect(app.filteredInvoiceRows()).toHaveLength(1);
    });

    it('does not issue duplicate loads while a retry is already pending', async () => {
      const { app } = setupInvoices();
      const http = TestBed.inject(HttpTestingController);
      const first = app.loadInvoicesPageData();
      await app.loadInvoicesPageData();
      http.expectOne('/api/invoices').flush({ invoices: [] });
      await first;
      http.expectOne('/api/dashboard/sales-trend?period=month').flush({ trend: [] });
      await Promise.resolve();
      expect(app.invoiceError()).toBe('');
      expect(app.invoiceLoading()).toBe(false);
    });

    it('filters customers by identity even when two customers share a name', () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set([{ ...row(1, '2026-09-25T10:00:00', 10), customerId: 1, customerName: 'María' },
        { ...row(2, '2026-09-25T11:00:00', 20), customerId: 2, customerName: 'María' }]);
      app.updateInvoiceCustomerFilter({ target: { value: 'id:2' } });
      expect(app.filteredInvoiceRows().map((r: any) => r.invoiceId)).toEqual([2]);
      expect(app.invoiceAnalysis().activeTotal).toBe(20);
      app.clearInvoiceFilters();
      expect(app.filteredInvoiceRows()).toHaveLength(2);
    });

    it('sorts numeric invoice totals before pagination and toggles direction', () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set([row(1, '2026-09-25T10:00:00', 100), row(2, '2026-09-25T10:00:00', 2), row(3, '2026-09-25T10:00:00', 10)]);
      app.invoicePage.set(2);
      app.sortInvoiceTable('invoices', 'total');
      expect(app.invoicePage()).toBe(1);
      expect(app.paginatedInvoices().map((r: any) => r.total)).toEqual([2, 10, 100]);
      app.sortInvoiceTable('invoices', 'total');
      expect(app.paginatedInvoices().map((r: any) => r.total)).toEqual([100, 10, 2]);
      expect(app.invoiceAriaSort('invoices', 'total')).toBe('descending');
    });

    it('orders day groups chronologically in the selected date direction', () => {
      const { app, row } = setupInvoices();
      app.setInvoicePeriod('all');
      app.invoiceRows.set([row(1, '2026-09-25T10:00:00'), row(2, '2026-09-24T10:00:00')]);
      app.sortInvoiceTable('invoices', 'createdAt');
      expect(app.invoiceDayGroups().map((group: any) => group.key)).toEqual(['2026-09-24', '2026-09-25']);
      app.sortInvoiceTable('invoices', 'createdAt');
      expect(app.invoiceDayGroups().map((group: any) => group.key)).toEqual(['2026-09-25', '2026-09-24']);
    });

    it('preserves chronological monthly variation when sorting presentation by total', () => {
      const { app } = setupInvoices();
      const today = new Date();
      const period = (offset: number) => new Date(Date.UTC(today.getFullYear(), today.getMonth() + offset, 1)).toISOString();
      app.invoiceMonthlySalesTrendData.set([{ periodStart: period(0), efectivo: 100 }, { periodStart: period(-1), efectivo: 50 }]);
      const latest = app.invoiceMonthlySalesRows()[0];
      expect(app.invoiceMonthlyVariation(latest)).toBe(1);
      app.sortInvoiceTable('monthly', 'total');
      expect(app.paginatedInvoiceMonths()[0].total).toBe(0);
      app.sortInvoiceTable('monthly', 'total');
      expect(app.paginatedInvoiceMonths()[0].total).toBe(100);
      expect(app.invoiceMonthlyVariation(latest)).toBe(1);
    });

    it('exports all filtered results rather than just the visible page', async () => {
      const { app, row } = setupInvoices();
      app.invoiceRows.set(Array.from({ length: 26 }, (_, i) => row(i + 1, '2026-09-25T10:00:00')));
      const exportPdf = vi.spyOn(app, 'exportInvoiceGroupPdf').mockResolvedValue(undefined);
      await app.exportFilteredInvoicesPdf();
      expect(exportPdf.mock.calls[0][0]).toMatchObject({ total: 2600, itemCount: 26 });
      expect((exportPdf.mock.calls[0][0] as any).invoices.length).toBe(26);
    });
  });

});
