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

describe('Attendance presentation', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports:[App], providers:[provideHttpClient(),provideHttpClientTesting()] }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function setup() {
    const app = TestBed.createComponent(App).componentInstance as any;
    TestBed.inject(HttpTestingController).expectOne('/api/auth/users').flush({users:[]});
    const groups = Array.from({length:26},(_,i)=>({user:{id:i+1,name:i===25?'José Álvarez':'Empleado '+i,role:'Caja',area:'Ventas',hourlyRate:15},weeks:[{key:'w'+i,days:[{workedHours:8}]}]}));
    app.attendanceUserGroups=signal(groups);
    app.currentWeekHours=()=>8;
    app.attendanceStatus=()=> 'Puntual';
    return {app,groups};
  }
  it('finds employees outside the first page and retains weekly marks', () => {
    const {app,groups}=setup();
    const table=app.modalTables,rows=app.attendanceTableRows(),config=app.attendanceTableConfig;
    expect(table.pages('attendance',rows,config)).toBe(3);
    table.input('attendance','search',{target:{value:'jose alvarez'}});
    const result=table.pageRows('attendance',rows,config);
    expect(result).toHaveLength(1);
    expect(result[0].weeks).toBe(groups[25].weeks);
    expect(app.attendanceUserGroups()).toHaveLength(26);
  });
  it('exports the full summary without changing user selection or marks', () => {
    const {app,groups}=setup();
    const before=JSON.stringify(groups),rows=app.attendanceTableRows();
    app.modalTables.toggle('attendance',rows[0]);
    const exportSpy=vi.spyOn(app.modalTables,'export').mockImplementation(()=>{});
    app.exportAttendanceSummary();
    expect(exportSpy).toHaveBeenCalledWith('attendance-summary',rows,app.attendanceTableConfig);
    expect(app.modalTables.selectedRows('attendance',rows)).toHaveLength(1);
    expect(app.modalTables.selectedRows('attendance-summary',rows)).toHaveLength(0);
    expect(JSON.stringify(groups)).toBe(before);
  });
  it('starts collapsed and resets opened panels when entering again', () => {
    const { app } = setup();
    expect(app.attendanceSummaryCollapsed()).toBe(true);
    app.attendanceSummaryCollapsed.set(false);
    expect(app.attendanceScheduleCollapsed()).toBe(true);
    app.attendanceScheduleCollapsed.set(false);
    expect(app.attendanceOverviewCollapsed()).toBe(true);
    app.attendanceOverviewCollapsed.set(false);
    app.attendanceExpandedUserIds.set([1]);
    app.attendanceExpandedWeekKeys.set([1]);
    vi.spyOn(app, 'loadPageData').mockImplementation(() => {});
    vi.spyOn(app, 'selectLatestPayrollWeekWithData').mockImplementation(() => {});
    vi.spyOn(app, 'scheduleVisibleChartsRefresh').mockImplementation(() => {});
    app.setPage('attendance');
    expect(app.attendanceSummaryCollapsed()).toBe(true);
    expect(app.attendanceScheduleCollapsed()).toBe(true);
    expect(app.attendanceOverviewCollapsed()).toBe(true);
    expect(app.attendanceExpandedUserIds()).toEqual([]);
    expect(app.attendanceExpandedWeekKeys()).toEqual([]);
  });

});
