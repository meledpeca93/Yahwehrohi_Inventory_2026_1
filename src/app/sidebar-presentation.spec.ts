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

describe('Sidebar presentation',()=>{
 beforeEach(async()=>{localStorage.clear();await TestBed.configureTestingModule({imports:[App],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();});
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 function setup(){const app=TestBed.createComponent(App).componentInstance as any;TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users:[]});return app;}
 it('opens collapsed sidebar and chosen group together',()=>{const app=setup();app.sidebarCollapsed.set(true);app.payrollNavCollapsed.set(true);app.togglePayrollNav();expect(app.sidebarCollapsed()).toBe(false);expect(app.payrollNavCollapsed()).toBe(false);app.sidebarCollapsed.set(true);app.financeNavCollapsed.set(true);app.toggleFinanceNav();expect(app.sidebarCollapsed()).toBe(false);expect(app.financeNavCollapsed()).toBe(false);});
 it('toggles groups independently in expanded menu',()=>{const app=setup();app.sidebarCollapsed.set(false);app.financeNavCollapsed.set(true);app.payrollNavCollapsed.set(true);app.toggleFinanceNav();expect(app.financeNavCollapsed()).toBe(false);expect(app.payrollNavCollapsed()).toBe(true);app.toggleFinanceNav();expect(app.financeNavCollapsed()).toBe(true);});
 it('labels group tooltips in compact mode and hides them in expanded mode',()=>{const app=setup();const button=document.createElement('button');button.className='nav-module-title';button.setAttribute('aria-label','Finanzas');document.body.append(button);app.sidebarCollapsed.set(true);app.showSidebarTooltipFromEvent({target:button} as any);expect(app.sidebarTooltip().label).toBe('Finanzas');app.sidebarCollapsed.set(false);app.showSidebarTooltipFromEvent({target:button} as any);expect(app.sidebarTooltip()).toBeNull();button.remove();});
});
