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

  function flushInitialRequests() {
    const httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('/api/auth/users').flush({
      users: [
        {
          id: 1,
          nombre: 'Seydi Pena',
          usuario: 'spena',
          rol: 'admin',
        },
      ],
    });

    httpMock.expectOne('/api/customers').flush({
      customers: [],
    });
  }

  async function createAppFixture() {
    const fixture = TestBed.createComponent(App);
    flushInitialRequests();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function completeLogin(fixture: ComponentFixture<App>) {
    const app = fixture.componentInstance as any;
    app.currentUser.set({
      id: 1,
      nombre: 'Seydi Pena',
      usuario: 'spena',
      rol: 'admin',
    });
    app.isAuthenticated.set(true);
    app.activePage.set('billing');
    fixture.detectChanges();
  }

  function flushAttendanceUsers() {
    const httpMock = TestBed.inject(HttpTestingController);
    const request = httpMock.expectOne('/api/attendance/users');
    request.flush({
      users: [
        {
          id: 1,
          nombre: 'Seydi Pena',
          usuario: 'spena',
          rol: 'admin',
          date: '2026-04-15',
          entryTime: '08:00',
          exitTime: '17:00',
          status: 'PUNTUAL',
          workedHours: 8,
          weeklyHours: 40,
          attendanceDays: 5,
          history: [
            {
              id: 1001,
              date: '2026-04-15',
              weekNumber: 16,
              entryTime: '08:00',
              exitTime: '17:00',
              status: 'PUNTUAL',
              workedHours: 8,
            },
          ],
        },
      ],
    });
  }

  function flushDashboardRequests() {
    const httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('/api/dashboard/sales-summary').flush({
      cashTransferTotal: 0,
      currentMonthCashTransferTotal: 0,
      creditTotal: 0,
      currentMonthCreditTotal: 0,
      lastMonthSalesTotal: 0,
      accumulatedSalesTotal: 0,
      totalPurchases: 0,
      accumulatedPurchasesTotal: 0,
      lastMonthLabel: 'Abril 2026',
      purchaseMonthLabel: 'Mayo 2026',
    });
    httpMock.expectOne('/api/dashboard/sales-trend?period=month').flush({ trend: [] });
    httpMock.expectOne('/api/dashboard/sales-drop-alert').flush({
      alert: {
        isActive: false,
        shouldAlert: false,
        severity: 'normal',
        evaluatedAt: null,
        cutoffTime: null,
        todayTotal: 0,
        yesterdayTotal: 0,
        referenceDate: null,
        isReferenceFallback: false,
        shortfallAmount: 0,
        dropPercentage: 0,
      },
    });
    httpMock.expectOne('/api/purchases').flush({ purchases: [] });
    flushAttendanceUsers();
    httpMock.expectOne('/api/history/audit?limit=200').flush({ history: [] });
  }

  function flushLogoutCutPreview() {
    const httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('/api/daily-cuts/preview?date=2026-05-01&userId=1').flush({
      cut: {
        id: 0,
        date: '2026-05-01',
        userId: 1,
        userName: 'Seydi Pena',
        totalSales: 0,
        initialCash: 0,
        cashSales: 0,
        transferSales: 0,
        creditSales: 0,
        creditPayments: 0,
        cashIn: 0,
        cashOut: 0,
        cashTotal: 0,
        statusId: 1,
        statusName: 'Preview',
        profit: 0,
      },
    });
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    flushInitialRequests();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render login as the initial page', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome.');
  });

  it('should open the billing screen after login', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Inventario, compras, ventas y precios finales',
    );
  });

  it('should open the dashboard from the side menu', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const dashboardButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Dashboard'),
    );

    dashboardButton?.click();
    flushDashboardRequests();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain('DASHBOARD');
  });

  it('should open the attendance module from the side menu', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const attendanceButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Asistencia'),
    );

    attendanceButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Asistencia, horas trabajadas y salarios',
    );
  });

  it('should open the inventory sheet from the side menu', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const inventoryButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Inventario'),
    );

    inventoryButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Control maestro de productos y existencias',
    );
  });

  it('should open out of stock details from the inventory summary card', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const inventoryButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Inventario'),
    );

    inventoryButton?.click();
    fixture.detectChanges();

    const outOfStockButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Productos agotados'),
    );

    outOfStockButton?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain('Productos agotados');
  });

  it('should open the payroll module from the side menu', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const payrollButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Planillas'),
    );

    payrollButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Planilla semanal, quincenal y mensual',
    );
  });

  it('should open the weekly payroll generation page', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const payrollButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Planillas'),
    );

    payrollButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();

    const generateButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Generar planilla semanal'),
    );

    generateButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain('Horas semanales por jornada');
  });

  it('should persist payroll bonus and generated hours by selected week', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const payrollButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Planillas'),
    );

    payrollButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.componentInstance as any).updatePayrollBonus(1, 16, { target: { value: '75.5' } });
    fixture.detectChanges();

    const generateButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Generar planilla semanal'),
    );

    generateButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    (fixture.componentInstance as any).updateGeneratedPayrollHours(1, 'monday', 'morning', {
      target: { value: '8' },
    });
    fixture.detectChanges();

    expect(localStorage.getItem('yahweh-rohi-payroll-bonuses-16')).toContain('"1":75.5');
    expect(localStorage.getItem('yahweh-rohi-payroll-hours-16')).toContain('"morning":8');

    (fixture.componentInstance as any).setAttendanceWeek(17);
    fixture.detectChanges();

    expect(localStorage.getItem('yahweh-rohi-payroll-hours-17')).toContain('"morning":0');

    (fixture.componentInstance as any).setAttendanceWeek(16);
    fixture.detectChanges();

    expect(localStorage.getItem('yahweh-rohi-payroll-hours-16')).toContain('"morning":8');

    const backToPayrollButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Volver a planillas'),
    );

    backToPayrollButton?.click();
    flushAttendanceUsers();
    fixture.detectChanges();

    expect(localStorage.getItem('yahweh-rohi-payroll-bonuses-16')).toContain('"1":75.5');
  });

  it('should return to login after logout', async () => {
    const fixture = await createAppFixture();
    const compiled = fixture.nativeElement as HTMLElement;
    completeLogin(fixture);

    const logoutButton = Array.from(compiled.querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Cerrar sesion'),
    );

    logoutButton?.click();
    flushLogoutCutPreview();
    fixture.detectChanges();

    (fixture.componentInstance as any).closeSessionWithoutCut();
    fixture.detectChanges();

    expect(compiled.querySelector('h1')?.textContent).toContain('Welcome.');
  });
});
