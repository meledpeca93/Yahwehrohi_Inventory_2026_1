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

  function setup() {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users: []});
    const app = fixture.componentInstance as any;
    app.creditPeopleAsOf.set(new Date(2026, 8, 26));
    const row = (id: number, customerId: number, amount = 100, paid = 0) => ({id, invoiceId: id, customerId, customerName: `Cliente ${customerId}`, customerPhone: '99990000', user: 'Ana', total: amount + paid, pendingAmount: amount, paidAmount: paid, createdAt: '2026-06-01T10:00:00', utility: 1, quantity: 1, productName: 'Producto', openCredits: 1, customerBalance: amount});
    return {app, row};
  }
  it('preserves full balances when searching and never mixes same-name customer identities', () => {
    const {app,row} = setup();
    app.creditLines.set([row(1,1),row(2,1,50),{...row(3,2,300),customerName:'Cliente 1'},row(4,3,0)]);
    expect(app.creditPeopleBalance()).toBe(450);
    app.creditDossierId.set(2);
    expect(app.creditDossier().total).toBe(300);
    app.creditPeopleSearch.set('99990000');
    expect(app.creditPeople().length).toBe(2);
    app.creditPeopleSearch.set('no existe');
    expect(app.creditDossier()).toBeNull();
    expect(app.creditPeopleBalance()).toBe(450);
  });
  it('uses calendar months and excludes unavailable or undated paid histories', () => {
    const {app,row} = setup();
    app.creditLines.set([row(1,1),row(2,2),row(3,3),row(4,4,100,20),row(5,5)]);
    app.creditPeopleHistories.set({1: [],2:[{amount:10,createdAt:'2026-07-26T12:00:00'}],3:null,4:[],5:[{amount:10,createdAt:'2026-07-25T12:00:00'}]});
    app.creditPeopleFilter.set('inactive');
    expect(app.creditPeople().map((g:any) => g.customerId).sort()).toEqual([1,5]);
    expect(app.creditPeopleUnknown()).toBe(2);
  });
  it('keeps payment preparation on the selected customer and existing payment defaults', () => {
    const {app,row} = setup();
    app.creditLines.set([row(1,1),row(2,2)]);
    app.creditDossierId.set(2);
    app.openCreditPaymentModal(app.creditDossier());
    expect(app.creditPaymentCustomer().customerId).toBe(2);
    expect(app.creditPaymentModalOpen()).toBe(true);
    expect(app.creditPaymentAmount()).toBe('');
  });
  it('keeps failed history unknown and handles complete per-customer responses', async () => {
    const {app,row} = setup();
    app.creditLines.set([row(1,1),row(2,2)]);
    const promise = app.loadCreditPeopleHistories();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/credit-payments/customer/1').flush({payments:[]});
    http.expectOne('/api/credit-payments/customer/2').flush({}, {status:500,statusText:'Error'});
    await promise;
    expect(app.creditPeopleHistories()[1]).toEqual([]);
    expect(app.creditPeopleHistories()[2]).toBeNull();
    expect(app.creditCustomerActivity(app.creditPeopleAll().find((g:any) => g.customerId === 2)).inactive).toBe(false);
    expect(app.creditPeopleHistoryLoading()).toBe(false);
  });
});
