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
    TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users:[]});
    const app = fixture.componentInstance as any;
    app.currentUser.set({id:1,nombre:'Demo'});
    app.loadPurchaseWorkspace();
    return app;
  }
  it('defaults to receipt and persists drafts without sending a purchase', () => {
    const app=setup();
    expect(app.purchaseWorkspaceView()).toBe('receipt');
    app.purchaseSupplierId.set(7); app.purchaseInvoiceNumber.set('F-100');
    app.purchaseDraftLines.set([{productId:1,quantity:2,unitCost:15,lotNumber:'L1',expiryDate:'2027-01-01'}]);
    expect(app.savePurchaseWorkspace()).toBe(true);
    app.changePurchaseWorkspace('board');
    expect(app.purchaseWorkspaceDrafts().length).toBe(1);
    const draft=app.purchaseWorkspaceDrafts()[0];
    app.newPurchaseWorkspace();
    app.resumePurchaseWorkspace(draft);
    expect(app.purchaseDraftLines()[0].expiryDate).toBe('2027-01-01');
    expect(app.purchaseWorkspaceTotal(draft)).toBe(30);
    TestBed.inject(HttpTestingController).expectNone('/api/purchases');
  });
  it('keeps users isolated and classifies stages without inventory writes', () => {
    const app=setup();
    app.purchaseWorkspaceStage.set('receive'); app.savePurchaseWorkspace();
    expect(app.purchaseWorkspaceItems('receive').length).toBe(1);
    app.currentUser.set({id:2}); app.loadPurchaseWorkspace();
    expect(app.purchaseWorkspaceDrafts()).toEqual([]);
    expect(app.purchaseWorkspaceId()).toBeNull();
    app.currentUser.set({id:1}); app.loadPurchaseWorkspace();
    expect(app.purchaseWorkspaceDrafts().length).toBe(1);
  });
  it('validates before review and does not register until confirmation', () => {
    const app=setup();
    app.reviewPurchaseWorkspace(); expect(app.purchaseReviewOpen()).toBe(false);
    app.purchaseSupplierId.set(1);app.purchaseInvoiceNumber.set('F-2');
    app.purchaseDraftLines.set([{productId:1,quantity:1,unitCost:15}]);
    app.reviewPurchaseWorkspace();expect(app.purchaseReviewOpen()).toBe(true);
    TestBed.inject(HttpTestingController).expectNone('/api/purchases');
  });
  it('does not lose working lines when local storage fails', () => {
    const app=setup();app.purchaseDraftLines.set([{productId:1,quantity:2,unitCost:10}]);
    const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
    app.newPurchaseWorkspace();expect(app.purchaseDraftLines().length).toBe(1);
    expect(app.purchaseWorkspaceNotice()).toContain('No se pudo guardar');spy.mockRestore();
  });
  it('shows actual purchase summary and excludes annulled purchases', () => {
    const app=setup();
    const row={id:1,purchaseType:'Efectivo',productId:1,productName:'Arroz',quantity:2,unitCost:10,total:20,userId:1,userName:'Demo',createdAt:new Date().toISOString(),paymentTypeId:1,supplierId:1,supplierName:'Proveedor',statusId:1,statusName:'Activo',invoiceNumber:'A'};
    app.purchaseRows.set([row,{...row,id:2,invoiceNumber:'B',statusId:3,statusName:'Anulada'}]);
    expect(app.purchaseReceiptSummary().today).toBe(1);
    expect(app.purchaseReceiptSummary().latest.invoiceNumber).toBe('A');
    app.purchaseRows.set([]);
    expect(app.purchaseReceiptSummary().latest).toBeNull();
  });

  it('schedules delivery independently from purchase date and restores it', () => {
    const app=setup();
    app.purchaseDate.set('2026-09-27');app.purchaseExpectedDate.set('2026-10-03');
    app.purchaseSupplierId.set(1);app.purchaseDraftLines.set([{productId:1,quantity:2,unitCost:10}]);
    app.schedulePurchaseWorkspace();
    const draft=app.purchaseWorkspaceDrafts()[0];
    expect(draft.stage).toBe('receive');expect(draft.expectedDate).toBe('2026-10-03');
    expect(draft.date).toBe('2026-09-27');
    app.newPurchaseWorkspace();app.resumePurchaseWorkspace(draft);
    expect(app.purchaseExpectedDate()).toBe('2026-10-03');
    TestBed.inject(HttpTestingController).expectNone('/api/purchases');
  });
  it('opens the exact registered invoice and distinguishes annulled documents', () => {
    const app=setup();
    const row={id:1,purchaseType:'Efectivo',productId:1,productName:'Arroz',quantity:2,unitCost:10,total:20,userId:1,userName:'Demo',createdAt:'2026-09-27T10:00:00',paymentTypeId:1,supplierId:1,supplierName:'Proveedor',statusId:1,statusName:'Activo',invoiceNumber:'A'};
    app.purchaseRows.set([row,{...row,id:2,invoiceNumber:'B',statusId:3,statusName:'Anulada'}]);
    app.purchaseRegisteredState.set('Ingresada');
    expect(app.purchaseRegistered().length).toBe(1);
    app.purchaseDetailKey.set(app.purchaseRegistered()[0].key);
    expect(app.purchaseDetail().lines[0].productName).toBe('Arroz');
    expect(app.purchaseDetail().total).toBe(20);
    app.purchaseRegisteredState.set('Anulada');
    expect(app.purchaseRegistered()[0].invoiceNumber).toBe('B');
  });

});
