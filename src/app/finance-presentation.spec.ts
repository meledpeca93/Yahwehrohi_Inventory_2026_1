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

describe('Finance presentation',()=>{
 beforeEach(async()=>{localStorage.clear();await TestBed.configureTestingModule({imports:[App],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();});
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 function setup(){const app=TestBed.createComponent(App).componentInstance as any;const http=TestBed.inject(HttpTestingController);http.expectOne('/api/auth/users').flush({users:[]});return app;}
 it('resets optional panels and hierarchical details on entry',()=>{const app=setup();for(const page of ['costs','petty-cash','financial-movements','sales-profitability']){app.financePanels.set({[page+'-summary']:true});app.expandedFinancialDayKeys.set(['day']);app.expandedFinancialTypeKeys.set(['type']);app.expandedFinancialPaymentKeys.set(['method']);app.resetAttendancePayrollPanels(page);expect(app.financePanelOpen(page+'-summary')).toBe(false);expect(app.expandedFinancialDayKeys()).toEqual([]);expect(app.expandedFinancialTypeKeys()).toEqual([]);expect(app.expandedFinancialPaymentKeys()).toEqual([]);}});
 it('filters and paginates full financial records without changing KPI totals',()=>{const app=setup();app.financialMovements.set(Array.from({length:30},(_,i)=>({id:i+1,date:'2026-10-05',movementType:'entrada',paymentMethod:'efectivo',target:'caja_chica',category:'Venta',description:'Registro '+i,amount:10,userName:'Cuenta',status:i===0?'anulado':'activo'})));expect(app.financeTableRows('finance-movements')).toHaveLength(30);expect(app.financialEntriesTotal()).toBe(290);app.modalTables.patch('finance-movements',{filter:'activo',size:25,page:2});expect(app.modalTables.pageRows('finance-movements',app.financeTableRows('finance-movements'),app.financeTableConfigs['finance-movements'])).toHaveLength(4);expect(app.financialDayGroups()[0].count).toBe(4);expect(app.financialEntriesTotal()).toBe(290);});
 it('exports selected records across pages with sorting and filters',()=>{const app=setup();const rows=[{id:1,date:'2026-10-05',userName:'Ana',finalAmount:20},{id:2,date:'2026-10-04',userName:'Luis',finalAmount:10}];app.pettyCashRows=()=>rows;app.modalTables.toggle('finance-cash',rows[1]);app.modalTables.sort('finance-cash','finalAmount');expect(app.modalTables.pageRows('finance-cash',rows,app.financeTableConfigs['finance-cash'])[0].id).toBe(2);const csv=app.modalTables.csv('finance-cash',rows,app.financeTableConfigs['finance-cash']);expect(csv).toContain('Luis');expect(csv).not.toContain('Ana');});
 it('uses readable chart colors for finance only',()=>{const app=setup();app.activePage.set('costs');expect(app.chartLinePalette()[0].border).toBe('#087568');});
 it('keeps customer selection independent between rows',()=>{const app=setup();app.salesProfitabilityAnalytics.set({customers:{topRevenue:[{customerId:1,customerName:'Ana'},{customerId:2,customerName:'Luis'}]}});const rows=app.financeTableRows('finance-customers');app.modalTables.toggle('finance-customers',rows[0]);expect(app.modalTables.selected('finance-customers',rows[1])).toBe(false);});

});
