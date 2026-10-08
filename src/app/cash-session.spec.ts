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

describe('Cash session restoration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function setup() {
    const app = TestBed.createComponent(App).componentInstance as any;
    TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users: []});
    app.activatePage = vi.fn();
    return app;
  }
  const user = {id: 7, nombre: 'Caja', usuario: 'caja', sessionToken: 'test-token', permissions: {billing: 'write'}};
  async function restore(app: any, cuts: any[]) {
    const pending = app.restoreAccessSession('billing', user);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/auth/session').flush({user});
    await Promise.resolve();
    http.expectOne('/api/daily-cuts?userId=7').flush({cuts});
    await pending;
  }
  it('requests initial cash after a closed cut even with a saved session', async () => {
    const app = setup();
    await restore(app, [{id: 1, statusId: 4, userId: 7, date: '2026-10-07'}]);
    expect(app.isAuthenticated()).toBe(true);
    expect(app.openingCutModalOpen()).toBe(true);
    expect(app.openingCashAmount()).toBe('');
  });
  it('resumes a genuinely open shift without creating another opening', async () => {
    const app = setup();
    await restore(app, [{id: 1, statusId: 1, userId: 7, date: '2026-10-07'}]);
    expect(app.openingCutModalOpen()).toBe(false);
  });
  it('requests opening with no cut records', async () => {
    const app = setup(); await restore(app, []);
    expect(app.openingCutModalOpen()).toBe(true);
  });
  it('skips cashier opening for users with read-only billing access', async () => {
    const app = setup(); const pending = app.restoreAccessSession('billing', user);
    TestBed.inject(HttpTestingController).expectOne('/api/auth/session').flush({user: {...user, permissions: {billing: 'read'}}});
    await pending;
    expect(app.openingCutModalOpen()).toBe(false);
  });
  it('clears local authentication immediately but awaits remote logout', async () => {
    const app = setup(); app.currentUser.set(user); app.isAuthenticated.set(true);
    app.saveSession(user);
    const pending = app.logout(); let completed = false;
    void pending.then(() => completed = true);
    expect(app.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('yahweh-rohi-session-user')).toBeNull();
    await Promise.resolve(); expect(completed).toBe(false);
    TestBed.inject(HttpTestingController).expectOne('/api/auth/logout').flush({});
    await pending; expect(completed).toBe(true);
  });
  it('closes the desktop only after saving the cut and ending the access session', async () => {
    const app = setup(); app.currentUser.set(user); app.isAuthenticated.set(true);
    app.logoutPhysicalCashCount.set('100');
    let endSession!: () => void;
    app.desktopApi = {
      createDailyCut: vi.fn().mockResolvedValue({cut: {statusId: 4}}),
      logoutAccessSession: vi.fn(() => new Promise<void>(resolve => endSession = resolve)),
      closeApp: vi.fn().mockResolvedValue(undefined),
    };
    const pending = app.saveLogoutCutAndClose();
    await Promise.resolve(); await Promise.resolve();
    expect(app.desktopApi.createDailyCut).toHaveBeenCalled();
    expect(app.desktopApi.logoutAccessSession).toHaveBeenCalled();
    expect(app.desktopApi.closeApp).not.toHaveBeenCalled();
    endSession(); await pending;
    expect(app.desktopApi.closeApp).toHaveBeenCalledOnce();
  });

});
