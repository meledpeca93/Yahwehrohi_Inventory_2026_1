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

describe('User management',()=>{
 beforeEach(async()=>{localStorage.clear();await TestBed.configureTestingModule({imports:[App],providers:[provideHttpClient(),provideHttpClientTesting()]}).compileComponents();});
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 function setup(){const app=TestBed.createComponent(App).componentInstance as any;const http=TestBed.inject(HttpTestingController);http.expectOne('/api/auth/users').flush({users:[]});app.currentUser.set({id:1,nombre:'Admin',usuario:'admin',rol:'admin',profile:'Administrador',permissions:{settings:'write',users:'write',billing:'write'}});return {app,http};}
 it('applies consultation defaults and individual overrides',()=>{const {app}=setup();app.editManagedUser(null);app.updateManagedUser('profile',{target:{value:'Consulta'}});expect(app.managedUserDraft().permissions.billing).toBe('read');expect(app.managedUserDraft().permissions.users).toBe('none');expect(app.managedUserDraft().permissions.settings).toBe('read');app.updateUserAccess('inventory',{target:{value:'write'}});expect(app.managedUserDraft().permissions.inventory).toBe('write');expect(app.managedUserDraft().permissions.billing).toBe('read');});
 it('creates accounts and refreshes the directory and login users',async()=>{const {app,http}=setup();app.editManagedUser(null);app.managedUserDraft.update((d:any)=>({...d,nombre:'Nuevo',usuario:'nuevo',password:'new-password'}));const saving=app.saveManagedUser();const request=http.expectOne('/api/users');expect(request.request.method).toBe('POST');expect(request.request.body.permissions.users).toBe('none');request.flush({id:2});await Promise.resolve();http.expectOne('/api/users').flush({users:[{id:2,nombre:'Nuevo',usuario:'nuevo',profile:'Operador',activo:true}]});await Promise.resolve();await Promise.resolve();http.expectOne('/api/auth/users').flush({users:[]});await saving;expect(app.managedUserDraft()).toBeNull();expect(app.managedUsers()[0].id).toBe(2);});
 it('keeps the draft and exposes backend validation errors',async()=>{const {app,http}=setup();app.editManagedUser(null);const saving=app.saveManagedUser();http.expectOne('/api/users').flush({message:'Usuario duplicado'},{status:409,statusText:'Conflict'});await saving;expect(app.managedUserDraft()).not.toBeNull();expect(app.managedUsersError()).toContain('Usuario duplicado');expect(app.managedUsersSaving()).toBe(false);});
 it('blocks forbidden module navigation and maps inventory aliases',()=>{const {app}=setup();app.currentUser.set({id:2,profile:'Consulta',permissions:{inventory:'read',payroll:'none'}});expect(app.canAccessModule('inventory-out-of-stock')).toBe(true);expect(app.canAccessModule('inventory-sheet','write')).toBe(false);expect(app.canManageUsers()).toBe(false);app.activePage.set('inventory-sheet');app.setPage('payroll');expect(app.activePage()).toBe('inventory-sheet');});
 it('updates existing accounts without requiring a password',async()=>{const {app,http}=setup();app.editManagedUser({id:2,nombre:'Cuenta',usuario:'cuenta',profile:'Consulta',activo:false,permissions:{billing:'read'}});app.updateManagedUser('activo',{target:{checked:true}});const saving=app.saveManagedUser();const request=http.expectOne('/api/users/2');expect(request.request.method).toBe('PUT');expect(request.request.body.password).toBe('');expect(request.request.body.activo).toBe(true);request.flush({id:2});await Promise.resolve();http.expectOne('/api/users').flush({users:[]});await Promise.resolve();await Promise.resolve();http.expectOne('/api/auth/users').flush({users:[]});await saving;});
 it('deactivates only after the explicit confirmation action',async()=>{const {app,http}=setup();app.managedUserDelete.set({id:2,nombre:'Cuenta'});http.expectNone('/api/users/2');const deleting=app.deactivateManagedUser();const request=http.expectOne('/api/users/2');expect(request.request.method).toBe('DELETE');request.flush({id:2});await Promise.resolve();http.expectOne('/api/users').flush({users:[]});await Promise.resolve();await Promise.resolve();http.expectOne('/api/auth/users').flush({users:[]});await deleting;expect(app.managedUserDelete()).toBeNull();});

 it('shows the users section without granting administrative operations',()=>{const {app,http}=setup();app.currentUser.set({id:2,rol:'operador',profile:'Operador',permissions:{settings:'read',users:'none'}});app.setSettingsTab('users');expect(app.activeSettingsTab()).toBe('users');expect(app.canManageUsers()).toBe(false);http.expectNone('/api/users');});

});
