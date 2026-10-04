import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild, computed, signal } from '@angular/core';

/** Calendar values stay local YYYY-MM-DD strings; never convert through UTC. */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
})
export class DatePickerComponent implements OnInit, OnDestroy {
  private readonly reposition = () => this.position();
  ngOnInit(): void { document.addEventListener('scroll', this.reposition, true); }
  ngOnDestroy(): void { document.removeEventListener('scroll', this.reposition, true); }
  @HostListener('document:focusin', ['$event'])
  protected onFocus(event: FocusEvent): void {
    if (!this.opened()) return;
    const target = event.target as Node | null;
    if (target && !this.panel.nativeElement.contains(target) && target !== this.trigger.nativeElement && target !== this.field.nativeElement) {
      this.panel.nativeElement.hidePopover(); this.opened.set(false);
    }
  }

  @Input() value = '';
  @Input() label = 'Fecha';
  @Output() dateInput = new EventEmitter<Event>();
  @ViewChild('field', { static: true }) field!: ElementRef<HTMLInputElement>;
  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild('panel', { static: true }) panel!: ElementRef<HTMLElement>;
  protected readonly months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  protected readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  protected readonly shown = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly opened = signal(false);
  protected readonly focused = signal('');
  protected readonly days = computed(() => {
    const month = this.shown();
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      return { value: this.iso(date), day: date.getDate(), outside: date.getMonth() !== month.getMonth(),
        label: date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
    });
  });
  protected iso(date: Date): string {
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private parse(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(0); date.setFullYear(y, m - 1, d); date.setHours(12, 0, 0, 0);
    return y >= 1 && y <= 9999 && this.iso(date) === value ? date : null;
  }
  protected today(): string { return this.iso(new Date()); }
  protected toggle(): void {
    if (this.opened()) { this.close(); return; }
    const selected = this.parse(this.value) || new Date();
    this.shown.set(new Date(selected.getFullYear(), selected.getMonth(), 1));
    this.focused.set(this.iso(selected));
    this.panel.nativeElement.showPopover();
    this.opened.set(true);
    this.position();
    this.focusDay();
  }
  protected onToggle(event: Event): void {
    const open = (event as ToggleEvent).newState === 'open';
    this.opened.set(open);
  }
  protected close(): void { this.panel.nativeElement.hidePopover(); this.opened.set(false); this.trigger.nativeElement.focus(); }
  protected choose(value: string): void {
    this.field.nativeElement.value = value;
    this.field.nativeElement.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
  protected moveMonth(delta: number): void {
    const current = this.shown();
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    if (next.getFullYear() < 100 || next.getFullYear() > 9999) return;
    this.shown.set(next); this.focused.set(this.iso(next));
  }
  protected setMonth(event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    this.shown.set(new Date(this.shown().getFullYear(), month, 1));
    this.focused.set(this.iso(this.shown()));
  }
  protected setYear(event: Event): void {
    const input = event.target as HTMLInputElement;
    const year = Number(input.value);
    if (!Number.isInteger(year) || year < 100 || year > 9999) { input.value = String(this.shown().getFullYear()); return; }
    this.shown.set(new Date(year, this.shown().getMonth(), 1));
    this.focused.set(this.iso(this.shown()));
  }
  protected keyDay(event: KeyboardEvent, value: string): void {
    const date = this.parse(value)!;
    const offset: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
      Home: -((date.getDay() + 6) % 7), End: 6 - ((date.getDay() + 6) % 7) };
    if (event.key in offset) date.setDate(date.getDate() + offset[event.key]);
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    } else return;
    event.preventDefault();
    if (date.getFullYear() < 100 || date.getFullYear() > 9999) return;
    this.shown.set(new Date(date.getFullYear(), date.getMonth(), 1));
    this.focused.set(this.iso(date)); this.focusDay();
  }
  private focusDay(): void {
    requestAnimationFrame(() => { if (this.opened()) this.panel.nativeElement.querySelector<HTMLButtonElement>(`[data-date="${this.focused()}"]`)?.focus(); });
  }
  @HostListener('window:resize') protected position(): void {
    if (!this.opened()) return;
    const panel = this.panel.nativeElement;
    const anchor = this.trigger.nativeElement.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const top = anchor.bottom + 8 + rect.height <= window.innerHeight - 12 ? anchor.bottom + 8 : Math.max(12, anchor.top - rect.height - 8);
    panel.style.left = `${Math.max(12, Math.min(anchor.right - rect.width, window.innerWidth - rect.width - 12))}px`;
    panel.style.top = `${top}px`;
  }
}
