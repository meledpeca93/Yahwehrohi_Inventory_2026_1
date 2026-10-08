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

describe('Dashboard presentation',()=>{
 beforeEach(async()=>{localStorage.clear();await TestBed.configureTestingModule({imports:[App],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();});
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 function setup(){const app=TestBed.createComponent(App).componentInstance as any;TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users:[]});return app;}
 it('collapses only the indicators and resets them on reentry',()=>{
   const app=setup();expect(app.dashboardSummaryCollapsed()).toBe(true);
   app.toggleDashboardSummary();expect(app.dashboardSummaryCollapsed()).toBe(false);
   app.resetAttendancePayrollPanels('dashboard');expect(app.dashboardSummaryCollapsed()).toBe(true);
 });
 it('loads credit for the fixed ranking on entry only with credit permission',()=>{
   const app=setup();
   for(const method of ['loadDashboardSalesSummary','loadDashboardSalesTrend','loadSalesDropAlert','loadPurchases','loadAttendanceUsers','loadAuditHistory','loadCredits'])vi.spyOn(app,method).mockResolvedValue(undefined);
   vi.spyOn(app,'isAuthenticated').mockReturnValue(true);
   const permission=vi.spyOn(app,'canAccessModule').mockReturnValue(false);
   app.loadPageData('dashboard');expect(app.loadCredits).not.toHaveBeenCalled();
   permission.mockReturnValue(true);app.loadPageData('dashboard');expect(app.loadCredits).toHaveBeenCalledOnce();
   expect(app.dashboardSummaryCollapsed()).toBe(true);
 });
 it('downloads the selected chart directly as a PNG',()=>{
   const app=setup();const canvas=document.createElement('canvas');app.salesTrendCanvas={nativeElement:canvas};
   const capture=vi.spyOn(app,'captureChartCanvas').mockReturnValue('data:image/png;base64,AA==');
   const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
   app.downloadDashboardChart('sales');expect(capture).toHaveBeenCalledWith(canvas);expect(click).toHaveBeenCalledOnce();
   const link=click.mock.instances[0] as HTMLAnchorElement;expect(link.download).toBe('dashboard-sales.png');click.mockRestore();
 });
 it('opens dashboard sales windows with collapsed summaries',()=>{const app=setup();app.activePage.set('dashboard');vi.spyOn(app,'loadTodayInvoices').mockResolvedValue(undefined);vi.spyOn(app,'loadSalesDropAlert').mockResolvedValue(undefined);app.openDailySalesModal();app.openSalesDropAlertModal();expect(app.modalSummaries().sales).toBe(true);expect(app.modalSummaries()['dashboard-sales-alert']).toBe(true);expect(app.dailySalesModalOpen()).toBe(true);expect(app.salesDropAlertModalOpen()).toBe(true);});
 it('uses the light chart palette on Dashboard',()=>{const app=setup();app.activePage.set('dashboard');expect(app.chartLinePalette()[0].border).toBe('#087568');});
 it('aggregates only pending credit and counts distinct invoices independently of portfolio filters',()=>{
   const app=setup();app.creditLines.set([
     {customerId:1,customerName:'Ana',invoiceId:10,pendingAmount:20},
     {customerId:1,customerName:'Ana',invoiceId:10,pendingAmount:30},
     {customerId:1,customerName:'Ana',invoiceId:11,pendingAmount:5},
     {customerId:2,customerName:'Luis',invoiceId:12,pendingAmount:100},
     {customerId:3,customerName:'Pagado',invoiceId:13,pendingAmount:0},
   ]);app.creditSearchTerm.set('Otro');
   expect(app.dashboardCreditBalance()).toBe(155);
   expect(app.dashboardCreditRows().map((row:any)=>[row.name,row.balance,row.invoiceCount])).toEqual([['Luis',100,1],['Ana',55,2]]);
   app.dashboardCreditSearch.set('ana');expect(app.dashboardCreditRows().length).toBe(1);
   expect(app.dashboardCreditBalance()).toBe(155);
   app.dashboardCreditSearch.set('');app.dashboardCreditSort.set('name');expect(app.dashboardCreditRows()[0].name).toBe('Ana');
 });
 it('totals sales across all payment methods without changing source data',()=>{
   const app=setup();const rows=[{label:'Lunes',efectivo:10,credito:20,transferencia:30}];
   app.salesTrendData.set(rows);expect(app.dashboardSalesTrendTotal()).toBe(60);expect(app.salesTrendData()).toEqual(rows);
 });
 it('offers only light/dark and saves the selected theme',()=>{
   const app=setup();expect(app.themes.map((theme:any)=>theme.id)).toEqual(['yr-light','yr-dark']);
   app.setTheme('yr-dark');expect(app.activeThemeId()).toBe('yr-dark');expect(localStorage.getItem('yahweh-rohi-theme')).toBe('yr-dark');
 });
 it('restores dark and maps retired themes to the current light theme',()=>{
   localStorage.setItem('yahweh-rohi-theme','yr-dark');expect(setup().activeThemeId()).toBe('yr-dark');
   localStorage.setItem('yahweh-rohi-theme','black-green');expect(setup().activeThemeId()).toBe('yr-light');
 });
 it('uses the dark series palette across finance modules',()=>{
   const app=setup();app.setTheme('yr-dark');app.activePage.set('costs');
   expect(app.chartLinePalette()[0].border).toBe('#75dbc6');
   app.setTheme('yr-light');expect(app.chartLinePalette()[0].border).toBe('#087568');
 });
});
