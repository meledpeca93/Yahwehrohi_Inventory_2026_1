import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { firstValueFrom } from 'rxjs';
import * as Tesseract from 'tesseract.js';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  PieController,
  Filler,
  Tooltip,
  Legend,
);

type Mode = 'purchase' | 'sale';
type Page =
  | 'dashboard'
  | 'billing'
  | 'invoices'
  | 'purchases'
  | 'credits'
  | 'costs'
  | 'history'
  | 'inventory-sheet'
  | 'inventory-out-of-stock'
  | 'attendance'
  | 'payroll'
  | 'payroll-generate';
type ThemeId =
  | 'black-green'
  | 'forest-light'
  | 'steel-light'
  | 'ember-dark'
  | 'emerald-dark'
  | 'analytics-dark'
  | 'crm-dark';

interface ThemeOption {
  id: ThemeId;
  name: string;
  tone: string;
}

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category: string;
  stock: number;
  minStock: number;
  maxStock?: number | null;
  unitCost: number;
  salePrice: number;
  wholesalePrice?: number | null;
  unitMeasure?: string | null;
  supplier?: string | null;
  previousMonthSales?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  margin: number;
}

interface InventoryDraft {
  sku: string;
  name: string;
  imageUrl: string;
  category: string;
  stock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  salePrice: number;
}

interface CartLine {
  productId: number;
  quantity: number;
}

interface PriceHistory {
  product: string;
  user: string;
  date: Date;
  previousCost: number;
  newCost: number;
  previousPrice: number;
  newPrice: number;
  reason: string;
}

interface AuditHistoryRecord {
  id: number;
  tableName: string;
  action: string;
  recordKey: string;
  user: string;
  userId: number | null;
  date: string | null;
  previousData: string;
  newData: string;
}

interface AuditHistoryResponse {
  history: AuditHistoryRecord[];
}

interface DashboardModuleChartRow {
  label: string;
  value: number;
  percent: number;
}

interface Movement {
  date: Date;
  type: string;
  detail: string;
  total: number;
}

interface DashboardMonth {
  month: string;
  sales: number;
  purchases: number;
}

interface DashboardTrendItem {
  label: string;
  value: number;
}

interface CostMonthlyPoint {
  label: string;
  total: number;
}

interface CostCategoryPoint {
  category: string;
  total: number;
}

interface CostCategoryComparisonPoint {
  category: string;
  costTotal: number;
  saleTotal: number;
}

interface CostIncreaseAlertRow {
  year: number;
  month: number;
  productId: number;
  sku: string;
  productName: string;
  category: string;
  previousCost: number;
  currentCost: number;
  increaseAmount: number;
  increasePercentage: number;
  currentSalePrice: number;
  currentStock: number;
  detectedAt: string | null;
}

type PaymentMethod = 'efectivo' | 'credito' | 'transferencia';
type SalesTrendPeriod = 'day' | 'week' | 'month' | 'year';
type PurchaseTrendPeriod = SalesTrendPeriod;
type PayrollTrendPeriod = 'day' | 'week' | 'month';
type SalesTrendSeriesKey = 'efectivo' | 'credito' | 'transferencia';

interface SalesTrendPoint {
  period: string;
  periodStart: string;
  label: string;
  efectivo: number;
  credito: number;
  transferencia: number;
}

interface CustomerOption {
  id: number;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  creditosAbiertos: number;
  fechaHora: string | null;
  saldo: number;
}

interface SupplierOption {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  creditoAbierto: number;
  comprasRealizadas: number;
  fechaHora: string | null;
}

interface PurchaseHistoryRow {
  id: number;
  purchaseType: string;
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
  userId: number;
  userName: string;
  createdAt: string | null;
  paymentTypeId: number;
  supplierId: number;
  supplierName: string;
  supplierPhone: string | null;
  supplierAddress: string | null;
  statusId: number | null;
  statusName: string;
  invoiceNumber: string;
}

interface PurchaseInvoiceGroup {
  key: string;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  purchaseType: string;
  statusName: string;
  userName: string;
  createdAt: string | null;
  total: number;
  quantity: number;
  lines: PurchaseHistoryRow[];
}

interface PurchaseSupplierGroup {
  supplierId: number;
  supplierName: string;
  supplierPhone: string | null;
  supplierAddress: string | null;
  total: number;
  invoiceCount: number;
  lineCount: number;
  invoices: PurchaseInvoiceGroup[];
}

interface CreditLine {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  utility: number;
  user: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  openCredits: number;
  customerBalance: number;
  paymentTypeId: number;
  createdAt: string | null;
  saleStatusId: number | null;
  saleStatusName: string;
  total: number;
  paidAmount: number;
  pendingAmount: number;
}

interface CreditPaymentAllocationResponse {
  customerId: number;
  amount: number;
  appliedAmount: number;
  remainingAmount: number;
  invoicesTouched: number;
  linesTouched: number;
  paymentsCreated: number;
  createdAt: string;
  allocations: Array<{
    saleId: number;
    invoiceId: number;
    customerId: number;
    amount: number;
  }>;
}

interface DailyCut {
  id: number;
  date: string;
  userId: number | null;
  userName: string;
  totalSales: number;
  initialCash: number;
  cashSales: number;
  transferSales: number;
  creditSales: number;
  creditPayments: number;
  cashIn: number;
  cashOut: number;
  cashTotal: number;
  statusId: number;
  statusName: string;
  profit: number;
}

interface CreditPayment {
  id: number;
  description: string;
  amount: number;
  customerId: number;
  customerName: string;
  invoiceId: number;
  userId: number;
  userName: string;
  createdAt: string;
}

interface InvoiceRow {
  invoiceId: number;
  customerId: number | null;
  customerName: string;
  customerPhone: string | null;
  itemCount: number;
  userId: number | null;
  userName: string;
  subtotal: number;
  total: number;
  utility: number;
  createdAt: string | null;
  paymentTypeId: number;
  paymentTypeName: string;
  statusName: string;
  linesCount: number;
  annulledLines: number;
}

interface InvoiceLine {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  utility: number;
  total: number;
  user: string;
  createdAt: string | null;
  paymentTypeId: number;
  paymentTypeName: string;
  customerId: number | null;
  statusId: number | null;
  statusName: string;
}

interface CreditInvoiceGroup {
  invoiceId: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  openCredits: number;
  customerBalance: number;
  saleStatusName: string;
  total: number;
  utility: number;
  lines: CreditLine[];
}

interface CreditCustomerGroup {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  openCredits: number;
  customerBalance: number;
  articleCount: number;
  total: number;
  utility: number;
  invoices: CreditInvoiceGroup[];
}

interface DashboardInvoice {
  date: Date;
  code: string;
  amount: number;
  status: 'Pagada' | 'Pendiente' | 'Fallida';
}

interface AttendanceUser {
  id: number;
  name: string;
  username: string;
  role: string;
  area: string;
  date: Date | null;
  entryTime: string;
  exitTime: string;
  hourlyRate: number;
  attendanceStatus: string;
  workedHours: number;
  weeklyHours: number;
  attendanceDays: number;
  history: AttendanceDayRecord[];
}

interface AttendanceDayRecord {
  id: number;
  date: Date;
  weekNumber: number;
  entryTime: string;
  exitTime: string;
  attendanceStatus: string;
  workedHours: number;
}

interface AttendanceWeekGroup {
  key: string;
  weekNumber: number;
  label: string;
  totalHours: number;
  days: AttendanceDayRecord[];
}

interface AttendanceUserGroup {
  user: AttendanceUser;
  totalHours: number;
  weeks: AttendanceWeekGroup[];
}

interface PayrollDayLine {
  id: string;
  date: Date;
  weekNumber: number;
  dayName: string;
  entryTime: string;
  exitTime: string;
  normalHours: number;
  extra1Hours: number;
  extra2Hours: number;
  extra3Hours: number;
  normalPay: number;
  extra1Pay: number;
  extra2Pay: number;
  extra3Pay: number;
  totalHours: number;
  totalPay: number;
}

interface PayrollWeekLine {
  key: string;
  weekNumber: number;
  label: string;
  days: PayrollDayLine[];
  subtotalPay: number;
  bonus: number;
  grandTotal: number;
  totalHours: number;
}

interface PayrollUserLine {
  user: AttendanceUser;
  weeks: PayrollWeekLine[];
  accumulatedSubtotal: number;
  accumulatedBonus: number;
  accumulatedTotal: number;
}

interface PayrollTopEarnerLine {
  user: AttendanceUser;
  hours: number;
  pay: number;
}

interface PayrollTrendDataset {
  label: string;
  data: number[];
}

interface LoginResponse {
  user: {
    id: number;
    nombre: string;
    usuario: string;
    rol: string;
  };
}

interface LoginUserOption {
  id: number;
  nombre: string;
  usuario: string;
  rol: string;
}

interface ProductsResponse {
  products: Array<Omit<Product, 'margin'> & { margin?: number }>;
}

interface UsersResponse {
  users: LoginUserOption[];
}

interface AttendanceUsersResponse {
  users: Array<{
    id: number;
    nombre: string;
    usuario: string;
    rol: string;
    date: string | null;
    entryTime: string;
    exitTime: string;
    status: string;
    workedHours: number;
    weeklyHours: number;
    attendanceDays: number;
    history: Array<{
      id: number;
      date: string | null;
      weekNumber: number;
      entryTime: string;
      exitTime: string;
      status: string;
      workedHours: number;
    }>;
  }>;
}

interface AttendanceMarkResponse {
  mark: {
    id: number;
    employeeId: number;
    date: string | null;
    entryTime: string;
    exitTime: string;
    status: string;
  };
}

interface CustomersResponse {
  customers: CustomerOption[];
}

interface SuppliersResponse {
  suppliers: SupplierOption[];
}

interface ExpiringProductAlert {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  category: string;
  entryDate: string | null;
  stock: number;
  lotNumber: number | null;
  expiryDate: string | null;
  daysRemaining: number;
  refreshedAt: string | null;
}

interface ExpiringProductsResponse {
  alerts: ExpiringProductAlert[];
}

interface PurchasesResponse {
  purchases: PurchaseHistoryRow[];
}

interface CreditsResponse {
  credits: CreditLine[];
}

interface DashboardSalesSummaryResponse {
  cashTransferTotal: number;
  currentMonthCashTransferTotal: number;
  creditTotal: number;
  currentMonthCreditTotal: number;
  lastMonthSalesTotal: number;
  accumulatedSalesTotal: number;
  totalPurchases: number;
  accumulatedPurchasesTotal: number;
  lastMonthLabel: string;
  purchaseMonthLabel: string;
}

interface DashboardSalesTrendResponse {
  trend: Array<Omit<SalesTrendPoint, 'label'>>;
}

interface SalesDropAlert {
  isActive: boolean;
  shouldAlert: boolean;
  severity: 'pending' | 'normal' | 'low' | 'warning' | 'critical';
  evaluatedAt: string | null;
  cutoffTime: string | null;
  todayTotal: number;
  yesterdayTotal: number;
  referenceDate: string | null;
  isReferenceFallback: boolean;
  shortfallAmount: number;
  dropPercentage: number;
}

interface SalesDropAlertResponse {
  alert: SalesDropAlert;
}

interface CostIncreaseAlertsResponse {
  period: {
    year: number;
    month: number;
  } | null;
  rows: CostIncreaseAlertRow[];
}

interface InvoicesResponse {
  invoices: InvoiceRow[];
}

interface DailyCutsResponse {
  cuts: DailyCut[];
}

interface DailyCutResponse {
  cut: DailyCut;
}

interface CreditPaymentsResponse {
  payments: CreditPayment[];
}

interface CreditPaymentCreateResponse {
  payment: CreditPaymentAllocationResponse;
}

interface InvoiceDetailsResponse {
  lines: InvoiceLine[];
}

interface InvoicesSummaryResponse {
  invoiceCount: number;
  activeTotal: number;
  annulledCount: number;
  creditTotal: number;
}

interface AnnulInvoiceResponse {
  invoiceId: number;
  restoredLines: number;
  restoredQuantity: number;
  saleTable: string;
}

interface ActivateInvoiceResponse {
  invoiceId: number;
  activatedLines: number;
  deductedQuantity: number;
  saleTable: string;
  saleStatusId: number;
}

interface NextInvoiceResponse {
  nextInvoiceNumber: number;
}

interface SaleResponse {
  invoiceId: number;
  expectedInvoiceId: number;
  saleId: number;
  saleTable: string;
  saleStatusId: number;
  savedLines: number;
  savedAt: string;
}

interface PurchaseDraftLine {
  productId: number;
  quantity: number;
  unitCost: number;
}

interface EstimatedPurchaseLine extends PurchaseDraftLine {
  reason: string;
}

interface PurchaseResponse {
  purchaseId: number;
  purchaseTable: string;
  paymentTypeId: number;
  supplierId: number;
  invoiceNumber: string;
  savedLines: number;
  transportCost?: number;
  otherDirectCost?: number;
  additionalCostPerUnit?: number;
  savedAt: string;
}

interface OperationalCostRow {
  id: number;
  date: string | null;
  type: string;
  description: string;
  amount: number;
  userId: number | null;
  userName: string;
  invoiceId: number | null;
  invoiceNumber: string;
  purchaseId: number | null;
  purchaseType: string;
  appliesTo: string;
  reference: string;
  createdAt: string | null;
}

interface PurchaseInvoiceOption {
  key: string;
  purchaseId: number;
  purchaseType: string;
  invoiceNumber: string;
  supplierName: string;
  total: number;
  createdAt: string | null;
}

interface OperationalCostsResponse {
  year: number;
  month: number;
  total: number;
  rows: OperationalCostRow[];
}

interface InventoryStockUpdateResponse {
  productId: number;
  stock: number;
  minStock: number;
  maxStock: number | null;
  affectedRows: number;
}

type PayrollDayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type PayrollShiftId = 'morning' | 'afternoon' | 'night';

interface PayrollDay {
  id: PayrollDayId;
  name: string;
}

interface PayrollShift {
  id: PayrollShiftId;
  name: string;
  schedule: string;
  rate: number;
}

type PayrollHoursMatrix = Record<number, Record<PayrollDayId, Record<PayrollShiftId, number>>>;
type PayrollBonusMatrix = Record<number, Record<number, number>>;
const sessionStorageKey = 'yahweh-rohi-session-user';
const activePageStorageKey = 'yahweh-rohi-active-page';
const defaultThemeMigrationStorageKey = 'yahweh-rohi-black-green-default-applied';
const payrollBonusesStoragePrefix = 'yahweh-rohi-payroll-bonuses';
const payrollHoursStoragePrefix = 'yahweh-rohi-payroll-hours';
const payrollNormalRate = 15;
const payrollExtra1Rate = 20;
const payrollExtra3WeekdayRate = 25;
const payrollExtra3WeekendRate = 30;
const availablePages: Page[] = [
  'dashboard',
  'billing',
  'invoices',
  'purchases',
  'credits',
  'costs',
  'history',
  'inventory-sheet',
  'inventory-out-of-stock',
  'attendance',
  'payroll',
  'payroll-generate',
];

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private salesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private invoicesSalesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private payrollTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private purchasesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private costsDistributionCanvas?: ElementRef<HTMLCanvasElement>;
  private costsEvolutionCanvas?: ElementRef<HTMLCanvasElement>;
  private costsCategoryCanvas?: ElementRef<HTMLCanvasElement>;
  private auditUserTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private dashboardPayrollChartCanvas?: ElementRef<HTMLCanvasElement>;
  private dashboardAttendanceChartCanvas?: ElementRef<HTMLCanvasElement>;
  private dashboardInventoryChartCanvas?: ElementRef<HTMLCanvasElement>;
  private dashboardCostsChartCanvas?: ElementRef<HTMLCanvasElement>;
  private dashboardHistoryChartCanvas?: ElementRef<HTMLCanvasElement>;
  private salesTrendChart: Chart<'line', number[], string> | null = null;
  private invoicesSalesTrendChart: Chart<'line', number[], string> | null = null;
  private payrollTrendChart: Chart<'line', number[], string> | null = null;
  private purchasesTrendChart: Chart<'line', number[], string> | null = null;
  private costsDistributionChart: Chart<'pie', number[], string> | null = null;
  private costsEvolutionChart: Chart<'line', number[], string> | null = null;
  private costsCategoryChart: Chart<'bar' | 'line', number[], string> | null = null;
  private auditUserTrendChart: Chart<'line', number[], string> | null = null;
  private dashboardPayrollChart: Chart<'bar', number[], string> | null = null;
  private dashboardAttendanceChart: Chart<'pie', number[], string> | null = null;
  private dashboardInventoryChart: Chart<'line', number[], string> | null = null;
  private dashboardCostsChart: Chart<'bar', number[], string> | null = null;
  private dashboardHistoryChart: Chart<'line', number[], string> | null = null;

  @ViewChild('salesTrendCanvas')
  protected set salesTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.salesTrendChart && this.salesTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.salesTrendChart.destroy();
      this.salesTrendChart = null;
    }

    this.salesTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('invoicesSalesTrendCanvas')
  protected set invoicesSalesTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.invoicesSalesTrendChart && this.invoicesSalesTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.invoicesSalesTrendChart.destroy();
      this.invoicesSalesTrendChart = null;
    }

    this.invoicesSalesTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('purchasesTrendCanvas')
  protected set purchasesTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.purchasesTrendChart && this.purchasesTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.purchasesTrendChart.destroy();
      this.purchasesTrendChart = null;
    }

    this.purchasesTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('payrollTrendCanvas')
  protected set payrollTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.payrollTrendChart && this.payrollTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.payrollTrendChart.destroy();
      this.payrollTrendChart = null;
    }

    this.payrollTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('costsDistributionCanvas')
  protected set costsDistributionCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.costsDistributionChart && this.costsDistributionCanvas?.nativeElement !== canvas?.nativeElement) {
      this.costsDistributionChart.destroy();
      this.costsDistributionChart = null;
    }

    this.costsDistributionCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('costsEvolutionCanvas')
  protected set costsEvolutionCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.costsEvolutionChart && this.costsEvolutionCanvas?.nativeElement !== canvas?.nativeElement) {
      this.costsEvolutionChart.destroy();
      this.costsEvolutionChart = null;
    }

    this.costsEvolutionCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('costsCategoryCanvas')
  protected set costsCategoryCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.costsCategoryChart && this.costsCategoryCanvas?.nativeElement !== canvas?.nativeElement) {
      this.costsCategoryChart.destroy();
      this.costsCategoryChart = null;
    }

    this.costsCategoryCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('auditUserTrendCanvas')
  protected set auditUserTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.auditUserTrendChart && this.auditUserTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.auditUserTrendChart.destroy();
      this.auditUserTrendChart = null;
    }

    this.auditUserTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('dashboardPayrollChartCanvas')
  protected set dashboardPayrollChartCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.dashboardPayrollChart && this.dashboardPayrollChartCanvas?.nativeElement !== canvas?.nativeElement) {
      this.dashboardPayrollChart.destroy();
      this.dashboardPayrollChart = null;
    }

    this.dashboardPayrollChartCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('dashboardAttendanceChartCanvas')
  protected set dashboardAttendanceChartCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.dashboardAttendanceChart && this.dashboardAttendanceChartCanvas?.nativeElement !== canvas?.nativeElement) {
      this.dashboardAttendanceChart.destroy();
      this.dashboardAttendanceChart = null;
    }

    this.dashboardAttendanceChartCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('dashboardInventoryChartCanvas')
  protected set dashboardInventoryChartCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.dashboardInventoryChart && this.dashboardInventoryChartCanvas?.nativeElement !== canvas?.nativeElement) {
      this.dashboardInventoryChart.destroy();
      this.dashboardInventoryChart = null;
    }

    this.dashboardInventoryChartCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('dashboardCostsChartCanvas')
  protected set dashboardCostsChartCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.dashboardCostsChart && this.dashboardCostsChartCanvas?.nativeElement !== canvas?.nativeElement) {
      this.dashboardCostsChart.destroy();
      this.dashboardCostsChart = null;
    }

    this.dashboardCostsChartCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('dashboardHistoryChartCanvas')
  protected set dashboardHistoryChartCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.dashboardHistoryChart && this.dashboardHistoryChartCanvas?.nativeElement !== canvas?.nativeElement) {
      this.dashboardHistoryChart.destroy();
      this.dashboardHistoryChart = null;
    }

    this.dashboardHistoryChartCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  protected readonly title = signal('Yahweh Rohi Inventory');
  protected readonly isAuthenticated = signal(false);
  protected readonly loginUser = signal('');
  protected readonly loginPassword = signal('');
  protected readonly loginUsers = signal<LoginUserOption[]>([]);
  protected readonly loginError = signal('');
  protected readonly loginLoading = signal(false);
  protected readonly checkoutError = signal('');
  protected readonly checkoutLoading = signal(false);
  protected readonly saleSuccessMessage = signal('');
  protected readonly saleToastVariant = signal<'success' | 'error'>('success');
  protected readonly inventorySuccessMessage = signal('');
  protected readonly selectedPaymentMethod = signal<PaymentMethod>('efectivo');
  protected readonly selectedCustomer = signal('Cliente final');
  protected readonly selectedCustomerId = signal<number | null>(null);
  protected readonly customerModalOpen = signal(false);
  protected readonly customerOptions = signal<CustomerOption[]>([]);
  protected readonly customerLoading = signal(false);
  protected readonly customerError = signal('');
  protected readonly selectedSupplier = signal('');
  protected readonly supplierModalOpen = signal(false);
  protected readonly supplierOptions = signal<SupplierOption[]>([]);
  protected readonly supplierLoading = signal(false);
  protected readonly supplierError = signal('');
  protected readonly expiringProductsModalOpen = signal(false);
  protected readonly expiringProductAlerts = signal<ExpiringProductAlert[]>([]);
  protected readonly expiringProductsLoading = signal(false);
  protected readonly expiringProductsError = signal('');
  protected readonly lowStockAlertModalOpen = signal(false);
  protected readonly salesDropAlertModalOpen = signal(false);
  protected readonly salesDropAlertLoading = signal(false);
  protected readonly salesDropAlertError = signal('');
  protected readonly purchaseRows = signal<PurchaseHistoryRow[]>([]);
  protected readonly purchaseLoading = signal(false);
  protected readonly purchaseError = signal('');
  protected readonly creditLines = signal<CreditLine[]>([]);
  protected readonly creditLoading = signal(false);
  protected readonly creditError = signal('');
  protected readonly creditSearchTerm = signal('');
  protected readonly selectedCreditCustomerId = signal<number | null>(null);
  protected readonly creditPaymentModalOpen = signal(false);
  protected readonly creditPaymentCustomer = signal<CreditCustomerGroup | null>(null);
  protected readonly creditPaymentAmount = signal('');
  protected readonly creditPaymentDescription = signal('Abono a credito');
  protected readonly creditPaymentSaving = signal(false);
  protected readonly creditPaymentError = signal('');
  protected readonly creditPaymentSuccess = signal('');
  protected readonly invoiceRows = signal<InvoiceRow[]>([]);
  protected readonly todayInvoiceRows = signal<InvoiceRow[]>([]);
  protected readonly invoiceLoading = signal(false);
  protected readonly todayInvoiceLoading = signal(false);
  protected readonly todayInvoiceError = signal('');
  protected readonly invoiceError = signal('');
  protected readonly dailySalesModalOpen = signal(false);
  protected readonly cutModalOpen = signal(false);
  protected readonly cutRows = signal<DailyCut[]>([]);
  protected readonly cutPreview = signal<DailyCut | null>(null);
  protected readonly cutLoading = signal(false);
  protected readonly cutSaving = signal(false);
  protected readonly cutError = signal('');
  protected readonly cutFilterFromDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly cutFilterToDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly selectedCutId = signal<number | null>(null);
  protected readonly creditPaymentRows = signal<CreditPayment[]>([]);
  protected readonly logoutCutModalOpen = signal(false);
  protected readonly logoutCutPreview = signal<DailyCut | null>(null);
  protected readonly logoutPhysicalCashCount = signal('');
  protected readonly logoutCutLoading = signal(false);
  protected readonly logoutCutSaving = signal(false);
  protected readonly logoutCutError = signal('');
  protected readonly openingCutModalOpen = signal(false);
  protected readonly openingCashAmount = signal('');
  protected readonly openingCutSaving = signal(false);
  protected readonly openingCutError = signal('');
  protected readonly invoicePage = signal(1);
  protected readonly invoicePageSize = 10;
  protected readonly purchasePage = signal(1);
  protected readonly purchasePageSize = 10;
  protected readonly selectedCostYear = signal(new Date().getFullYear());
  protected readonly selectedCostMonth = signal(new Date().getMonth() + 1);
  protected readonly selectedCostCategory = signal('Todas');
  protected readonly costIncreaseAlertRows = signal<CostIncreaseAlertRow[]>([]);
  protected readonly costIncreaseAlertPeriod = signal<{ year: number; month: number } | null>(null);
  protected readonly costIncreaseAlertLoading = signal(false);
  protected readonly costIncreaseAlertError = signal('');
  protected readonly operationalCostRows = signal<OperationalCostRow[]>([]);
  protected readonly operationalCostLoading = signal(false);
  protected readonly operationalCostError = signal('');
  protected readonly operationalCostSaving = signal(false);
  protected readonly operationalCostModalOpen = signal(false);
  protected readonly operationalCostDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly operationalCostType = signal('Energia electrica');
  protected readonly operationalCostDescription = signal('');
  protected readonly operationalCostAmount = signal(0);
  protected readonly operationalCostPurchaseInvoiceKey = signal('');
  protected readonly operationalCostAppliesTo = signal('MES');
  protected readonly operationalCostReference = signal('');
  protected readonly purchaseMainModalOpen = signal(false);
  protected readonly purchaseModalOpen = signal(false);
  protected readonly estimatedPurchaseModalOpen = signal(false);
  protected readonly purchaseOcrModalOpen = signal(false);
  protected readonly purchaseModalError = signal('');
  protected readonly purchaseModalSaving = signal(false);
  protected readonly purchasePaymentTypeId = signal(1);
  protected readonly purchaseSupplierId = signal<number | null>(null);
  protected readonly expandedPurchaseSupplierId = signal<number | null>(null);
  protected readonly expandedPurchaseInvoiceKey = signal<string | null>(null);
  protected readonly purchaseInvoiceNumber = signal('');
  protected readonly purchaseProductId = signal<number | null>(null);
  protected readonly purchaseQuantity = signal(1);
  protected readonly purchaseUnitCost = signal(0);
  protected readonly purchaseTransportCost = signal(0);
  protected readonly purchaseOtherDirectCost = signal(0);
  protected readonly purchaseDraftLines = signal<PurchaseDraftLine[]>([]);
  protected readonly estimatedPurchaseReasons = signal<Record<number, string>>({});
  protected readonly estimatedPurchaseLines = signal<EstimatedPurchaseLine[]>([]);
  protected readonly purchaseDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly purchaseAutoNotice = signal('');
  protected readonly purchaseInvoiceImageName = signal('');
  protected readonly purchaseInvoiceImagePreview = signal('');
  protected readonly purchaseInvoiceOcrStatus = signal('');
  protected readonly favoriteProductIds = signal<number[]>([]);
  private purchaseInvoiceImageFile: File | null = null;
  protected readonly purchaseTrendPeriod = signal<PurchaseTrendPeriod>('month');
  protected readonly invoicesSummary = signal<InvoicesSummaryResponse>({
    invoiceCount: 0,
    activeTotal: 0,
    annulledCount: 0,
    creditTotal: 0,
  });
  protected readonly nextInvoiceNumber = signal<number | null>(null);
  protected readonly dashboardSalesSummary = signal<DashboardSalesSummaryResponse>({
    cashTransferTotal: 0,
    currentMonthCashTransferTotal: 0,
    creditTotal: 0,
    currentMonthCreditTotal: 0,
    lastMonthSalesTotal: 0,
    accumulatedSalesTotal: 0,
    totalPurchases: 0,
    accumulatedPurchasesTotal: 0,
    lastMonthLabel: '',
    purchaseMonthLabel: '',
  });
  protected readonly dashboardCashTransferView = signal<'month' | 'accumulated'>('month');
  protected readonly dashboardCreditView = signal<'month' | 'accumulated'>('month');
  protected readonly dashboardSalesTotalView = signal<'month' | 'accumulated'>('month');
  protected readonly dashboardPurchasesTotalView = signal<'month' | 'accumulated'>('month');
  protected readonly salesTrendPeriod = signal<SalesTrendPeriod>('month');
  protected readonly payrollTrendPeriod = signal<PayrollTrendPeriod>('week');
  protected readonly salesTrendData = signal<SalesTrendPoint[]>([]);
  protected readonly expandedCreditCustomerIds = signal<Set<number>>(new Set());
  protected readonly expandedCreditInvoiceIds = signal<Set<number>>(new Set());
  protected readonly currentUser = signal<LoginResponse['user'] | null>(null);
  protected readonly activePage = signal<Page>('billing');
  protected readonly activeMode = signal<Mode>('sale');
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('Todas');
  protected readonly inventoryModalOpen = signal(false);
  protected readonly themeMenuOpen = signal(false);
  protected readonly activeThemeId = signal<ThemeId>('black-green');
  protected readonly billingPage = signal(1);
  protected readonly billingPageSize = 15;
  protected readonly costsPage = signal(1);
  protected readonly costsPageSize = 12;
  protected readonly inventoryPage = signal(1);
  protected readonly inventoryPageSize = 12;
  protected readonly kardexPage = signal(1);
  protected readonly kardexPageSize = 8;
  protected readonly themes: ThemeOption[] = [
    { id: 'black-green', name: 'Black green', tone: 'Oscuro' },
    { id: 'forest-light', name: 'Bosque claro', tone: 'Claro' },
    { id: 'steel-light', name: 'Acero claro', tone: 'Claro' },
    { id: 'ember-dark', name: 'Carbon gradiente', tone: 'Oscuro' },
    { id: 'emerald-dark', name: 'Esmeralda gradiente', tone: 'Oscuro' },
    { id: 'analytics-dark', name: 'Analytics noche', tone: 'Oscuro' },
    { id: 'crm-dark', name: 'CRM neon', tone: 'Oscuro' },
  ];

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE ARREGLO DEFINE LAS FORMAS DE PAGO DISPONIBLES EN EL FORMULARIO DE VENTA.
  protected readonly paymentMethodOptions: Array<{ id: PaymentMethod; paymentTypeId: number; label: string; shortLabel: string }> = [
    { id: 'efectivo', paymentTypeId: 1, label: 'Efectivo', shortLabel: 'EF' },
    { id: 'credito', paymentTypeId: 2, label: 'Credito', shortLabel: 'CR' },
    { id: 'transferencia', paymentTypeId: 3, label: 'Transferencia', shortLabel: 'TR' },
  ];

  protected readonly dashboardMonths: DashboardMonth[] = [
    { month: 'Julio', sales: 14200, purchases: 9800 },
    { month: 'Agosto', sales: 15100, purchases: 11200 },
    { month: 'Septiembre', sales: 12150, purchases: 8200 },
    { month: 'Octubre', sales: 16300, purchases: 12800 },
    { month: 'Noviembre', sales: 18400, purchases: 11550 },
    { month: 'Diciembre', sales: 20700, purchases: 13200 },
  ];

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GENERA EL SELECTOR DE CLIENTES CON CREDITOS ABIERTOS.
  // USA LOS DATOS CARGADOS POR loadCredits(), QUE LLAMA /api/credits O electronAPI.getCredits().
  protected readonly creditCustomerOptions = computed(() => {
    const customers = new Map<number, { id: number; name: string; openCredits: number; balance: number }>();

    for (const credit of this.creditLines()) {
      if (!customers.has(credit.customerId)) {
        customers.set(credit.customerId, {
          id: credit.customerId,
          name: credit.customerName,
          openCredits: credit.openCredits,
          balance: credit.customerBalance,
        });
      }
    }

    return [...customers.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly expiringProductsCount = computed(() => this.expiringProductAlerts().length);
  protected readonly salesDropAlert = signal<SalesDropAlert>({
    isActive: false,
    shouldAlert: false,
    severity: 'pending',
    evaluatedAt: null,
    cutoffTime: null,
    todayTotal: 0,
    yesterdayTotal: 0,
    referenceDate: null,
    isReferenceFallback: false,
    shortfallAmount: 0,
    dropPercentage: 0,
  });
  protected readonly salesDropAlertCount = computed(() => this.salesDropAlert().shouldAlert ? 1 : 0);
  protected readonly salesDropMissingPercentage = computed(() => {
    const alert = this.salesDropAlert();

    if (alert.yesterdayTotal > 0) {
      return alert.dropPercentage;
    }

    return alert.todayTotal <= 0 ? 100 : 0;
  });
  protected readonly salesDropAlertComparisonTooltip = computed(() => {
    const alert = this.salesDropAlert();
    const date = alert.referenceDate ? this.formatReferenceDate(alert.referenceDate) : 'Sin fecha';
    const amount = this.formatLempiraAmount(alert.yesterdayTotal);
    const source = alert.isReferenceFallback
      ? 'ultimo dia con ventas registradas'
      : 'dia anterior';

    return `Comparado contra ${source}: ${date}, ${amount}`;
  });
  protected readonly salesDropAlertStatusLabel = computed(() => {
    const alert = this.salesDropAlert();

    if (!alert.isActive) {
      return 'Se evalua a las 7:00 PM';
    }

    if (!alert.shouldAlert) {
      return 'Sin caida frente a la referencia';
    }

    if (alert.severity === 'critical') {
      return 'Caida critica';
    }

    if (alert.severity === 'warning') {
      return 'Caida de precaucion';
    }

    return 'Caida leve';
  });
  protected readonly salesDropAlertSeverityLabel = computed(() => {
    const severity = this.salesDropAlert().severity;

    if (severity === 'critical') {
      return 'Critica';
    }

    if (severity === 'warning') {
      return 'Precaucion';
    }

    if (severity === 'low') {
      return 'Leve';
    }

    if (severity === 'normal') {
      return 'Normal';
    }

    return 'Pendiente';
  });

  private formatReferenceDate(value: string): string {
    const [year, month, day] = value.slice(0, 10).split('-');

    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }

  private formatLempiraAmount(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      currency: 'HNL',
      style: 'currency',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected auditActionClass(action: string): string {
    const normalizedAction = this.normalizeText(action);

    if (normalizedAction.includes('insert')) {
      return 'insert';
    }

    if (normalizedAction.includes('update')) {
      return 'update';
    }

    if (normalizedAction.includes('delete')) {
      return 'delete';
    }

    return 'movement';
  }

  protected splitAuditData(value: string): string[] {
    return String(value || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  protected readonly highestExpiringStockAlert = computed<ExpiringProductAlert | null>(() => {
    const alerts = this.expiringProductAlerts().filter((alert) => alert.stock > 0);

    if (alerts.length === 0) {
      return null;
    }

    return alerts.reduce((current, candidate) => (candidate.stock > current.stock ? candidate : current));
  });

  protected readonly lowestExpiringStockAlert = computed<ExpiringProductAlert | null>(() => {
    const alerts = this.expiringProductAlerts().filter((alert) => alert.stock > 0);

    if (alerts.length === 0) {
      return null;
    }

    return alerts.reduce((current, candidate) => (candidate.stock < current.stock ? candidate : current));
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO FILTRA LA TABLA MASTER DE CREDITOS POR NOMBRE DE CLIENTE O USUARIO.
  // TAMBIEN FILTRA POR EL CLIENTE SELECCIONADO EN EL SELECTOR DE CREDITOS ABIERTOS.
  protected readonly filteredCreditLines = computed(() => {
    const search = this.creditSearchTerm().trim().toLowerCase();
    const selectedCustomerId = this.selectedCreditCustomerId();

    return this.creditLines().filter((credit) => {
      const matchesSearch = !search || credit.customerName.toLowerCase().includes(search) || credit.user.toLowerCase().includes(search);
      const matchesCustomer = !selectedCustomerId || credit.customerId === selectedCustomerId;

      return matchesSearch && matchesCustomer;
    });
  });

  protected readonly totalCreditAmount = computed(() =>
    this.filteredCreditLines().reduce((total, credit) => total + credit.pendingAmount, 0),
  );

  protected readonly totalCreditUtility = computed(() =>
    this.filteredCreditLines().reduce((total, credit) => total + credit.utility, 0),
  );

  protected readonly openCreditCustomersCount = computed(() =>
    new Set(this.filteredCreditLines().map((credit) => credit.customerId)).size,
  );

  protected readonly openCreditRowsCount = computed(() => this.filteredCreditLines().length);

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO AGRUPA LOS CREDITOS ABIERTOS POR NUMERO DE FACTURA PARA LA TABLA MASTER COLAPSABLE.
  // USA LOS DATOS DE filteredCreditLines(), QUE VIENEN DE loadCredits() Y LA CONSULTA listCredits() EN server/data-access.js.
  protected readonly creditInvoiceGroups = computed<CreditInvoiceGroup[]>(() => {
    const groups = new Map<number, CreditInvoiceGroup>();

    for (const credit of this.filteredCreditLines()) {
      const existingGroup = groups.get(credit.invoiceId);

      if (existingGroup) {
        existingGroup.total += credit.pendingAmount;
        existingGroup.utility += credit.utility;
        existingGroup.lines.push(credit);
        continue;
      }

      groups.set(credit.invoiceId, {
        invoiceId: credit.invoiceId,
        customerId: credit.customerId,
        customerName: credit.customerName,
        customerPhone: credit.customerPhone,
        openCredits: credit.openCredits,
        customerBalance: credit.customerBalance,
        saleStatusName: credit.saleStatusName,
        total: credit.pendingAmount,
        utility: credit.utility,
        lines: [credit],
      });
    }

    return [...groups.values()].sort((a, b) => b.invoiceId - a.invoiceId);
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO AGRUPA LOS CREDITOS PRIMERO POR CLIENTE Y LUEGO POR FACTURA.
  // USA creditInvoiceGroups(), QUE SE ALIMENTA DE listCredits() EN server/data-access.js.
  protected readonly creditCustomerGroups = computed<CreditCustomerGroup[]>(() => {
    const groups = new Map<number, CreditCustomerGroup>();

    for (const invoice of this.creditInvoiceGroups()) {
      const existingGroup = groups.get(invoice.customerId);

      if (existingGroup) {
        existingGroup.total += invoice.total;
        existingGroup.utility += invoice.utility;
        existingGroup.articleCount += invoice.lines.length;
        existingGroup.invoices.push(invoice);
        continue;
      }

      groups.set(invoice.customerId, {
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        openCredits: invoice.openCredits,
        customerBalance: invoice.customerBalance,
        articleCount: invoice.lines.length,
        total: invoice.total,
        utility: invoice.utility,
        invoices: [invoice],
      });
    }

    return [...groups.values()].sort((a, b) => b.total - a.total);
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO CONSTRUYE EL GRAFICO DE TENDENCIA DE COMPRAS CON DATOS REALES
  // CARGADOS DESDE dbo.COMPRA_EFECTIVO Y dbo.COMPRA_CREDITO.
  protected readonly purchasesTrendData = computed<DashboardTrendItem[]>(() => {
    const period = this.purchaseTrendPeriod();
    const purchases = this.purchaseRows();

    if (period === 'year') {
      const totalsByYear = new Map<number, number>();

      for (const purchase of purchases) {
        const date = new Date(purchase.createdAt || '');
        if (Number.isNaN(date.getTime())) {
          continue;
        }

        const year = date.getFullYear();
        totalsByYear.set(year, (totalsByYear.get(year) || 0) + purchase.total);
      }

      return [...totalsByYear.entries()]
        .sort(([yearA], [yearB]) => yearA - yearB)
        .map(([year, value]) => ({ label: String(year), value }));
    }

    const periods = this.buildPurchaseTrendPeriods(period);
    const totalsByPeriod = new Map<string, number>();

    for (const purchase of purchases) {
      const date = new Date(purchase.createdAt || '');
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const key = this.purchaseTrendPeriodKey(date, period);
      totalsByPeriod.set(key, (totalsByPeriod.get(key) || 0) + purchase.total);
    }

    return periods.map((item) => ({ label: item.label, value: totalsByPeriod.get(item.key) || 0 }));
  });

  protected readonly recentInvoices: DashboardInvoice[] = [
    { date: new Date('2026-04-06T10:15:00'), code: 'FV-1042', amount: 1220, status: 'Pagada' },
    { date: new Date('2026-04-04T16:40:00'), code: 'FV-1038', amount: 350, status: 'Pendiente' },
    { date: new Date('2026-03-29T11:50:00'), code: 'FV-1029', amount: 2450, status: 'Pagada' },
    { date: new Date('2026-03-25T14:35:00'), code: 'FV-1021', amount: 500, status: 'Fallida' },
  ];

  protected readonly attendanceUsers = signal<AttendanceUser[]>([]);
  protected readonly attendanceExpandedUserIds = signal<number[]>([]);
  protected readonly attendanceExpandedWeekKeys = signal<string[]>([]);
  protected readonly payrollExpandedUserIds = signal<number[]>([]);
  protected readonly payrollExpandedWeekKeys = signal<string[]>([]);
  protected readonly attendanceMarkModalOpen = signal(false);
  protected readonly attendanceMarkSaving = signal(false);
  protected readonly attendanceMarkError = signal('');
  protected readonly attendanceMarkUserId = signal<number | null>(null);
  protected readonly attendanceMarkDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly attendanceMarkEntryTime = signal('08:00');
  protected readonly attendanceMarkExitTime = signal('17:00');
  protected readonly selectedAttendanceWeek = signal<number | null>(null);
  protected readonly payrollBonuses = signal<PayrollBonusMatrix>({});
  protected readonly payrollDays: PayrollDay[] = [
    { id: 'monday', name: 'Lunes' },
    { id: 'tuesday', name: 'Martes' },
    { id: 'wednesday', name: 'Miercoles' },
    { id: 'thursday', name: 'Jueves' },
    { id: 'friday', name: 'Viernes' },
    { id: 'saturday', name: 'Sabado' },
    { id: 'sunday', name: 'Domingo' },
  ];
  protected readonly payrollShifts: PayrollShift[] = [
    { id: 'morning', name: 'Diurna', schedule: '8:00 AM - 3:00 PM', rate: 85 },
    { id: 'afternoon', name: 'Mixta', schedule: '3:00 PM - 7:00 PM', rate: 105 },
    { id: 'night', name: 'Nocturna', schedule: '7:00 PM - 11:00 PM', rate: 130 },
  ];
  protected readonly payrollHours = signal<PayrollHoursMatrix>({});
  protected readonly categoryTrendLayers = [24, 20, 16, 12, 8, 4];

  protected readonly products = signal<Product[]>([
    {
      id: 1,
      sku: 'CAM-001',
      name: 'Camisa blanca clasica',
      category: 'Camisas',
      stock: 42,
      minStock: 12,
      unitCost: 185,
      salePrice: 310,
      margin: 0.42,
    },
    {
      id: 2,
      sku: 'PAN-018',
      name: 'Pantalon denim recto',
      category: 'Pantalones',
      stock: 18,
      minStock: 10,
      unitCost: 420,
      salePrice: 650,
      margin: 0.36,
    },
    {
      id: 3,
      sku: 'ZAP-024',
      name: 'Zapato casual cuero',
      category: 'Calzado',
      stock: 9,
      minStock: 8,
      unitCost: 690,
      salePrice: 1040,
      margin: 0.34,
    },
    {
      id: 4,
      sku: 'ACC-007',
      name: 'Faja ejecutiva',
      category: 'Accesorios',
      stock: 31,
      minStock: 14,
      unitCost: 155,
      salePrice: 260,
      margin: 0.4,
    },
    {
      id: 5,
      sku: 'VES-011',
      name: 'Vestido formal azul',
      category: 'Vestidos',
      stock: 13,
      minStock: 6,
      unitCost: 510,
      salePrice: 820,
      margin: 0.38,
    },
    {
      id: 6,
      sku: 'CAM-032',
      name: 'Camiseta deportiva',
      category: 'Camisas',
      stock: 55,
      minStock: 20,
      unitCost: 140,
      salePrice: 235,
      margin: 0.4,
    },
  ]);
  protected readonly inventoryEditingProductId = signal<number | null>(null);
  protected readonly inventoryDraft = signal<InventoryDraft>({
    sku: 'NVO-001',
    name: '',
    imageUrl: '',
    category: 'Camisas',
    stock: 0,
    minStock: 5,
    maxStock: 0,
    unitCost: 0,
    salePrice: 0,
  });

  protected readonly cart = signal<CartLine[]>([
    { productId: 1, quantity: 2 },
    { productId: 4, quantity: 1 },
  ]);
  protected readonly purchaseCosts = signal<Record<number, number>>({});

  protected readonly history = signal<PriceHistory[]>([
    {
      product: 'Pantalon denim recto',
      user: 'Seydi Pena',
      date: new Date('2026-04-03T09:30:00'),
      previousCost: 395,
      newCost: 420,
      previousPrice: 625,
      newPrice: 650,
      reason: 'Compra con proveedor principal',
    },
    {
      product: 'Zapato casual cuero',
      user: 'Melvin Pena',
      date: new Date('2026-03-28T15:20:00'),
      previousCost: 650,
      newCost: 690,
      previousPrice: 980,
      newPrice: 1040,
      reason: 'Ajuste por costo de importacion',
    },
    {
      product: 'Faja ejecutiva',
      user: 'Carlos Lara',
      date: new Date('2026-03-20T11:10:00'),
      previousCost: 145,
      newCost: 155,
      previousPrice: 245,
      newPrice: 260,
      reason: 'Reposicion de inventario',
    },
  ]);
  protected readonly auditHistory = signal<AuditHistoryRecord[]>([]);
  protected readonly auditHistoryLoading = signal(false);
  protected readonly auditHistoryError = signal('');
  protected readonly auditHistoryTablesCount = computed(() =>
    new Set(this.auditHistory().map((item) => item.tableName)).size,
  );
  protected readonly auditHistoryLastRecord = computed(() => this.auditHistory()[0] || null);
  protected readonly auditUserTrendSeries = computed(() => {
    const records = this.auditHistory()
      .filter((item) => Boolean(item.date))
      .map((item) => ({
        user: item.user || 'Sistema',
        dayKey: String(item.date).slice(0, 10),
        dayLabel: this.formatReferenceDate(String(item.date).slice(0, 10)),
      }));
    const dayLabels = new Map<string, string>();
    const totalsByUser = new Map<string, number>();
    const totalsByUserAndDay = new Map<string, Map<string, number>>();

    for (const record of records) {
      dayLabels.set(record.dayKey, record.dayLabel);
      totalsByUser.set(record.user, (totalsByUser.get(record.user) || 0) + 1);

      const userTotals = totalsByUserAndDay.get(record.user) || new Map<string, number>();
      userTotals.set(record.dayKey, (userTotals.get(record.dayKey) || 0) + 1);
      totalsByUserAndDay.set(record.user, userTotals);
    }

    const days = [...dayLabels.keys()].sort();
    const topUsers = [...totalsByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user]) => user);

    return {
      labels: days.map((day) => dayLabels.get(day) || day),
      datasets: topUsers.map((user) => ({
        label: user,
        data: days.map((day) => totalsByUserAndDay.get(user)?.get(day) || 0),
      })),
    };
  });

  protected readonly movements = signal<Movement[]>([
    {
      date: new Date('2026-04-06T10:15:00'),
      type: 'Venta',
      detail: 'Factura FV-1042',
      total: 1220,
    },
    {
      date: new Date('2026-04-05T13:05:00'),
      type: 'Compra',
      detail: 'Orden OC-220',
      total: 8450,
    },
    {
      date: new Date('2026-04-04T16:40:00'),
      type: 'Ajuste',
      detail: 'Actualizacion de precio final',
      total: 350,
    },
  ]);

  protected readonly categories = computed(() => [
    'Todas',
    ...new Set(this.products().map((product) => product.category)),
  ]);

  protected readonly filteredProducts = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();
    const favoriteIds = new Set(this.favoriteProductIds());

    return this.products().filter((product) => {
      const matchesCategory = category === 'Todas' || product.category === category;
      const matchesSearch =
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search);

      return matchesCategory && matchesSearch;
    }).sort((productA, productB) => {
      const favoriteScoreA = favoriteIds.has(productA.id) ? 1 : 0;
      const favoriteScoreB = favoriteIds.has(productB.id) ? 1 : 0;

      if (favoriteScoreA !== favoriteScoreB) {
        return favoriteScoreB - favoriteScoreA;
      }

      const previousMonthSalesA = Number(productA.previousMonthSales || 0);
      const previousMonthSalesB = Number(productB.previousMonthSales || 0);

      if (previousMonthSalesA !== previousMonthSalesB) {
        return previousMonthSalesB - previousMonthSalesA;
      }

      return productA.name.localeCompare(productB.name);
    });
  });

  protected readonly cartDetails = computed(() =>
    this.cart()
      .map((line) => {
        const product = this.products().find((item) => item.id === line.productId);
        if (!product) {
          return null;
        }

        const unitPrice =
          this.activeMode() === 'purchase'
            ? this.purchaseCosts()[product.id] ?? product.unitCost
            : product.salePrice;
        return {
          ...line,
          product,
          unitPrice,
          subtotal: unitPrice * line.quantity,
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line)),
  );

  protected readonly cartTotal = computed(() =>
    this.cartDetails().reduce((total, line) => total + line.subtotal, 0),
  );

  protected readonly saleProfit = computed(() =>
    this.cartDetails().reduce(
      (total, line) => total + (line.product.salePrice - line.product.unitCost) * line.quantity,
      0,
    ),
  );

  protected readonly totalUnits = computed(() =>
    this.products().reduce((total, product) => total + product.stock, 0),
  );

  protected readonly inventoryValue = computed(() =>
    this.products().reduce((total, product) => total + product.stock * product.unitCost, 0),
  );

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO OBTIENE EL VALOR TOTAL DEL INVENTARIO
  // SUMANDO PRECIO DE VENTA POR STOCK DE CADA PRODUCTO.
  protected readonly inventoryRetailValue = computed(() =>
    this.products().reduce((total, product) => total + product.stock * product.salePrice, 0),
  );

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO OBTIENE LA CANTIDAD TOTAL DE ARTICULOS REGISTRADOS
  // TOMANDO EL TOTAL DE PRODUCTOS CARGADOS DESDE LA BASE DE DATOS.
  protected readonly registeredProductsCount = computed(() => this.products().length);

  protected readonly lowStockCount = computed(
    () => this.products().filter((product) => product.stock <= product.minStock).length,
  );

  protected readonly lowStockAlerts = computed(() =>
    this.products()
      .filter((product) => product.stock <= product.minStock)
      .sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock)),
  );

  protected readonly highestLowStockAlert = computed<Product | null>(() => {
    const alerts = this.lowStockAlerts().filter((product) => product.stock > 0);
    if (alerts.length === 0) {
      return null;
    }
    return alerts.reduce((current, candidate) => (candidate.stock > current.stock ? candidate : current));
  });

  protected readonly lowestLowStockAlert = computed<Product | null>(() => {
    const alerts = this.lowStockAlerts();
    if (alerts.length === 0) {
      return null;
    }
    return alerts.reduce((current, candidate) => (candidate.stock < current.stock ? candidate : current));
  });

  protected readonly outOfStockProducts = computed(() =>
    this.products().filter((product) => product.stock === 0),
  );

  protected readonly outOfStockCount = computed(() => this.outOfStockProducts().length);

  protected readonly outOfStockReorderCost = computed(() =>
    this.outOfStockProducts().reduce((total, product) => total + product.minStock * product.unitCost, 0),
  );

  protected readonly inventoryPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / this.inventoryPageSize)),
  );

  protected readonly kardexPageCount = computed(() =>
    Math.max(1, Math.ceil(this.outOfStockProducts().length / this.kardexPageSize)),
  );

  protected readonly billingPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / this.billingPageSize)),
  );

  protected readonly filteredCostProducts = computed(() => {
    const category = this.selectedCostCategory();

    return this.products().filter((product) => category === 'Todas' || product.category === category);
  });

  protected readonly costsPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredCostProducts().length / this.costsPageSize)),
  );

  protected readonly paginatedBillingProducts = computed(() => {
    const page = Math.min(this.billingPage(), this.billingPageCount());
    const start = (page - 1) * this.billingPageSize;
    return this.filteredProducts().slice(start, start + this.billingPageSize);
  });

  protected readonly paginatedCostProducts = computed(() => {
    const page = Math.min(this.costsPage(), this.costsPageCount());
    const start = (page - 1) * this.costsPageSize;
    return this.filteredCostProducts().slice(start, start + this.costsPageSize);
  });

  protected readonly billingPageStart = computed(() =>
    this.filteredProducts().length === 0 ? 0 : (Math.min(this.billingPage(), this.billingPageCount()) - 1) * this.billingPageSize + 1,
  );

  protected readonly billingPageEnd = computed(() =>
    Math.min(this.billingPageStart() + this.paginatedBillingProducts().length - 1, this.filteredProducts().length),
  );

  protected readonly costsPageStart = computed(() =>
    this.filteredCostProducts().length === 0 ? 0 : (Math.min(this.costsPage(), this.costsPageCount()) - 1) * this.costsPageSize + 1,
  );

  protected readonly costsPageEnd = computed(() =>
    Math.min(this.costsPageStart() + this.paginatedCostProducts().length - 1, this.filteredCostProducts().length),
  );

  protected readonly paginatedInventoryProducts = computed(() => {
    const page = Math.min(this.inventoryPage(), this.inventoryPageCount());
    const start = (page - 1) * this.inventoryPageSize;
    return this.filteredProducts().slice(start, start + this.inventoryPageSize);
  });

  protected readonly paginatedOutOfStockProducts = computed(() => {
    const page = Math.min(this.kardexPage(), this.kardexPageCount());
    const start = (page - 1) * this.kardexPageSize;
    return this.outOfStockProducts().slice(start, start + this.kardexPageSize);
  });

  protected readonly inventoryPageStart = computed(() =>
    this.filteredProducts().length === 0 ? 0 : (Math.min(this.inventoryPage(), this.inventoryPageCount()) - 1) * this.inventoryPageSize + 1,
  );

  protected readonly inventoryPageEnd = computed(() =>
    Math.min(this.inventoryPageStart() + this.paginatedInventoryProducts().length - 1, this.filteredProducts().length),
  );

  protected readonly invoicePageCount = computed(() =>
    Math.max(1, Math.ceil(this.invoiceRows().length / this.invoicePageSize)),
  );

  protected readonly paginatedInvoices = computed(() => {
    const page = Math.min(this.invoicePage(), this.invoicePageCount());
    const start = (page - 1) * this.invoicePageSize;
    return this.invoiceRows().slice(start, start + this.invoicePageSize);
  });

  protected readonly invoicePageStart = computed(() =>
    this.invoiceRows().length === 0 ? 0 : (Math.min(this.invoicePage(), this.invoicePageCount()) - 1) * this.invoicePageSize + 1,
  );

  protected readonly invoicePageEnd = computed(() =>
    Math.min(this.invoicePageStart() + this.paginatedInvoices().length - 1, this.invoiceRows().length),
  );

  protected readonly todayInvoiceTotal = computed(() =>
    this.todayInvoiceRows().reduce((total, invoice) => total + invoice.total, 0),
  );

  protected readonly selectedCut = computed(() =>
    this.cutRows().find((cut) => cut.id === this.selectedCutId()) || this.cutRows()[0] || this.cutPreview(),
  );

  protected readonly purchaseHistoryRows = computed(() =>
    [...this.purchaseRows()].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
  );

  protected readonly costYearOptions = computed(() => {
    const years = new Set<number>([new Date().getFullYear()]);

    for (const purchase of this.purchaseHistoryRows()) {
      const purchaseDate = new Date(purchase.createdAt || '');
      if (!Number.isNaN(purchaseDate.getTime())) {
        years.add(purchaseDate.getFullYear());
      }
    }

    return [...years].sort((a, b) => b - a);
  });

  protected readonly costMonthOptions = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  protected readonly costIncreaseAlertPeriodLabel = computed(() => {
    const period = this.costIncreaseAlertPeriod();

    if (!period) {
      return 'Sin periodo detectado';
    }

    const month = this.costMonthOptions.find((item) => item.value === period.month);
    return `${month?.label || `Mes ${period.month}`} ${period.year}`;
  });

  protected readonly monthlyVariableCost = computed(() =>
    this.products().reduce((total, product) => total + Math.max(product.stock, 0) * product.salePrice, 0),
  );

  protected readonly monthlyFixedCostEstimate = computed(() =>
    this.products().reduce((total, product) => total + Math.max(product.stock, 0) * product.unitCost, 0),
  );

  protected readonly monthlyOperatingCost = computed(() =>
    this.monthlyVariableCost() - this.monthlyFixedCostEstimate(),
  );

  protected readonly monthlyOperatingMargin = computed(() => {
    const sales = this.monthlyVariableCost();

    if (sales <= 0) {
      return 0;
    }

    return this.monthlyOperatingCost() / sales;
  });

  protected readonly costDistributionSeries = computed(() => ([
    {
      label: 'Costo actual',
      value: this.monthlyFixedCostEstimate(),
      color: this.isBlackGreenTheme() ? '#8bd34f' : '#f97316',
    },
    {
      label: 'Utilidad potencial',
      value: Math.max(this.monthlyOperatingCost(), 0),
      color: this.isBlackGreenTheme() ? '#66b63f' : '#14b8a6',
    },
  ]));

  protected readonly dashboardPayrollChartRows = computed<DashboardModuleChartRow[]>(() => {
    const rows = this.payrollTopEarners().slice(0, 5);
    const maxValue = Math.max(1, ...rows.map((row) => row.pay));

    return rows.map((row) => ({
      label: row.user.name,
      value: Number(row.pay.toFixed(2)),
      percent: Math.max(4, Math.round((row.pay / maxValue) * 100)),
    }));
  });

  protected readonly dashboardAttendanceChartRows = computed<DashboardModuleChartRow[]>(() => {
    const total = this.attendanceRecords();

    if (total === 0) {
      return [];
    }

    const late = this.lateAttendanceCount();
    const punctual = this.punctualAttendanceCount();
    const pending = Math.max(total - late - punctual, 0);
    const rows = [
      { label: 'Puntuales', value: punctual },
      { label: 'Tardes', value: late },
      { label: 'Sin marca final', value: pending },
    ].filter((row) => row.value > 0);
    const maxValue = Math.max(1, ...rows.map((row) => row.value));

    return rows.map((row) => ({
      ...row,
      percent: Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / maxValue) * 100)),
    }));
  });

  protected readonly dashboardInventoryChartRows = computed<DashboardModuleChartRow[]>(() => {
    const products = this.products();

    if (products.length === 0) {
      return [];
    }

    const outOfStock = products.filter((product) => product.stock <= 0).length;
    const lowStock = products.filter((product) => product.stock > 0 && product.stock <= product.minStock).length;
    const available = products.filter((product) => product.stock > product.minStock).length;
    const rows = [
      { label: 'Disponibles', value: available },
      { label: 'Stock bajo', value: lowStock },
      { label: 'Agotados', value: outOfStock },
    ];
    const maxValue = Math.max(1, ...rows.map((row) => row.value));

    return rows.map((row) => ({
      ...row,
      percent: Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / maxValue) * 100)),
    }));
  });

  protected readonly dashboardCostChartRows = computed<DashboardModuleChartRow[]>(() => {
    const rows = this.costCategorySeries()
      .slice(0, 6)
      .map((item) => ({
        label: item.category,
        value: Number(item.total.toFixed(2)),
      }));

    if (rows.every((row) => row.value <= 0)) {
      return [];
    }

    const maxValue = Math.max(1, ...rows.map((row) => row.value));

    return rows.map((row) => ({
      ...row,
      percent: Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / maxValue) * 100)),
    }));
  });

  protected readonly dashboardHistoryChartRows = computed<DashboardModuleChartRow[]>(() => {
    const rows = this.auditUserTrendSeries().datasets.map((dataset) => ({
      label: dataset.label,
      value: dataset.data.reduce((total, value) => total + value, 0),
    }));
    const maxValue = Math.max(1, ...rows.map((row) => row.value));

    return rows.map((row) => ({
      ...row,
      percent: Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / maxValue) * 100)),
    }));
  });

  protected readonly costCategorySeries = computed<CostCategoryPoint[]>(() => {
    const categoryTotals = new Map<string, number>();

    for (const product of this.products()) {
      const category = product.category || 'Sin categoria';
      const total = Math.max(product.stock, 0) * product.unitCost;
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + total);
    }

    return [...categoryTotals.entries()]
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  });

  protected readonly costCategorySaleValueSeries = computed<Array<{ category: string; saleTotal: number }>>(() => {
    const categoryTotals = new Map<string, number>();

    for (const product of this.products()) {
      const category = product.category || 'Sin categoria';
      const total = Math.max(product.stock, 0) * product.salePrice;
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + total);
    }

    return [...categoryTotals.entries()]
      .map(([category, saleTotal]) => ({
        category,
        saleTotal: Number(saleTotal.toFixed(2)),
      }))
      .sort((a, b) => b.saleTotal - a.saleTotal)
      .slice(0, 8);
  });

  protected readonly costCategoryComparisonSeries = computed<CostCategoryComparisonPoint[]>(() => {
    const costMap = new Map(this.costCategorySeries().map((item) => [item.category, item.total]));
    const saleMap = new Map(this.costCategorySaleValueSeries().map((item) => [item.category, item.saleTotal]));
    const categories = [...new Set([...costMap.keys(), ...saleMap.keys()])];

    return categories
      .map((category) => ({
        category,
        costTotal: Number((costMap.get(category) || 0).toFixed(2)),
        saleTotal: Number((saleMap.get(category) || 0).toFixed(2)),
      }))
      .sort((a, b) => b.costTotal - a.costTotal || b.saleTotal - a.saleTotal)
      .slice(0, 8);
  });

  protected readonly topCostCategory = computed<CostCategoryPoint | null>(() => this.costCategorySeries()[0] || null);

  protected readonly costMonthlyTrend = computed<CostMonthlyPoint[]>(() => {
    const monthMap = new Map<string, number>();
    const selectedYear = this.selectedCostYear();
    const validProductIds = new Set(this.products().map((product) => product.id));

    for (const purchase of this.purchaseHistoryRows()) {
      if (!validProductIds.has(purchase.productId)) {
        continue;
      }

      const purchaseDate = new Date(purchase.createdAt || '');
      if (Number.isNaN(purchaseDate.getTime())) {
        continue;
      }

      if (purchaseDate.getFullYear() !== selectedYear) {
        continue;
      }

      const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + purchase.total);
    }

    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, total]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthDate = new Date(year, month - 1, 1);

        return {
          label: new Intl.DateTimeFormat('es-HN', { month: 'short', year: '2-digit' }).format(monthDate),
          total,
        };
      });
  });

  protected readonly purchaseSupplierGroups = computed<PurchaseSupplierGroup[]>(() => {
    const supplierGroups = new Map<number, PurchaseSupplierGroup>();

    for (const purchase of this.purchaseHistoryRows()) {
      const supplierId = purchase.supplierId || 0;
      const supplierName = purchase.supplierName || 'Sin proveedor';
      let supplierGroup = supplierGroups.get(supplierId);

      if (!supplierGroup) {
        supplierGroup = {
          supplierId,
          supplierName,
          supplierPhone: purchase.supplierPhone,
          supplierAddress: purchase.supplierAddress,
          total: 0,
          invoiceCount: 0,
          lineCount: 0,
          invoices: [],
        };
        supplierGroups.set(supplierId, supplierGroup);
      }

      const invoiceNumber = purchase.invoiceNumber || `SIN-FACT-${purchase.id}`;
      const invoiceKey = `${supplierId}-${invoiceNumber}`;
      let invoiceGroup = supplierGroup.invoices.find((invoice) => invoice.key === invoiceKey);

      if (!invoiceGroup) {
        invoiceGroup = {
          key: invoiceKey,
          invoiceNumber,
          supplierId,
          supplierName,
          purchaseType: purchase.purchaseType,
          statusName: purchase.statusName,
          userName: purchase.userName,
          createdAt: purchase.createdAt,
          total: 0,
          quantity: 0,
          lines: [],
        };
        supplierGroup.invoices.push(invoiceGroup);
      }

      invoiceGroup.total += purchase.total;
      invoiceGroup.quantity += purchase.quantity;
      invoiceGroup.lines.push(purchase);
      supplierGroup.total += purchase.total;
      supplierGroup.lineCount += 1;
    }

    return [...supplierGroups.values()]
      .map((supplier) => ({
        ...supplier,
        invoiceCount: supplier.invoices.length,
        invoices: supplier.invoices.sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
      }))
      .sort((a, b) => b.total - a.total);
  });

  protected readonly purchaseInvoiceOptions = computed<PurchaseInvoiceOption[]>(() =>
    this.purchaseSupplierGroups()
      .flatMap((supplier) =>
        supplier.invoices.map((invoice) => ({
          key: invoice.key,
          purchaseId: Number(invoice.lines[0]?.id || 0),
          purchaseType: invoice.purchaseType,
          invoiceNumber: invoice.invoiceNumber,
          supplierName: supplier.supplierName,
          total: invoice.total,
          createdAt: invoice.createdAt,
        })),
      )
      .filter((invoice) => invoice.purchaseId > 0 && Boolean(invoice.invoiceNumber))
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
  );

  protected readonly purchasePageCount = computed(() =>
    Math.max(1, Math.ceil(this.purchaseHistoryRows().length / this.purchasePageSize)),
  );

  protected readonly paginatedPurchases = computed(() => {
    const page = Math.min(this.purchasePage(), this.purchasePageCount());
    const start = (page - 1) * this.purchasePageSize;
    return this.purchaseHistoryRows().slice(start, start + this.purchasePageSize);
  });

  protected readonly purchasePageStart = computed(() =>
    this.purchaseHistoryRows().length === 0 ? 0 : (Math.min(this.purchasePage(), this.purchasePageCount()) - 1) * this.purchasePageSize + 1,
  );

  protected readonly purchasePageEnd = computed(() =>
    Math.min(this.purchasePageStart() + this.paginatedPurchases().length - 1, this.purchaseHistoryRows().length),
  );

  protected readonly purchaseSummary = computed(() => {
    const purchases = this.purchaseHistoryRows();
    const supplierIds = new Set<number>();
    const creditSupplierIds = new Set<number>();
    let creditTotal = 0;

    for (const purchase of purchases) {
      if (purchase.supplierId > 0) {
        supplierIds.add(purchase.supplierId);
      }

      if (purchase.paymentTypeId === 2 || purchase.purchaseType.toLowerCase() === 'credito') {
        creditTotal += purchase.total;

        if (purchase.supplierId > 0) {
          creditSupplierIds.add(purchase.supplierId);
        }
      }
    }

    return {
      suppliersCount: supplierIds.size,
      transactionsCount: purchases.length,
      openCreditTotal: creditTotal,
      openCreditSuppliersCount: creditSupplierIds.size,
    };
  });

  protected readonly purchaseSuppliersCount = computed(() => this.purchaseSummary().suppliersCount);

  protected readonly purchaseTransactionsCount = computed(() => this.purchaseSummary().transactionsCount);

  protected readonly purchaseOpenCreditTotal = computed(() => this.purchaseSummary().openCreditTotal);

  protected readonly purchaseOpenCreditSuppliersCount = computed(() =>
    this.purchaseSummary().openCreditSuppliersCount,
  );

  protected readonly purchaseDraftTotal = computed(() =>
    this.purchaseDraftLines().reduce((total, line) => total + line.quantity * line.unitCost, 0),
  );

  protected readonly purchaseDraftUnits = computed(() =>
    this.purchaseDraftLines().reduce((total, line) => total + line.quantity, 0),
  );

  protected readonly purchaseAdditionalCostTotal = computed(() =>
    Math.max(this.purchaseTransportCost(), 0) + Math.max(this.purchaseOtherDirectCost(), 0),
  );

  protected readonly purchaseAdditionalCostPerUnit = computed(() =>
    this.purchaseDraftUnits() > 0 ? this.purchaseAdditionalCostTotal() / this.purchaseDraftUnits() : 0,
  );

  protected readonly purchaseDraftRealTotal = computed(() =>
    this.purchaseDraftTotal() + this.purchaseAdditionalCostTotal(),
  );

  protected readonly operationalCostTotal = computed(() =>
    this.operationalCostRows().reduce((total, row) => total + row.amount, 0),
  );

  protected readonly operationalCostByType = computed(() => {
    const typeTotals = new Map<string, number>();

    for (const row of this.operationalCostRows()) {
      typeTotals.set(row.type, (typeTotals.get(row.type) || 0) + row.amount);
    }

    return [...typeTotals.entries()]
      .map(([type, total]) => ({ type, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total);
  });

  protected readonly estimatedNetPotentialProfit = computed(() =>
    this.monthlyOperatingCost() - this.operationalCostTotal(),
  );

  protected readonly kardexPageStart = computed(() =>
    this.outOfStockProducts().length === 0 ? 0 : (Math.min(this.kardexPage(), this.kardexPageCount()) - 1) * this.kardexPageSize + 1,
  );

  protected readonly kardexPageEnd = computed(() =>
    Math.min(this.kardexPageStart() + this.paginatedOutOfStockProducts().length - 1, this.outOfStockProducts().length),
  );

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO OBTIENE EL PORCENTAJE DE GANANCIA PROMEDIO
  // USANDO EL MARGEN CALCULADO DE TODOS LOS PRODUCTOS DEL INVENTARIO.
  protected readonly averageMargin = computed(() => {
    const products = this.products();
    if (products.length === 0) {
      return 0;
    }

    const totalMargin = products.reduce((total, product) => total + product.margin, 0);
    return totalMargin / products.length;
  });

  protected readonly categoryPerformance = computed(() =>
    Array.from(
      this.products().reduce((map, product) => {
        const current = map.get(product.category) || { category: product.category, totalMargin: 0, count: 0 };
        current.totalMargin += product.margin;
        current.count += 1;
        map.set(product.category, current);
        return map;
      }, new Map<string, { category: string; totalMargin: number; count: number }>() ).values(),
    )
      .map((item) => ({
        category: item.category,
        averageMargin: item.count === 0 ? 0 : item.totalMargin / item.count,
        count: item.count,
      }))
      .sort((a, b) => b.averageMargin - a.averageMargin),
  );

  protected readonly categoryTrendSeries = computed(() =>
    [...this.categoryPerformance()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .sort((a, b) => a.category.localeCompare(b.category)),
  );

  protected readonly maxCategoryMargin = computed(() => {
    const margins = this.categoryTrendSeries()
      .map((item) => item.averageMargin)
      .sort((a, b) => b - a);

    if (margins.length === 0) {
      return 0.05;
    }

    if (margins.length > 1 && margins[0] > margins[1] * 1.6) {
      return Math.max(0.05, margins[1] * 1.15);
    }

    return Math.max(0.05, margins[0]);
  });

  protected readonly categoryTrendPoints = computed(() => {
    const items = this.categoryTrendSeries();
    if (items.length === 0) {
      return [] as Array<{ x: number; y: number }>;
    }

    const minX = 4;
    const maxX = 96;
    const minY = 12;
    const maxY = 84;
    const step = items.length === 1 ? 0 : (maxX - minX) / (items.length - 1);

    return items
      .map((item, index) => {
        const x = items.length === 1 ? 50 : minX + step * index;
        const normalizedValue = Math.min(item.averageMargin, this.maxCategoryMargin()) / this.maxCategoryMargin();
        const y = maxY - normalizedValue * (maxY - minY);
        return { x, y };
      });
  });

  protected readonly categoryTrendPath = computed(() => {
    const points = this.categoryTrendPoints();
    if (points.length === 0) {
      return '';
    }

    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  });

  protected readonly categoryTrendPolyline = computed(() =>
    this.categoryTrendPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  protected readonly categoryTrendAreaPolygon = computed(() => {
    const points = this.categoryTrendPoints();
    if (points.length === 0) {
      return '';
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return [`${firstPoint.x},92`, ...points.map((point) => `${point.x},${point.y}`), `${lastPoint.x},92`].join(' ');
  });

  protected categoryTrendPointY(value: number): number {
    return 84 - (Math.min(value, this.maxCategoryMargin()) / this.maxCategoryMargin()) * 72;
  }

  protected readonly recentlyUpdatedCostProducts = computed(() =>
    [...this.products()]
      .filter((product) => Boolean(product.updatedAt || product.createdAt))
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime(),
      )
      .slice(0, 3),
  );

  protected readonly lowestMarginProduct = computed(() => {
    const products = this.products();
    if (products.length === 0) {
      return null;
    }

    return [...products].sort((a, b) => a.margin - b.margin)[0];
  });

  protected readonly topMarginProducts = computed(() =>
    [...this.products()].sort((a, b) => b.margin - a.margin).slice(0, 3),
  );

  protected readonly totalSales = computed(() =>
    this.movements()
      .filter((movement) => movement.type === 'Venta')
      .reduce((total, movement) => total + movement.total, 0),
  );

  protected readonly totalPurchases = computed(() =>
    this.movements()
      .filter((movement) => movement.type === 'Compra')
      .reduce((total, movement) => total + movement.total, 0),
  );

  protected readonly potentialRevenue = computed(() =>
    this.products().reduce((total, product) => total + product.stock * product.salePrice, 0),
  );

  protected readonly projectedProfit = computed(() => this.potentialRevenue() - this.inventoryValue());

  protected readonly inventoryCoverage = computed(() => {
    const minimumUnits = this.products().reduce((total, product) => total + product.minStock, 0);
    return Math.min(this.totalUnits() / (minimumUnits * 2), 1);
  });

  protected readonly topStockProducts = computed(() =>
    [...this.products()].sort((a, b) => b.stock * b.salePrice - a.stock * a.salePrice).slice(0, 4),
  );

  protected readonly maxDashboardAmount = computed(() =>
    Math.max(...this.dashboardMonths.map((item) => Math.max(item.sales, item.purchases))),
  );

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO OBTIENE EL VALOR MAXIMO DEL GRAFICO REAL DE VENTAS.
  protected readonly maxSalesTrendValue = computed(() =>
    Math.max(
      ...this.salesTrendData().flatMap((item) => [item.efectivo, item.credito, item.transferencia]),
      1,
    ),
  );

  protected readonly salesTrendYAxisTicks = computed(() => {
    const maxValue = this.maxSalesTrendValue();
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => Math.round(maxValue * ratio));
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO OBTIENE EL VALOR MAXIMO DEL GRAFICO TEMPORAL DE COMPRAS.
  protected readonly maxPurchasesTrendValue = computed(() =>
    Math.max(...this.purchasesTrendData().map((item) => item.value), 1),
  );

  protected readonly cashSalesTrendPath = computed(() => this.buildSalesTrendPath('efectivo'));
  protected readonly creditSalesTrendPath = computed(() => this.buildSalesTrendPath('credito'));
  protected readonly transferSalesTrendPath = computed(() => this.buildSalesTrendPath('transferencia'));

  protected readonly maxSalesTrendMarker = computed(() => {
    const items = this.salesTrendData();
    const seriesKeys: SalesTrendSeriesKey[] = ['efectivo', 'credito', 'transferencia'];
    let best: { index: number; key: SalesTrendSeriesKey; value: number } | null = null;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      for (const key of seriesKeys) {
        const value = item[key];
        if (!best || value > best.value) {
          best = { index, key, value };
        }
      }
    }

    if (!best || best.value <= 0) {
      return null;
    }

    const x = this.trendPointPosition(best.index, items.length);
    const y = this.trendPointHeight(best.value, this.maxSalesTrendValue());

    return {
      ...best,
      x,
      y,
      labelX: Math.min(Math.max(x - 12, 4), 72),
      labelY: Math.max(y - 18, 6),
    };
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE CALCULO CONSTRUYE LA LINEA SVG DEL GRAFICO TEMPORAL DE COMPRAS.
  protected readonly purchasesTrendPolyline = computed(() =>
    this.buildTrendPolyline(this.purchasesTrendData(), this.maxPurchasesTrendValue()),
  );

  protected readonly attendanceAreas = computed(
    () => new Set(this.attendanceUsers().map((user) => user.area)).size,
  );

  protected readonly attendanceWeekOptions = computed(() => {
    const weeks = new Set<number>();

    for (const user of this.attendanceUsers()) {
      for (const record of user.history) {
        if (record.weekNumber > 0) {
          weeks.add(record.weekNumber);
        }
      }
    }

    return [...weeks].sort((a, b) => b - a);
  });

  protected readonly attendanceUserGroups = computed<AttendanceUserGroup[]>(() =>
    this.attendanceUsers().map((user) => {
      const weeksByKey = new Map<string, AttendanceWeekGroup>();

      for (const record of user.history) {
        const weekNumber = record.weekNumber || this.getAttendanceWeekInfo(record.date).week;
        const weekKey = `${user.id}-${weekNumber}`;
        const existingWeek = weeksByKey.get(weekKey);

        if (existingWeek) {
          existingWeek.days.push(record);
          existingWeek.totalHours = Number((existingWeek.totalHours + record.workedHours).toFixed(2));
          continue;
        }

        weeksByKey.set(weekKey, {
          key: weekKey,
          weekNumber,
          label: `Semana ${weekNumber}`,
          totalHours: Number(record.workedHours.toFixed(2)),
          days: [record],
        });
      }

      const weeks = [...weeksByKey.values()]
        .map((week) => ({
          ...week,
          days: [...week.days].sort((a, b) => b.date.getTime() - a.date.getTime()),
        }))
        .sort((a, b) => {
          return b.weekNumber - a.weekNumber;
        });

      return {
        user,
        totalHours: Number(weeks.reduce((total, week) => total + week.totalHours, 0).toFixed(2)),
        weeks,
      };
    }),
  );

  protected readonly payrollUserGroups = computed<PayrollUserLine[]>(() =>
    this.attendanceUserGroups().map((group) => {
      const weeks = group.weeks.map((week) => {
        const days = week.days.map((day) => this.calculatePayrollDayLine(day));
        const subtotalPay = Number(days.reduce((total, day) => total + day.totalPay, 0).toFixed(2));
        const bonus = this.payrollBonusForWeek(group.user.id, week.weekNumber);

        return {
          key: week.key,
          weekNumber: week.weekNumber,
          label: week.label,
          days,
          subtotalPay,
          bonus,
          grandTotal: Number((subtotalPay + bonus).toFixed(2)),
          totalHours: Number(days.reduce((total, day) => total + day.totalHours, 0).toFixed(2)),
        };
      });

      const accumulatedSubtotal = Number(weeks.reduce((total, week) => total + week.subtotalPay, 0).toFixed(2));
      const accumulatedBonus = Number(weeks.reduce((total, week) => total + week.bonus, 0).toFixed(2));

      return {
        user: group.user,
        weeks,
        accumulatedSubtotal,
        accumulatedBonus,
        accumulatedTotal: Number((accumulatedSubtotal + accumulatedBonus).toFixed(2)),
      };
    }),
  );

  protected readonly attendanceRecords = computed(() => this.attendanceUsers().length);

  protected readonly totalWorkedHours = computed(() =>
    this.attendanceUsers().reduce((total, user) => total + this.currentWeekHours(user.id), 0),
  );

  protected readonly averageWorkedHours = computed(() =>
    this.attendanceRecords() === 0 ? 0 : this.totalWorkedHours() / this.attendanceRecords(),
  );

  protected readonly lateAttendanceCount = computed(
    () => this.attendanceUsers().filter((user) => this.attendanceStatus(user) === 'Tarde').length,
  );

  protected readonly punctualAttendanceCount = computed(
    () => this.attendanceUsers().filter((user) => this.attendanceStatus(user) === 'Puntual').length,
  );

  protected readonly attendancePayrollTotal = computed(() =>
    this.attendanceUsers().reduce(
      (total, user) => total + this.currentWeekHours(user.id) * user.hourlyRate,
      0,
    ),
  );

  protected readonly maxAttendanceWorkedHours = computed(() =>
    Math.max(1, ...this.attendanceUsers().map((user) => this.currentWeekHours(user.id))),
  );

  protected readonly selectedPayrollWeeks = computed(() => {
    const selectedWeek = this.selectedAttendanceWeek();

    return this.payrollUserGroups()
      .flatMap((group) =>
        group.weeks
          .filter((week) => selectedWeek === null || week.weekNumber === selectedWeek)
          .map((week) => ({
            user: group.user,
            week,
          })),
      )
      .sort((a, b) => b.week.weekNumber - a.week.weekNumber || a.user.name.localeCompare(b.user.name));
  });

  protected readonly weeklyPayrollHours = computed(() =>
    Number(this.selectedPayrollWeeks().reduce((total, line) => total + line.week.totalHours, 0).toFixed(2)),
  );

  protected readonly weeklyBasePayroll = computed(() =>
    Number(this.selectedPayrollWeeks().reduce((total, line) => total + line.week.subtotalPay, 0).toFixed(2)),
  );

  protected readonly weeklyBonusTotal = computed(() =>
    Number(this.selectedPayrollWeeks().reduce((total, line) => total + line.week.bonus, 0).toFixed(2)),
  );

  protected readonly weeklyPayrollTotal = computed(() =>
    Number(this.selectedPayrollWeeks().reduce((total, line) => total + line.week.grandTotal, 0).toFixed(2)),
  );

  protected readonly biweeklyPayrollTotal = computed(() => Number((this.weeklyPayrollTotal() * 2).toFixed(2)));

  protected readonly monthlyPayrollTotal = computed(() => Number((this.weeklyPayrollTotal() * 4).toFixed(2)));

  protected readonly payrollAverageHourlyCost = computed(() =>
    this.weeklyPayrollHours() === 0 ? 0 : this.weeklyPayrollTotal() / this.weeklyPayrollHours(),
  );

  protected readonly historicalPayrollTotal = computed(() =>
    Number(this.payrollUserGroups().reduce((total, group) => total + group.accumulatedTotal, 0).toFixed(2)),
  );

  protected readonly selectedPayrollTypeTotals = computed(() =>
    this.selectedPayrollWeeks().reduce(
      (totals, line) => {
        for (const day of line.week.days) {
          totals.normalHours += day.normalHours;
          totals.extra1Hours += day.extra1Hours;
          totals.extra2Hours += day.extra2Hours;
          totals.extra3Hours += day.extra3Hours;
          totals.normalPay += day.normalPay;
          totals.extra1Pay += day.extra1Pay;
          totals.extra2Pay += day.extra2Pay;
          totals.extra3Pay += day.extra3Pay;
        }

        return {
          normalHours: Number(totals.normalHours.toFixed(2)),
          extra1Hours: Number(totals.extra1Hours.toFixed(2)),
          extra2Hours: Number(totals.extra2Hours.toFixed(2)),
          extra3Hours: Number(totals.extra3Hours.toFixed(2)),
          normalPay: Number(totals.normalPay.toFixed(2)),
          extra1Pay: Number(totals.extra1Pay.toFixed(2)),
          extra2Pay: Number(totals.extra2Pay.toFixed(2)),
          extra3Pay: Number(totals.extra3Pay.toFixed(2)),
        };
      },
      {
        normalHours: 0,
        extra1Hours: 0,
        extra2Hours: 0,
        extra3Hours: 0,
        normalPay: 0,
        extra1Pay: 0,
        extra2Pay: 0,
        extra3Pay: 0,
      },
    ),
  );

  protected readonly payrollTopEarners = computed<PayrollTopEarnerLine[]>(() =>
    this.selectedPayrollWeeks()
      .map((line) => ({
        user: line.user,
        hours: line.week.totalHours,
        pay: line.week.grandTotal,
      }))
      .sort((a, b) => b.pay - a.pay),
  );

  protected readonly maxWeeklyPay = computed(() =>
    Math.max(1, ...this.payrollTopEarners().map((line) => line.pay)),
  );

  protected readonly payrollTrendChartSeries = computed(() => {
    const period = this.payrollTrendPeriod();
    const allDays = this.payrollUserGroups().flatMap((group) =>
      group.weeks.flatMap((week) =>
        week.days.map((day) => ({
          userId: group.user.id,
          userName: group.user.name,
          date: day.date,
          pay: day.totalPay,
        })),
      ),
    );

    const groups = new Map<string, { label: string; sortValue: number; totals: Map<number, number> }>();
    const totalsByUser = new Map<number, { userName: string; total: number }>();

    for (const day of allDays) {
      const grouping = this.payrollTrendGrouping(day.date, period);
      const currentGroup = groups.get(grouping.key) || {
        label: grouping.label,
        sortValue: grouping.sortValue,
        totals: new Map<number, number>(),
      };

      currentGroup.totals.set(day.userId, Number(((currentGroup.totals.get(day.userId) || 0) + day.pay).toFixed(2)));
      groups.set(grouping.key, currentGroup);

      const currentUser = totalsByUser.get(day.userId) || { userName: day.userName, total: 0 };
      currentUser.total = Number((currentUser.total + day.pay).toFixed(2));
      totalsByUser.set(day.userId, currentUser);
    }

    const orderedGroups = [...groups.values()].sort((a, b) => a.sortValue - b.sortValue);
    const topUsers = [...totalsByUser.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 3);

    const datasets: PayrollTrendDataset[] = topUsers.map(([userId, info]) => ({
      label: info.userName,
      data: orderedGroups.map((group) => Number((group.totals.get(userId) || 0).toFixed(2))),
    }));

    return {
      labels: orderedGroups.map((group) => group.label),
      datasets,
    };
  });

  protected readonly generatedPayrollShiftTotals = computed(() =>
    this.payrollShifts.map((shift) => ({
      ...shift,
      hours: this.attendanceUsers().reduce(
        (total, user) =>
          total +
          this.payrollDays.reduce(
            (dayTotal, day) => dayTotal + (this.payrollHours()[user.id]?.[day.id]?.[shift.id] || 0),
            0,
          ),
        0,
      ),
    })),
  );

  protected readonly generatedWeeklyHours = computed(() =>
    this.generatedPayrollShiftTotals().reduce((total, shift) => total + shift.hours, 0),
  );

  protected readonly generatedWeeklyPay = computed(() =>
    this.generatedPayrollShiftTotals().reduce((total, shift) => total + shift.hours * shift.rate, 0),
  );

  protected readonly generatedPayrollTopEarners = computed(() =>
    this.attendanceUsers()
      .map((user) => ({
        user,
        hours: this.userWeeklyGeneratedHours(user.id),
        pay: this.userWeeklyGeneratedPay(user.id),
      }))
      .sort((a, b) => b.pay - a.pay),
  );

  private readonly desktopApi = window.electronAPI;
  private saleSuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private inventorySuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected readonly maxGeneratedWeeklyPay = computed(() =>
    Math.max(1, ...this.generatedPayrollTopEarners().map((line) => line.pay)),
  );

  constructor(private readonly http: HttpClient) {
    effect(() => {
      this.salesTrendData();
      this.activeThemeId();
      this.purchaseHistoryRows();
      this.costDistributionSeries();
      this.costMonthlyTrend();
      this.costCategorySeries();
      this.dashboardPayrollChartRows();
      this.dashboardAttendanceChartRows();
      this.dashboardInventoryChartRows();
      this.dashboardCostChartRows();
      this.auditUserTrendSeries();
      this.monthlyFixedCostEstimate();
      this.monthlyVariableCost();
      this.monthlyOperatingCost();
      this.monthlyOperatingMargin();
      this.updateSalesTrendChart();
      this.updateInvoicesSalesTrendChart();
      this.updatePayrollTrendChart();
      this.updatePurchasesTrendChart();
      this.updateCostsDistributionChart();
      this.updateCostsEvolutionChart();
      this.updateCostsCategoryChart();
      this.updateAuditUserTrendChart();
      this.updateDashboardModuleCharts();
    });

    effect(() => {
      const users = this.attendanceUsers();
      const bonusesByWeek = this.payrollBonuses();
      const hours = this.payrollHours();

      if (users.length === 0) {
        return;
      }

      try {
        for (const [weekText, bonuses] of Object.entries(bonusesByWeek)) {
          const week = Number(weekText);

          if (!Number.isFinite(week) || week <= 0) {
            continue;
          }

          const sanitizedBonuses: Record<number, number> = {};

          for (const user of users) {
            sanitizedBonuses[user.id] = Number((bonuses[user.id] ?? 0).toFixed(2));
          }

          localStorage.setItem(this.payrollBonusesStorageKey(week), JSON.stringify(sanitizedBonuses));
        }

        const selectedWeek = this.selectedAttendanceWeek();

        if (selectedWeek !== null) {
          const sanitizedHours: PayrollHoursMatrix = {};

          for (const user of users) {
            sanitizedHours[user.id] = this.buildPayrollWeekRow(hours[user.id]);
          }

          localStorage.setItem(this.payrollHoursStorageKey(selectedWeek), JSON.stringify(sanitizedHours));
        }
      } catch {
        return;
      }
    });

    try {
      const savedTheme = localStorage.getItem('yahweh-rohi-theme') as ThemeId | null;
      const defaultThemeMigrationApplied = localStorage.getItem(defaultThemeMigrationStorageKey);
      const savedFavoriteProductIds = localStorage.getItem('yahweh-rohi-favorite-products');
      if (!defaultThemeMigrationApplied && (!savedTheme || savedTheme === 'forest-light')) {
        this.activeThemeId.set('black-green');
        localStorage.setItem('yahweh-rohi-theme', 'black-green');
        localStorage.setItem(defaultThemeMigrationStorageKey, '1');
      } else if (savedTheme && this.themes.some((theme) => theme.id === savedTheme)) {
        this.activeThemeId.set(savedTheme);
      }

      if (savedFavoriteProductIds) {
        this.favoriteProductIds.set(JSON.parse(savedFavoriteProductIds) as number[]);
      }

      const savedUser = localStorage.getItem(sessionStorageKey);

      this.loadLoginUsers();
      this.loadCustomers();

      if (savedUser) {
        this.currentUser.set(JSON.parse(savedUser) as LoginResponse['user']);
        this.isAuthenticated.set(true);
        this.loadProductsFromDatabase();
        this.activatePage(this.restoreSavedActivePage(), false);
      }
    } catch {
      this.activeThemeId.set('black-green');
    }
  }

  ngOnDestroy(): void {
    this.salesTrendChart?.destroy();
    this.invoicesSalesTrendChart?.destroy();
    this.payrollTrendChart?.destroy();
    this.purchasesTrendChart?.destroy();
    this.costsDistributionChart?.destroy();
    this.costsEvolutionChart?.destroy();
    this.costsCategoryChart?.destroy();
    this.auditUserTrendChart?.destroy();
    this.dashboardPayrollChart?.destroy();
    this.dashboardAttendanceChart?.destroy();
    this.dashboardInventoryChart?.destroy();
    this.dashboardCostsChart?.destroy();
    this.dashboardHistoryChart?.destroy();

    if (this.saleSuccessTimeoutId !== null) {
      clearTimeout(this.saleSuccessTimeoutId);
    }

    if (this.inventorySuccessTimeoutId !== null) {
      clearTimeout(this.inventorySuccessTimeoutId);
    }
  }

  protected setMode(mode: Mode): void {
    this.activeMode.set(mode);
    this.customerModalOpen.set(false);
    this.supplierModalOpen.set(false);
  }

  protected login(): void {
    const usuario = this.loginUser().trim();
    const pass = this.loginPassword();

    if (!usuario || !pass) {
      this.loginError.set('Ingresa usuario y contrasena.');
      return;
    }

    this.loginLoading.set(true);
    this.loginError.set('');

    void this.authenticateUser(usuario, pass);
  }

  protected updateLoginUser(event: Event): void {
    this.loginUser.set((event.target as HTMLInputElement).value);
  }

  protected updateLoginPassword(event: Event): void {
    this.loginPassword.set((event.target as HTMLInputElement).value);
  }

  protected updateCreditSearchTerm(event: Event): void {
    this.creditSearchTerm.set((event.target as HTMLInputElement).value);
  }

  protected selectCreditCustomer(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCreditCustomerId.set(value ? Number(value) : null);
  }

  protected openCreditPaymentModal(customer: CreditCustomerGroup): void {
    this.creditPaymentCustomer.set(customer);
    this.creditPaymentAmount.set('');
    this.creditPaymentDescription.set('Abono a credito');
    this.creditPaymentError.set('');
    this.creditPaymentSuccess.set('');
    this.creditPaymentModalOpen.set(true);
  }

  protected closeCreditPaymentModal(): void {
    if (this.creditPaymentSaving()) {
      return;
    }

    this.creditPaymentModalOpen.set(false);
    this.creditPaymentCustomer.set(null);
    this.creditPaymentError.set('');
    this.creditPaymentSuccess.set('');
  }

  protected updateCreditPaymentAmount(event: Event): void {
    this.creditPaymentAmount.set((event.target as HTMLInputElement).value);
  }

  protected updateCreditPaymentDescription(event: Event): void {
    this.creditPaymentDescription.set((event.target as HTMLInputElement).value);
  }

  protected async saveCreditPayment(): Promise<void> {
    const customer = this.creditPaymentCustomer();
    const currentUser = this.currentUser();
    const amount = Number(this.creditPaymentAmount());

    if (!customer) {
      this.creditPaymentError.set('Selecciona un cliente.');
      return;
    }

    if (!currentUser) {
      this.creditPaymentError.set('Usuario requerido para registrar abono.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      this.creditPaymentError.set('Ingresa un monto de abono valido.');
      return;
    }

    if (amount - customer.total > 0.01) {
      this.creditPaymentError.set('El abono no puede exceder el saldo pendiente del cliente.');
      return;
    }

    this.creditPaymentSaving.set(true);
    this.creditPaymentError.set('');
    this.creditPaymentSuccess.set('');

    try {
      const payload = {
        customerId: customer.customerId,
        amount,
        userId: currentUser.id,
        description: this.creditPaymentDescription().trim() || 'Abono a credito',
      };
      const response = this.desktopApi
        ? await this.desktopApi.createCreditPayment(payload)
        : await firstValueFrom(this.http.post<CreditPaymentCreateResponse>('/api/credits/payments', payload));

      this.creditPaymentSuccess.set(
        `Abono aplicado a ${response.payment.linesTouched} linea(s) en ${response.payment.invoicesTouched} factura(s).`,
      );
      await this.loadCredits();
      await this.loadCustomers();
      await this.loadDashboardSalesSummary();
      await this.loadDailyCutPreview(new Date().toISOString().slice(0, 10), currentUser.id).catch(() => null);
    } catch (error) {
      this.creditPaymentError.set(this.extractErrorMessage(error, 'No se pudo registrar el abono.'));
    } finally {
      this.creditPaymentSaving.set(false);
    }
  }

  protected updateCostYear(event: Event): void {
    this.selectedCostYear.set(Number((event.target as HTMLSelectElement).value) || new Date().getFullYear());
    void this.loadOperationalCosts();
  }

  protected updateCostMonth(event: Event): void {
    this.selectedCostMonth.set(Number((event.target as HTMLSelectElement).value) || new Date().getMonth() + 1);
    void this.loadOperationalCosts();
  }

  protected updateCostCategory(event: Event): void {
    this.selectedCostCategory.set((event.target as HTMLSelectElement).value || 'Todas');
    this.costsPage.set(1);
  }

  protected updateSalesTrendPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SalesTrendPeriod;
    this.setSalesTrendPeriod(value);
  }

  protected setSalesTrendPeriod(value: SalesTrendPeriod): void {
    this.salesTrendPeriod.set(value);
    void this.loadDashboardSalesTrend();
  }

  protected setPayrollTrendPeriod(value: PayrollTrendPeriod): void {
    this.payrollTrendPeriod.set(value);
    this.updatePayrollTrendChart();
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO EXPANDE O COLAPSA LAS FACTURAS DE UN CLIENTE EN LA TABLA MASTER.
  // NO CONSULTA LA BASE DE DATOS; SOLO ALTERNA LA VISTA USANDO LOS DATOS YA CARGADOS POR loadCredits().
  protected toggleCreditCustomer(customerId: number): void {
    this.expandedCreditCustomerIds.update((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(customerId)) {
        nextIds.delete(customerId);
      } else {
        nextIds.add(customerId);
      }

      return nextIds;
    });
  }

  protected isCreditCustomerExpanded(customerId: number): boolean {
    return this.expandedCreditCustomerIds().has(customerId);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO EXPANDE O COLAPSA LOS DETALLES DE CREDITO DE UNA FACTURA EN LA TABLA MASTER.
  // NO CONSULTA LA BASE DE DATOS; SOLO ALTERNA LA VISTA USANDO LOS DATOS YA CARGADOS POR loadCredits().
  protected toggleCreditInvoice(invoiceId: number): void {
    this.expandedCreditInvoiceIds.update((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(invoiceId)) {
        nextIds.delete(invoiceId);
      } else {
        nextIds.add(invoiceId);
      }

      return nextIds;
    });
  }

  protected isCreditInvoiceExpanded(invoiceId: number): boolean {
    return this.expandedCreditInvoiceIds().has(invoiceId);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO EXPORTA UN REPORTE PDF POR CLIENTE DESDE LA PAGINA CREDITOS.
  // NO CONSULTA INTERNET NI USA API EXTERNA; GENERA HTML LOCAL Y ABRE window.print()
  // PARA QUE EL USUARIO GUARDE EL REPORTE COMO PDF DESDE EL NAVEGADOR.
  // LOS DATOS VIENEN DE loadCredits(), QUE LLAMA listCredits() EN server/data-access.js.
  protected exportCreditCustomerPdf(group: CreditCustomerGroup): void {
    const rows = group.invoices.flatMap((invoice) =>
      invoice.lines.map((credit) => [
        `#${invoice.invoiceId}`,
        credit.productName,
        this.formatNumber(credit.quantity),
        this.formatCurrency(credit.salePrice),
        this.formatCurrency(credit.total),
        credit.saleStatusName,
        credit.createdAt || '-',
      ]),
    );

    this.openPrintableCreditReport({
      title: `Creditos de ${group.customerName}`,
      subtitle: `Cliente #${group.customerId} · ${group.customerPhone || 'Sin telefono'}`,
      summary: [
        ['Facturas', this.formatNumber(group.invoices.length)],
        ['Articulos', this.formatNumber(group.articleCount)],
        ['Total credito', this.formatCurrency(group.total)],
        ['Utilidad', this.formatCurrency(group.utility)],
      ],
      headers: ['Factura', 'Producto', 'Cantidad', 'Precio', 'Total', 'Estado', 'Fecha'],
      rows,
    });
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO EXPORTA UN REPORTE PDF POR FACTURA DESDE LA PAGINA CREDITOS.
  // NO CONSULTA INTERNET NI USA API EXTERNA; GENERA HTML LOCAL Y ABRE window.print()
  // PARA QUE EL USUARIO GUARDE EL REPORTE COMO PDF DESDE EL NAVEGADOR.
  // LOS DATOS VIENEN DE loadCredits(), QUE LLAMA listCredits() EN server/data-access.js.
  protected exportCreditInvoicePdf(invoice: CreditInvoiceGroup): void {
    const rows = invoice.lines.map((credit) => [
      `#${credit.id}`,
      credit.productName,
      this.formatNumber(credit.quantity),
      this.formatCurrency(credit.salePrice),
      this.formatCurrency(credit.total),
      credit.user,
      credit.createdAt || '-',
    ]);

    this.openPrintableCreditReport({
      title: `Factura #${invoice.invoiceId}`,
      subtitle: `${invoice.customerName} · ${invoice.customerPhone || 'Sin telefono'}`,
      summary: [
        ['Articulos', this.formatNumber(invoice.lines.length)],
        ['Total credito', this.formatCurrency(invoice.total)],
        ['Estado', invoice.saleStatusName],
      ],
      headers: ['ID', 'Producto', 'Cantidad', 'Precio', 'Total', 'Usuario', 'Fecha'],
      rows,
    });
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO EXPORTA UNA FACTURA A PDF LOCALMENTE.
  // CARGA EL DETALLE DESDE getInvoiceDetails() Y ABRE window.print().
  protected async exportInvoicePdf(invoice: InvoiceRow): Promise<void> {
    const printWindow = this.openPrintableReportWindow();

    if (!printWindow) {
      this.invoiceError.set('No se pudo abrir la ventana de impresion. Revisa el bloqueo de ventanas emergentes.');
      return;
    }

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getInvoiceDetails(invoice.invoiceId)
        : await firstValueFrom(this.http.get<InvoiceDetailsResponse>(`/api/invoices/${invoice.invoiceId}/details`));

      const rows = response.lines.map((line) => [
        line.sku || String(line.productId),
        line.productName,
        this.formatNumber(line.quantity),
        this.formatCurrency(line.salePrice),
        this.formatCurrency(line.total),
        line.statusName,
      ]);

      this.writePrintableReport(printWindow, {
        title: `Factura #${invoice.invoiceId}`,
        subtitle: `${invoice.customerName} · ${invoice.paymentTypeName} · ${invoice.statusName}`,
        summary: [
          ['Cliente', invoice.customerName],
          ['Total', this.formatCurrency(invoice.total)],
          ['Articulos', this.formatNumber(invoice.itemCount)],
          ['Fecha', invoice.createdAt || '-'],
        ],
        headers: ['Codigo', 'Producto', 'Cantidad', 'Precio', 'Total', 'Estado'],
        rows,
      });
    } catch (error) {
      printWindow.close();
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudo exportar la factura.'));
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ANULA O ACTIVA UNA FACTURA Y RECARGA INVENTARIO, TARJETAS, GRAFICO Y TABLA.
  // TERMINA LLAMANDO annulInvoice() O activateInvoice() EN server/data-access.js.
  protected async toggleInvoiceStatus(invoice: InvoiceRow): Promise<void> {
    if (this.isInvoiceAnnulled(invoice)) {
      await this.activateInvoice(invoice);
    } else {
      await this.annulInvoice(invoice);
    }
  }

  private async annulInvoice(invoice: InvoiceRow): Promise<void> {
    const confirmed = window.confirm(`Anular factura #${invoice.invoiceId} y devolver el inventario al stock?`);

    if (!confirmed) {
      return;
    }

    try {
      if (this.desktopApi) {
        await this.desktopApi.annulInvoice(invoice.invoiceId);
      } else {
        await firstValueFrom(this.http.post<AnnulInvoiceResponse>(`/api/invoices/${invoice.invoiceId}/annul`, {}));
      }

      await this.loadInvoicesPageData();
      await this.fetchProducts();
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      this.showInventorySuccess(`Factura #${invoice.invoiceId} anulada correctamente.`);
    } catch (error) {
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudo anular la factura.'));
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ACTIVA UNA FACTURA ANULADA Y RECARGA INVENTARIO, TARJETAS, GRAFICO Y TABLA.
  // SI USA API HTTP, LLAMA POST /api/invoices/:invoiceId/activate UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.activateInvoice() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO activateInvoice() EN server/data-access.js.
  private async activateInvoice(invoice: InvoiceRow): Promise<void> {
    const confirmed = window.confirm(`Activar factura #${invoice.invoiceId} y descontar nuevamente el inventario?`);

    if (!confirmed) {
      return;
    }

    try {
      if (this.desktopApi) {
        await this.desktopApi.activateInvoice(invoice.invoiceId);
      } else {
        await firstValueFrom(this.http.post<ActivateInvoiceResponse>(`/api/invoices/${invoice.invoiceId}/activate`, {}));
      }

      await this.loadInvoicesPageData();
      await this.fetchProducts();
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      this.showInventorySuccess(`Factura #${invoice.invoiceId} activada correctamente.`);
    } catch (error) {
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudo activar la factura.'));
    }
  }

  protected isInvoiceAnnulled(invoice: InvoiceRow): boolean {
    return this.normalizeText(invoice.statusName).startsWith('anulad');
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE VENTAS DEL DIA EN FACTURACION.
  // RECARGA loadTodayInvoices(), QUE CONSULTA /api/invoices/today O electronAPI.getTodayInvoices().
  // EL BACKEND TERMINA EJECUTANDO listTodayInvoices() EN server/data-access.js.
  protected openDailySalesModal(): void {
    this.dailySalesModalOpen.set(true);
    void this.loadTodayInvoices();
  }

  protected closeDailySalesModal(): void {
    this.dailySalesModalOpen.set(false);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE ALERTAS DE VENCIMIENTO EN FACTURACION.
  // RECARGA dbo.PRODUCTO_PROXIMO_VENCER POR MEDIO DE loadExpiringProducts().
  protected openExpiringProductsModal(): void {
    this.expiringProductsModalOpen.set(true);
    void this.loadExpiringProducts();
  }

  protected closeExpiringProductsModal(): void {
    this.expiringProductsModalOpen.set(false);
  }

  protected openLowStockAlertModal(): void {
    this.lowStockAlertModalOpen.set(true);
  }

  protected closeLowStockAlertModal(): void {
    this.lowStockAlertModalOpen.set(false);
  }

  protected openSalesDropAlertModal(): void {
    this.salesDropAlertModalOpen.set(true);
    void this.loadSalesDropAlert();
  }

  protected closeSalesDropAlertModal(): void {
    this.salesDropAlertModalOpen.set(false);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE CORTE EN FACTURACION.
  // LLAMA loadDailyCuts(), QUE CONSULTA dbo.CORTE_DIARIO Y dbo.PAGOS_CREDITO.
  protected openCutModal(): void {
    this.cutModalOpen.set(true);
    void this.loadDailyCuts();
  }

  protected openCutClosingFlow(): void {
    this.cutModalOpen.set(false);
    this.openLogoutCutModal();
  }

  protected closeCutModal(): void {
    this.cutModalOpen.set(false);
  }

  protected updateCutFilterFromDate(event: Event): void {
    this.cutFilterFromDate.set((event.target as HTMLInputElement).value);
    void this.loadDailyCuts();
  }

  protected updateCutFilterToDate(event: Event): void {
    this.cutFilterToDate.set((event.target as HTMLInputElement).value);
    void this.loadDailyCuts();
  }

  protected selectCut(cut: DailyCut): void {
    this.selectedCutId.set(cut.id);
    this.cutFilterToDate.set(String(cut.date).slice(0, 10));
    void this.loadCreditPaymentsForCut(cut.date, cut.userId ?? undefined);
  }

  protected cutStatusClass(cut: DailyCut): string {
    const status = this.normalizeText(cut.statusName);

    if (status.includes('abierto')) {
      return 'open';
    }

    if (status.includes('anulado')) {
      return 'annulled';
    }

    return 'closed';
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE CORTE ANTES DE CERRAR SESION.
  // CALCULA EL RESUMEN DEL DIA SIN INSERTAR Y PERMITE INGRESAR EL CONTEO FISICO DEL CAJERO.
  protected openLogoutCutModal(): void {
    if (this.openingCutModalOpen()) {
      return;
    }

    this.logoutCutModalOpen.set(true);
    this.logoutPhysicalCashCount.set('');
    void this.loadLogoutCutPreview();
  }

  protected closeLogoutCutModal(): void {
    this.logoutCutModalOpen.set(false);
    this.logoutCutError.set('');
  }

  protected updateLogoutPhysicalCashCount(event: Event): void {
    this.logoutPhysicalCashCount.set((event.target as HTMLInputElement).value);
  }

  protected updateOpeningCashAmount(event: Event): void {
    this.openingCashAmount.set((event.target as HTMLInputElement).value);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GUARDA EL MONTO INICIAL DE CAJA DESPUES DEL LOGIN.
  // LLAMA /api/daily-cuts/opening O window.electronAPI.createOpeningCut().
  protected async saveOpeningCut(): Promise<void> {
    const initialCash = Number(this.openingCashAmount());
    const currentUser = this.currentUser();

    if (!Number.isFinite(initialCash) || initialCash < 0) {
      this.openingCutError.set('Ingresa una cantidad inicial valida.');
      return;
    }

    if (!currentUser) {
      this.openingCutError.set('No hay un usuario autenticado para abrir la caja.');
      return;
    }

    this.openingCutSaving.set(true);
    this.openingCutError.set('');

    try {
      const today = new Date().toISOString().slice(0, 10);

      if (this.desktopApi) {
        await this.desktopApi.createOpeningCut({ date: today, initialCash, userId: currentUser.id });
      } else {
        await firstValueFrom(this.http.post<DailyCutResponse>('/api/daily-cuts/opening', {
          date: today,
          initialCash,
          userId: currentUser.id,
        }));
      }

      this.openingCutModalOpen.set(false);
      this.openingCashAmount.set('');
      await this.loadDailyCutPreview(today, currentUser.id);
    } catch (error) {
      this.openingCutError.set(this.extractErrorMessage(error, 'No se pudo guardar el inicio de caja.'));
    } finally {
      this.openingCutSaving.set(false);
    }
  }

  protected async loadLogoutCutPreview(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      this.logoutCutPreview.set(null);
      this.logoutCutError.set('No hay un usuario autenticado para calcular el corte.');
      return;
    }

    this.logoutCutLoading.set(true);
    this.logoutCutError.set('');

    try {
      const today = new Date().toISOString().slice(0, 10);
      const cut = await this.loadDailyCutPreview(today, currentUser.id);
      this.logoutCutPreview.set(cut);
      this.logoutPhysicalCashCount.set(String(cut.cashTotal || ''));
    } catch (error) {
      this.logoutCutPreview.set(null);
      this.logoutCutError.set(this.extractErrorMessage(error, 'No se pudo calcular el corte del dia.'));
    } finally {
      this.logoutCutLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GUARDA EL CORTE EN dbo.CORTE_DIARIO CON EL CONTEO FISICO DEL CAJERO.
  // DESPUES DE GUARDAR, CIERRA LA SESION Y EN ELECTRON CIERRA LA APLICACION.
  protected async saveLogoutCutAndClose(): Promise<void> {
    const physicalCashCount = Number(this.logoutPhysicalCashCount());
    const currentUser = this.currentUser();

    if (!Number.isFinite(physicalCashCount) || physicalCashCount < 0) {
      this.logoutCutError.set('Ingresa un conteo fisico valido.');
      return;
    }

    if (!currentUser) {
      this.logoutCutError.set('No hay un usuario autenticado para cerrar el turno.');
      return;
    }

    this.logoutCutSaving.set(true);
    this.logoutCutError.set('');

    try {
      const today = new Date().toISOString().slice(0, 10);

      if (this.desktopApi) {
        await this.desktopApi.createDailyCut({ date: today, physicalCashCount, userId: currentUser.id });
      } else {
        await firstValueFrom(this.http.post<DailyCutResponse>('/api/daily-cuts', {
          date: today,
          physicalCashCount,
          userId: currentUser.id,
        }));
      }

      this.logout();

      if (this.desktopApi?.closeApp) {
        await this.desktopApi.closeApp();
      }
    } catch (error) {
      this.logoutCutError.set(this.extractErrorMessage(error, 'No se pudo guardar el corte.'));
    } finally {
      this.logoutCutSaving.set(false);
    }
  }

  protected async closeSessionWithoutCut(): Promise<void> {
    this.logoutCutSaving.set(true);
    this.logoutCutError.set('');

    try {
      this.closeLogoutCutModal();
      this.logout();

      if (this.desktopApi?.closeApp) {
        await this.desktopApi.closeApp();
      }
    } catch (error) {
      this.logoutCutError.set(this.extractErrorMessage(error, 'No se pudo cerrar la sesion.'));
    } finally {
      this.logoutCutSaving.set(false);
    }
  }

  protected exportPurchasePdf(purchase: PurchaseHistoryRow): void {
    this.openPrintableCreditReport({
      title: `Compra ${purchase.invoiceNumber || `#${purchase.id}`}`,
      subtitle: `Reporte local de historico de compra`,
      summary: [
        ['Proveedor', purchase.supplierName],
        ['Tipo de pago', purchase.purchaseType],
        ['Estado', purchase.statusName],
        ['Total', this.formatCurrency(purchase.total)],
      ],
      headers: ['ID', 'Factura', 'Proveedor', 'Producto', 'Cantidad', 'Costo', 'Total', 'Usuario', 'Fecha'],
      rows: [[
        String(purchase.id),
        purchase.invoiceNumber || '-',
        purchase.supplierName,
        purchase.productName,
        this.formatNumber(purchase.quantity),
        this.formatCurrency(purchase.unitCost),
        this.formatCurrency(purchase.total),
        purchase.userName,
        purchase.createdAt || '-',
      ]],
    });
  }

  protected exportPurchaseInvoicePdf(invoice: PurchaseInvoiceGroup): void {
    this.openPrintableCreditReport({
      title: `Factura de compra ${invoice.invoiceNumber}`,
      subtitle: `Historico local de compra por proveedor`,
      summary: [
        ['Proveedor', invoice.supplierName],
        ['Tipo de pago', invoice.purchaseType],
        ['Estado', invoice.statusName],
        ['Productos', this.formatNumber(invoice.lines.length)],
        ['Cantidad total', this.formatNumber(invoice.quantity)],
        ['Total', this.formatCurrency(invoice.total)],
      ],
      headers: ['ID', 'Producto', 'Cantidad', 'Costo', 'Total', 'Usuario', 'Fecha'],
      rows: invoice.lines.map((line) => [
        String(line.id),
        line.productName,
        this.formatNumber(line.quantity),
        this.formatCurrency(line.unitCost),
        this.formatCurrency(line.total),
        line.userName,
        line.createdAt || '-',
      ]),
    });
  }

  protected togglePurchaseSupplier(supplierId: number): void {
    const nextSupplierId = this.expandedPurchaseSupplierId() === supplierId ? null : supplierId;
    this.expandedPurchaseSupplierId.set(nextSupplierId);
    this.expandedPurchaseInvoiceKey.set(null);
  }

  protected togglePurchaseInvoice(invoiceKey: string): void {
    this.expandedPurchaseInvoiceKey.set(this.expandedPurchaseInvoiceKey() === invoiceKey ? null : invoiceKey);
  }

  protected openPurchaseMainModal(): void {
    this.purchaseMainModalOpen.set(true);
    void this.loadSuppliers();
    void this.loadPurchases();
    void this.fetchProducts();
    void this.loadExpiringProducts();
  }

  protected closePurchaseMainModal(): void {
    if (this.purchaseModalSaving()) {
      return;
    }

    this.purchaseMainModalOpen.set(false);
    this.purchaseModalOpen.set(false);
    this.estimatedPurchaseModalOpen.set(false);
    this.purchaseModalError.set('');
  }

  protected openPurchaseModal(): void {
    this.resetPurchaseDraft();
    this.purchaseDate.set(new Date().toISOString().slice(0, 10));
    this.purchaseModalOpen.set(true);
    this.purchaseModalError.set('');
    void this.loadSuppliers();
    void this.fetchProducts();
  }

  protected closePurchaseModal(): void {
    this.purchaseModalOpen.set(false);
  }

  protected closeEstimatedPurchaseModal(): void {
    this.estimatedPurchaseModalOpen.set(false);
    this.purchaseAutoNotice.set('');
  }

  protected openPurchaseOcrModal(): void {
    this.purchaseOcrModalOpen.set(true);
  }

  protected closePurchaseOcrModal(): void {
    this.purchaseOcrModalOpen.set(false);
  }

  private clearPurchaseInvoiceImage(): void {
    const preview = this.purchaseInvoiceImagePreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    this.purchaseInvoiceImageFile = null;
    this.purchaseInvoiceImageName.set('');
    this.purchaseInvoiceImagePreview.set('');
    this.purchaseInvoiceOcrStatus.set('');
  }

  protected updatePurchasePaymentType(paymentTypeId: number): void {
    this.purchasePaymentTypeId.set(paymentTypeId);
  }

  protected setPurchaseTrendPeriod(period: PurchaseTrendPeriod): void {
    this.purchaseTrendPeriod.set(period);
    queueMicrotask(() => this.updatePurchasesTrendChart());
  }

  protected updatePurchaseTrendPeriod(event: Event): void {
    this.purchaseTrendPeriod.set((event.target as HTMLSelectElement).value as PurchaseTrendPeriod);
    queueMicrotask(() => this.updatePurchasesTrendChart());
  }

  protected updatePurchaseSupplier(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.purchaseSupplierId.set(value > 0 ? value : null);
  }

  protected updatePurchaseInvoiceNumber(event: Event): void {
    this.purchaseInvoiceNumber.set((event.target as HTMLInputElement).value);
  }

  protected updatePurchaseDate(event: Event): void {
    this.purchaseDate.set((event.target as HTMLInputElement).value);
  }

  protected updatePurchaseProduct(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.purchaseProductId.set(value > 0 ? value : null);
    const product = this.products().find((item) => item.id === value);
    this.purchaseUnitCost.set(product?.unitCost || 0);
  }

  protected updatePurchaseQuantity(event: Event): void {
    this.purchaseQuantity.set(Number((event.target as HTMLInputElement).value || 0));
  }

  protected updatePurchaseUnitCost(event: Event): void {
    this.purchaseUnitCost.set(Number((event.target as HTMLInputElement).value || 0));
  }

  protected updatePurchaseDraftLineQuantity(productId: number, event: Event): void {
    const quantity = Math.max(1, Math.floor(Number((event.target as HTMLInputElement).value || 1)));
    this.purchaseDraftLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, quantity } : line),
    );
  }

  protected updatePurchaseDraftLineCost(productId: number, event: Event): void {
    const unitCost = Math.max(0, Number((event.target as HTMLInputElement).value || 0));
    this.purchaseDraftLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, unitCost } : line),
    );
  }

  protected updateEstimatedPurchaseLineQuantity(productId: number, event: Event): void {
    const quantity = Math.max(1, Math.floor(Number((event.target as HTMLInputElement).value || 1)));
    this.estimatedPurchaseLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, quantity } : line),
    );
  }

  protected updateEstimatedPurchaseLineCost(productId: number, event: Event): void {
    const unitCost = Math.max(0, Number((event.target as HTMLInputElement).value || 0));
    this.estimatedPurchaseLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, unitCost } : line),
    );
  }

  protected updatePurchaseTransportCost(event: Event): void {
    this.purchaseTransportCost.set(Number((event.target as HTMLInputElement).value || 0));
  }

  protected updatePurchaseOtherDirectCost(event: Event): void {
    this.purchaseOtherDirectCost.set(Number((event.target as HTMLInputElement).value || 0));
  }

  protected updateOperationalCostDate(event: Event): void {
    this.operationalCostDate.set((event.target as HTMLInputElement).value);
  }

  protected updateOperationalCostType(event: Event): void {
    this.operationalCostType.set((event.target as HTMLSelectElement).value);
  }

  protected updateOperationalCostDescription(event: Event): void {
    this.operationalCostDescription.set((event.target as HTMLInputElement).value);
  }

  protected updateOperationalCostAmount(event: Event): void {
    this.operationalCostAmount.set(Number((event.target as HTMLInputElement).value || 0));
  }

  protected updateOperationalCostPurchaseInvoice(event: Event): void {
    this.operationalCostPurchaseInvoiceKey.set((event.target as HTMLSelectElement).value);
  }

  protected updateOperationalCostAppliesTo(event: Event): void {
    this.operationalCostAppliesTo.set((event.target as HTMLSelectElement).value);
  }

  protected updateOperationalCostReference(event: Event): void {
    this.operationalCostReference.set((event.target as HTMLInputElement).value);
  }

  protected openOperationalCostModal(): void {
    this.operationalCostModalOpen.set(true);
    this.operationalCostError.set('');
    if (this.purchaseRows().length === 0) {
      void this.loadPurchases();
    }
  }

  protected closeOperationalCostModal(): void {
    if (this.operationalCostSaving()) {
      return;
    }

    this.operationalCostModalOpen.set(false);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LA FOTO LOCAL DE LA FACTURA PARA OCR.
  // NO MANDA CONSULTAS A LA BASE DE DATOS Y NO USA APIS EXTERNAS.
  protected updatePurchaseInvoiceImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    this.purchaseInvoiceImageFile = file;
    this.purchaseInvoiceOcrStatus.set('');

    if (!file) {
      this.purchaseInvoiceImageName.set('');
      this.purchaseInvoiceImagePreview.set('');
      return;
    }

    this.purchaseInvoiceImageName.set(file.name);
    this.purchaseInvoiceImagePreview.set(URL.createObjectURL(file));
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO INTENTA PROCESAR LA FOTO DE FACTURA CON OCR LOCAL DEL NAVEGADOR/ELECTRON.
  // SI EL MOTOR OCR LOCAL NO EXISTE, MUESTRA UN MENSAJE Y NO USA INTERNET NI APIS EXTERNAS.
  protected async processPurchaseInvoiceOcr(): Promise<void> {
    if (!this.purchaseInvoiceImageFile) {
      this.purchaseInvoiceOcrStatus.set('Carga una foto de la factura.');
      return;
    }

    let worker: Tesseract.Worker | null = null;
    try {
      if (this.desktopApi?.processPurchaseInvoiceOcr) {
        this.purchaseInvoiceOcrStatus.set('Procesando factura con OCR local de Electron...');
        const bytes = Array.from(new Uint8Array(await this.purchaseInvoiceImageFile.arrayBuffer()));
        const result = await this.desktopApi.processPurchaseInvoiceOcr({
          bytes,
          fileName: this.purchaseInvoiceImageFile.name,
          mimeType: this.purchaseInvoiceImageFile.type,
        });
        const addedLines = this.addPurchaseLinesFromOcrText(result.text || '');

        this.purchaseInvoiceOcrStatus.set(
          addedLines > 0
            ? `OCR completado. Se agregaron ${addedLines} productos al detalle.`
            : `OCR leyo ${result.text?.length || 0} caracteres, pero no encontro productos registrados por SKU o nombre.`,
        );
        if (addedLines > 0) {
          this.purchaseOcrModalOpen.set(false);
        }
        return;
      }

      this.purchaseInvoiceOcrStatus.set('Inicializando OCR local...');
      worker = await Tesseract.createWorker('spa+eng', 1, {
        corePath: 'assets/tesseract-core',
        langPath: 'assets/tesseract-lang',
        workerPath: 'assets/tesseract/worker.min.js',
        logger: (message) => {
          if (message.status) {
            const progress = Math.round((message.progress || 0) * 100);
            this.purchaseInvoiceOcrStatus.set(`OCR ${message.status} ${progress}%`);
          }
        },
      });

      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      this.purchaseInvoiceOcrStatus.set('Leyendo factura con OCR local...');
      const result = await worker.recognize(this.purchaseInvoiceImageFile);
      const text = result.data.text || '';
      const addedLines = this.addPurchaseLinesFromOcrText(text);

      this.purchaseInvoiceOcrStatus.set(
        addedLines > 0
          ? `OCR completado. Se agregaron ${addedLines} productos al detalle.`
          : `OCR leyo ${text.length} caracteres, pero no encontro productos registrados por SKU o nombre.`,
      );
      if (addedLines > 0) {
        this.purchaseOcrModalOpen.set(false);
      }
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo procesar la imagen con OCR local.');
      this.purchaseInvoiceOcrStatus.set(`No se pudo procesar la imagen con OCR local: ${message}`);
    } finally {
      await worker?.terminate();
    }
  }

  private addPurchaseLinesFromOcrText(text: string): number {
    const normalizedLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    let addedLines = 0;

    for (const product of this.products()) {
      const productNeedles = [product.sku, product.name]
        .filter(Boolean)
        .map((value) => this.normalizeSearchText(value));
      const matchingLine = normalizedLines.find((line) => {
        const normalizedLine = this.normalizeSearchText(line);
        return productNeedles.some((needle) => needle.length >= 3 && normalizedLine.includes(needle));
      });

      if (!matchingLine) {
        continue;
      }

      const numbers = matchingLine.match(/\d+(?:[.,]\d+)?/g) || [];
      const quantity = Math.max(1, Math.floor(Number((numbers[0] || '1').replace(',', '.')) || 1));
      const unitCost = product.unitCost > 0 ? product.unitCost : this.purchaseUnitCost();

      if (unitCost <= 0) {
        continue;
      }

      this.purchaseDraftLines.update((lines) => {
        const existing = lines.find((line) => line.productId === product.id);
        if (existing) {
          return lines.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + quantity, unitCost } : line,
          );
        }

        return [...lines, { productId: product.id, quantity, unitCost }];
      });
      addedLines += 1;
    }

    return addedLines;
  }

  protected addPurchaseDraftLine(): void {
    const productId = this.purchaseProductId();
    const quantity = this.purchaseQuantity();
    const unitCost = this.purchaseUnitCost();

    if (!productId || quantity <= 0 || unitCost <= 0) {
      this.purchaseModalError.set('Selecciona producto, cantidad y costo valido.');
      return;
    }

    this.purchaseDraftLines.update((lines) => {
      const existing = lines.find((line) => line.productId === productId);
      if (existing) {
        return lines.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + quantity, unitCost } : line,
        );
      }

      return [...lines, { productId, quantity, unitCost }];
    });
    this.estimatedPurchaseReasons.update((reasons) => {
      const { [productId]: _removed, ...remaining } = reasons;
      return remaining;
    });
    this.purchaseModalError.set('');
  }

  protected removePurchaseDraftLine(productId: number): void {
    this.purchaseDraftLines.update((lines) => lines.filter((line) => line.productId !== productId));
    this.estimatedPurchaseReasons.update((reasons) => {
      const { [productId]: _removed, ...remaining } = reasons;
      return remaining;
    });
  }

  protected removeEstimatedPurchaseLine(productId: number): void {
    this.estimatedPurchaseLines.update((lines) => lines.filter((line) => line.productId !== productId));
  }

  protected purchaseDraftLineReason(productId: number): string {
    return this.estimatedPurchaseReasons()[productId] || '';
  }

  protected estimatedPurchaseTotal(): number {
    return this.estimatedPurchaseLines().reduce((total, line) => total + line.quantity * line.unitCost, 0);
  }

  protected productNameById(productId: number): string {
    return this.products().find((product) => product.id === productId)?.name || 'Producto';
  }

  protected async generateEstimatedPurchaseManually(): Promise<void> {
    await this.loadSuppliers();
    await this.fetchProducts();
    await this.loadExpiringProducts();
    this.openEstimatedPurchaseModal('manual');
  }

  private openAutomaticPurchaseIfDue(): void {
    const today = new Date();
    const forceTest = new URLSearchParams(window.location.search).has('autoPurchaseTest');

    if ((!forceTest && today.getDay() !== 6) || !this.currentUser()) {
      return;
    }

    const storageKey = this.automaticPurchaseStorageKey(today);

    if (!forceTest && localStorage.getItem(storageKey)) {
      return;
    }

    if (this.openEstimatedPurchaseModal('automatic')) {
      localStorage.setItem(storageKey, '1');
    }
  }

  private openEstimatedPurchaseModal(mode: 'manual' | 'automatic'): boolean {
    const estimatedLines = this.buildEstimatedPurchaseLines();

    if (estimatedLines.length === 0) {
      if (mode === 'manual') {
        this.purchaseAutoNotice.set('No hay productos con stock bajo o proximos a vencer para generar compra estimada.');
      }
      return false;
    }

    this.purchaseMainModalOpen.set(true);
    this.estimatedPurchaseModalOpen.set(true);
    this.purchaseModalOpen.set(false);
    this.purchaseModalError.set('');
    this.estimatedPurchaseLines.set(estimatedLines);
    this.purchaseAutoNotice.set(
      `Se genero una compra automatica con ${estimatedLines.length} producto(s) por stock bajo o pronto vencimiento.`,
    );

    return true;
  }

  protected useEstimatedPurchaseLines(): void {
    const lines = this.estimatedPurchaseLines();

    if (lines.length === 0) {
      this.purchaseAutoNotice.set('No hay productos en la compra estimada.');
      return;
    }

    const reasons = lines.reduce<Record<number, string>>((result, line) => {
      result[line.productId] = line.reason;
      return result;
    }, {});

    this.resetPurchaseDraft();
    this.purchaseDate.set(new Date().toISOString().slice(0, 10));
    this.purchaseInvoiceNumber.set(`AUTO-${this.purchaseDate().replace(/-/g, '')}`);
    this.purchasePaymentTypeId.set(1);
    this.purchaseDraftLines.set(lines.map(({ reason: _reason, ...line }) => line));
    this.estimatedPurchaseReasons.set(reasons);
    this.estimatedPurchaseModalOpen.set(false);
    this.purchaseModalOpen.set(true);
    this.purchaseAutoNotice.set('');
  }

  private resetPurchaseDraft(): void {
    this.purchaseDraftLines.set([]);
    this.estimatedPurchaseReasons.set({});
    this.purchaseInvoiceNumber.set('');
    this.purchaseProductId.set(null);
    this.purchaseQuantity.set(1);
    this.purchaseUnitCost.set(0);
    this.purchaseTransportCost.set(0);
    this.purchaseOtherDirectCost.set(0);
    this.clearPurchaseInvoiceImage();
  }

  private buildEstimatedPurchaseLines(): EstimatedPurchaseLine[] {
    const products = this.products();
    const expiringByProductId = new Map(this.expiringProductAlerts().map((alert) => [alert.productId, alert]));
    const estimatedByProductId = new Map<number, EstimatedPurchaseLine>();

    for (const product of products) {
      const lowStock = product.stock <= product.minStock;
      const expiringAlert = expiringByProductId.get(product.id);

      if (!lowStock && !expiringAlert) {
        continue;
      }

      const targetStock = this.estimateTargetStock(product, products);
      const lowStockQuantity = lowStock ? Math.max(0, targetStock - product.stock) : 0;
      const expiringReplacementQuantity = expiringAlert ? Math.max(1, Math.ceil(expiringAlert.stock)) : 0;
      const quantity = Math.max(1, Math.ceil(Math.max(lowStockQuantity, expiringReplacementQuantity)));
      const reasons = [
        lowStock ? `Stock bajo: ${product.stock}/${product.minStock}` : '',
        expiringAlert ? `Proximo a vencer: ${expiringAlert.stock} unidad(es) en ${expiringAlert.daysRemaining} dia(s)` : '',
      ].filter(Boolean);

      estimatedByProductId.set(product.id, {
        productId: product.id,
        quantity,
        unitCost: Math.max(product.unitCost || 0, 0),
        reason: reasons.join(' + '),
      });
    }

    return [...estimatedByProductId.values()].sort((a, b) =>
      this.productNameById(a.productId).localeCompare(this.productNameById(b.productId)),
    );
  }

  private estimateTargetStock(product: Product, products: Product[]): number {
    const categoryProducts = products.filter((item) => item.category === product.category && item.id !== product.id);
    const healthyCategoryStocks = categoryProducts
      .filter((item) => item.stock > item.minStock)
      .map((item) => item.stock);
    const healthyGlobalStocks = products
      .filter((item) => item.stock > item.minStock)
      .map((item) => item.stock);
    const averageHealthyStock = this.averageNumber(healthyCategoryStocks) || this.averageNumber(healthyGlobalStocks);
    const configuredTarget = Math.max(product.maxStock || 0, product.minStock * 2);

    return Math.max(product.minStock + 1, Math.ceil(Math.max(configuredTarget, averageHealthyStock)));
  }

  private averageNumber(values: number[]): number {
    return values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  }

  private automaticPurchaseStorageKey(date: Date): string {
    const weekStart = this.startOfWeek(date);
    return `yahweh-rohi-auto-purchase-${this.formatDateKey(weekStart)}`;
  }

  protected async savePurchaseHistory(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      this.purchaseModalError.set('Usuario requerido.');
      return;
    }

    if (!this.purchaseSupplierId()) {
      this.purchaseModalError.set('Selecciona un proveedor.');
      return;
    }

    if (!this.purchaseInvoiceNumber().trim()) {
      this.purchaseModalError.set('Ingresa el numero de factura.');
      return;
    }

    if (!this.purchaseDate()) {
      this.purchaseModalError.set('Selecciona la fecha de compra.');
      return;
    }

    if (this.purchaseDraftLines().length === 0) {
      this.purchaseModalError.set('Agrega al menos un producto.');
      return;
    }

    this.purchaseModalSaving.set(true);
    this.purchaseModalError.set('');

    try {
      const payload = {
        userId: currentUser.id,
        paymentTypeId: this.purchasePaymentTypeId(),
        supplierId: this.purchaseSupplierId() || 0,
        invoiceNumber: this.purchaseInvoiceNumber(),
        purchaseDate: this.purchaseDate(),
        transportCost: this.purchaseTransportCost(),
        otherDirectCost: this.purchaseOtherDirectCost(),
        lines: this.purchaseDraftLines(),
      };

      if (this.desktopApi) {
        await this.desktopApi.createPurchase(payload);
      } else {
        await firstValueFrom(this.http.post<PurchaseResponse>('/api/purchases', payload));
      }

      this.resetPurchaseDraft();
      this.purchaseDate.set(new Date().toISOString().slice(0, 10));
      this.purchaseModalOpen.set(false);
      this.purchaseAutoNotice.set('');
      await this.loadSuppliers();
      await this.loadPurchases();
      await this.fetchProducts();
    } catch (error) {
      this.purchaseModalError.set(this.extractErrorMessage(error, 'No se pudo guardar la compra.'));
    } finally {
      this.purchaseModalSaving.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CONSTRUYE UN REPORTE HTML LOCAL PARA EXPORTAR CREDITOS A PDF.
  // NO MANDA CONSULTAS A LA BASE DE DATOS; SOLO USA LOS DATOS YA CARGADOS EN MEMORIA.
  private openPrintableReportWindow(): Window | null {
    return window.open('', '_blank', 'width=1100,height=800');
  }

  private openPrintableCreditReport(report: {
    title: string;
    subtitle: string;
    summary: Array<[string, string]>;
    headers: string[];
    rows: string[][];
  }): boolean {
    const printWindow = this.openPrintableReportWindow();

    if (!printWindow) {
      return false;
    }

    this.writePrintableReport(printWindow, report);
    return true;
  }

  private writePrintableReport(printWindow: Window, report: {
    title: string;
    subtitle: string;
    summary: Array<[string, string]>;
    headers: string[];
    rows: string[][];
  }): void {
    const summaryHtml = report.summary
      .map(([label, value]) => `<article><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value)}</strong></article>`)
      .join('');
    const headersHtml = report.headers.map((header) => `<th>${this.escapeHtml(header)}</th>`).join('');
    const rowsHtml = report.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${this.escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${this.escapeHtml(report.title)}</title>
          <style>
            body { color: #17212f; font-family: Georgia, "Times New Roman", serif; margin: 32px; }
            header { border-bottom: 3px solid #0f766e; margin-bottom: 22px; padding-bottom: 14px; }
            h1 { font-size: 28px; margin: 0 0 6px; }
            p { color: #475569; margin: 0; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
            article { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
            article span { color: #64748b; display: block; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; }
            article strong { font-size: 18px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #cbd5e1; font-size: 12px; padding: 9px; text-align: left; }
            th { background: #0f766e; color: #ffffff; }
            tr:nth-child(even) td { background: #f8fafc; }
            footer { color: #64748b; font-size: 11px; margin-top: 20px; }
            @media print { button { display: none; } body { margin: 18px; } }
          </style>
        </head>
        <body>
          <header>
            <h1>${this.escapeHtml(report.title)}</h1>
            <p>${this.escapeHtml(report.subtitle)}</p>
          </header>
          <section class="summary">${summaryHtml}</section>
          <table>
            <thead><tr>${headersHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <footer>Reporte generado localmente desde Yahweh Rohi Inventory.</footer>
          <script>
            window.addEventListener('load', () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      currency: 'HNL',
      style: 'currency',
      minimumFractionDigits: 2,
    }).format(value);
  }

  private formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat('es-HN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-HN').format(value);
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeSearchText(value: string | null | undefined): string {
    return this.normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private formatSalesTrendLabel(periodStart: string, period: SalesTrendPeriod): string {
    const date = new Date(periodStart);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    if (period === 'day') {
      return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date);
    }

    if (period === 'week') {
      return `Sem ${new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(date)}`;
    }

    if (period === 'year') {
      return new Intl.DateTimeFormat('es-HN', { year: 'numeric', timeZone: 'UTC' }).format(date);
    }

    return new Intl.DateTimeFormat('es-HN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date);
  }

  private buildPurchaseTrendPeriods(period: Exclude<PurchaseTrendPeriod, 'year'>): Array<{ key: string; label: string }> {
    const today = this.startOfDay(new Date());
    const count = period === 'month' ? 12 : 10;
    const start = period === 'day'
      ? this.addDays(today, -(count - 1))
      : period === 'week'
        ? this.addDays(this.startOfWeek(today), -7 * (count - 1))
        : this.addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -(count - 1));

    return Array.from({ length: count }, (_, index) => {
      const date = period === 'day'
        ? this.addDays(start, index)
        : period === 'week'
          ? this.addDays(start, index * 7)
          : this.addMonths(start, index);

      return {
        key: this.purchaseTrendPeriodKey(date, period),
        label: this.formatPurchaseTrendLabel(date, period),
      };
    });
  }

  private purchaseTrendPeriodKey(date: Date, period: Exclude<PurchaseTrendPeriod, 'year'>): string {
    if (period === 'day') {
      return this.formatDateKey(this.startOfDay(date));
    }

    if (period === 'week') {
      return this.formatDateKey(this.startOfWeek(date));
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private formatPurchaseTrendLabel(date: Date, period: Exclude<PurchaseTrendPeriod, 'year'>): string {
    if (period === 'day') {
      return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(date);
    }

    if (period === 'week') {
      return `Sem ${new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(date)}`;
    }

    return new Intl.DateTimeFormat('es-HN', { month: 'short', year: '2-digit' }).format(date);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfWeek(date: Date): Date {
    const start = this.startOfDay(date);
    const mondayOffset = (start.getDay() + 6) % 7;
    return this.addDays(start, -mondayOffset);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private formatDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  protected formatCutDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const rawValue = String(value).trim();
    const match = rawValue.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
    );

    if (match) {
      const [, year, month, day, hours = '00', minutes = '00'] = match;
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    const parsedDate = new Date(rawValue);

    if (!Number.isNaN(parsedDate.getTime())) {
      return new Intl.DateTimeFormat('es-HN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(parsedDate);
    }

    return rawValue;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  protected selectLoginUser(event: Event): void {
    this.loginUser.set((event.target as HTMLSelectElement).value);
  }

  protected isFavoriteProduct(productId: number): boolean {
    return this.favoriteProductIds().includes(productId);
  }

  protected toggleFavoriteProduct(productId: number, event: Event): void {
    event.stopPropagation();
    this.favoriteProductIds.update((favoriteIds) =>
      favoriteIds.includes(productId)
        ? favoriteIds.filter((favoriteId) => favoriteId !== productId)
        : [productId, ...favoriteIds],
    );
    localStorage.setItem('yahweh-rohi-favorite-products', JSON.stringify(this.favoriteProductIds()));
  }

  protected loadProductsFromDatabase(): void {
    void this.refreshProductsAndAutoPurchase();
  }

  private async refreshProductsAndAutoPurchase(): Promise<void> {
    await this.fetchProducts();
    await this.loadExpiringProducts();
    this.openAutomaticPurchaseIfDue();
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA EL SIGUIENTE NUMERO DE FACTURA PARA EL FORMULARIO DE VENTA.
  // SI USA API HTTP, LLAMA GET /api/invoices/next UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getNextInvoiceNumber() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO getNextInvoiceNumber() EN server/data-access.js,
  // DONDE ESTA UBICADA LA CONSULTA SELECT ISNULL(MAX(ID_FACT), 0) + 1 FROM dbo.FACTURA.
  protected async loadNextInvoiceNumber(): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getNextInvoiceNumber()
        : await firstValueFrom(this.http.get<NextInvoiceResponse>('/api/invoices/next'));

      this.nextInvoiceNumber.set(response.nextInvoiceNumber);
    } catch {
      this.nextInvoiceNumber.set(null);
    }
  }

  protected setPage(page: Page): void {
    this.activatePage(page, true);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE DIRECTAMENTE LA PAGINA CREDITOS DESDE EL MENU LATERAL.
  // TAMBIEN MANDA A LLAMAR loadCredits(), QUE CONSULTA dbo.VENTA_CREDITO
  // POR MEDIO DE /api/credits O electronAPI.getCredits().
  protected openCreditsPage(): void {
    this.activatePage('credits', true);
  }

  protected logout(): void {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.loginPassword.set('');
    this.loginError.set('');
    this.activePage.set('billing');
    this.expiringProductsModalOpen.set(false);
    this.salesDropAlertModalOpen.set(false);
    this.expiringProductAlerts.set([]);
    this.expiringProductsError.set('');
    this.salesDropAlertError.set('');
    this.clearSession();
  }

  private async shouldPromptOpeningCut(date: string): Promise<boolean> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      return true;
    }

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getDailyCuts(date, date, currentUser.id)
        : await firstValueFrom(this.http.get<{ cuts: DailyCut[] }>(
            `/api/daily-cuts?dateFrom=${encodeURIComponent(date)}&dateTo=${encodeURIComponent(date)}&userId=${encodeURIComponent(currentUser.id)}`,
          ));

      return !response.cuts.some((cut) => Number(cut.statusId || 0) === 1);
    } catch {
      return true;
    }
  }

  private saveSession(user: LoginResponse['user']): void {
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify(user));
      localStorage.setItem(activePageStorageKey, 'billing');
    } catch {
      return;
    }
  }

  private async authenticateUser(usuario: string, pass: string): Promise<void> {
    try {
      const response = await this.requestLogin(usuario, pass);
      const today = new Date().toISOString().slice(0, 10);
      this.currentUser.set(response.user);
      const shouldOpenOpeningCut = await this.shouldPromptOpeningCut(today);
      this.isAuthenticated.set(true);
      this.logoutCutModalOpen.set(false);
      this.logoutCutError.set('');
      this.logoutCutPreview.set(null);
      this.saveSession(response.user);
      this.loadProductsFromDatabase();
      this.expiringProductsModalOpen.set(true);
      void this.loadSalesDropAlert(true);
      this.activatePage('billing', false);
      this.openingCutModalOpen.set(shouldOpenOpeningCut);
      this.loginLoading.set(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar sesion.';
      this.loginError.set(message);
      this.loginLoading.set(false);
    }
  }

  private async requestLogin(usuario: string, pass: string): Promise<LoginResponse> {
    if (this.desktopApi) {
      return this.desktopApi.login({ usuario, pass });
    }

    return firstValueFrom(this.http.post<LoginResponse>('/api/auth/login', { usuario, pass }));
  }

  private async loadLoginUsers(): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getUsers()
        : await firstValueFrom(this.http.get<UsersResponse>('/api/auth/users'));

      this.loginUsers.set(response.users);

      if (!this.loginUser() && response.users.length === 1) {
        this.loginUser.set(response.users[0].usuario);
      }
    } catch {
      this.loginUsers.set([]);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LOS CLIENTES REALES DESDE LA TABLA cliente
  // PARA LLENAR EL MODAL DE SELECCION DE CLIENTES EN FACTURACION.
  private async loadCustomers(): Promise<void> {
    this.customerLoading.set(true);
    this.customerError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getCustomers()
        : await firstValueFrom(this.http.get<CustomersResponse>('/api/customers'));

      this.customerOptions.set(response.customers);
    } catch {
      this.customerOptions.set([]);
      this.customerError.set('No se pudieron cargar los clientes.');
    } finally {
      this.customerLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LOS PROVEEDORES REALES DESDE LA TABLA proveedor
  // PARA LLENAR EL MODAL DE SELECCION DE PROVEEDORES EN COMPRAS.
  private async loadSuppliers(): Promise<void> {
    this.supplierLoading.set(true);
    this.supplierError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getSuppliers()
        : await firstValueFrom(this.http.get<SuppliersResponse>('/api/suppliers'));

      this.supplierOptions.set(response.suppliers);
    } catch {
      this.supplierOptions.set([]);
      this.supplierError.set('No se pudieron cargar los proveedores.');
    } finally {
      this.supplierLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LAS ALERTAS DE VENCIMIENTO DESDE dbo.PRODUCTO_PROXIMO_VENCER.
  // SI USA API HTTP, LLAMA /api/products/expiring EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getExpiringProducts() EXPUESTO EN electron/preload.js.
  private async loadExpiringProducts(): Promise<void> {
    this.expiringProductsLoading.set(true);
    this.expiringProductsError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getExpiringProducts()
        : await firstValueFrom(this.http.get<ExpiringProductsResponse>('/api/products/expiring'));

      this.expiringProductAlerts.set(response.alerts);
    } catch {
      this.expiringProductAlerts.set([]);
      this.expiringProductsError.set('No se pudieron cargar las alertas de vencimiento.');
    } finally {
      this.expiringProductsLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA ASISTENCIA Y PLANILLA CON USUARIOS REALES DESDE dbo.usuario,
  // dbo.ASISTENCIA Y dbo.VW_ASISTENCIA_HORAS.
  // SI USA API HTTP, LLAMA /api/attendance/users EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getAttendanceUsers() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO listAttendanceUsers() EN server/data-access.js.
  private async loadAttendanceUsers(): Promise<void> {
    try {
      const response = this.desktopApi?.getAttendanceUsers
        ? await this.desktopApi.getAttendanceUsers()
        : await firstValueFrom(this.http.get<AttendanceUsersResponse>('/api/attendance/users'));

      const users = response.users.map((user) => this.mapAttendanceUser(user));
      this.attendanceUsers.set(users);
      this.syncPayrollState(users);
    } catch {
      this.attendanceUsers.set([]);
      this.syncPayrollState([]);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LA ALERTA DE CAIDA DE VENTAS.
  // SI USA API HTTP, LLAMA /api/dashboard/sales-drop-alert EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getSalesDropAlert() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO getSalesDropAlert() EN server/data-access.js.
  private async loadSalesDropAlert(openModalIfNeeded = false): Promise<void> {
    this.salesDropAlertLoading.set(true);
    this.salesDropAlertError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getSalesDropAlert()
        : await firstValueFrom(this.http.get<SalesDropAlertResponse>('/api/dashboard/sales-drop-alert'));

      this.salesDropAlert.set(response.alert);

      if (openModalIfNeeded && response.alert.shouldAlert) {
        this.salesDropAlertModalOpen.set(true);
      }
    } catch {
      this.salesDropAlert.set({
        isActive: false,
        shouldAlert: false,
        severity: 'pending',
        evaluatedAt: null,
        cutoffTime: null,
        todayTotal: 0,
        yesterdayTotal: 0,
        referenceDate: null,
        isReferenceFallback: false,
        shortfallAmount: 0,
        dropPercentage: 0,
      });
      this.salesDropAlertError.set('No se pudo evaluar la alerta de caida de ventas.');
    } finally {
      this.salesDropAlertLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA EL HISTORICO REAL DE COMPRAS DESDE dbo.COMPRA_EFECTIVO
  // Y dbo.COMPRA_CREDITO POR MEDIO DE listPurchases() EN server/data-access.js.
  private async loadPurchases(): Promise<void> {
    this.purchaseLoading.set(true);
    this.purchaseError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getPurchases()
        : await firstValueFrom(this.http.get<PurchasesResponse>('/api/purchases'));

      this.purchaseRows.set([...response.purchases]);
      queueMicrotask(() => this.updatePurchasesTrendChart());
    } catch {
      this.purchaseRows.set([]);
      this.purchaseError.set('No se pudieron cargar las compras.');
    } finally {
      this.purchaseLoading.set(false);
    }
  }

  private async loadCostIncreaseAlerts(): Promise<void> {
    this.costIncreaseAlertLoading.set(true);
    this.costIncreaseAlertError.set('');

    try {
      const response = this.desktopApi?.getCostIncreaseAlerts
        ? await this.desktopApi.getCostIncreaseAlerts()
        : await firstValueFrom(this.http.get<CostIncreaseAlertsResponse>('/api/costs/cost-increase-alerts'));

      this.costIncreaseAlertRows.set(response.rows || []);
      this.costIncreaseAlertPeriod.set(response.period || null);
    } catch {
      this.costIncreaseAlertRows.set([]);
      this.costIncreaseAlertPeriod.set(null);
      this.costIncreaseAlertError.set('No se pudieron cargar los aumentos de costo del ultimo mes.');
    } finally {
      this.costIncreaseAlertLoading.set(false);
    }
  }

  private async loadOperationalCosts(): Promise<void> {
    this.operationalCostLoading.set(true);
    this.operationalCostError.set('');

    try {
      const year = this.selectedCostYear();
      const month = this.selectedCostMonth();
      const response = this.desktopApi?.getOperationalCosts
        ? await this.desktopApi.getOperationalCosts(year, month)
        : await firstValueFrom(this.http.get<OperationalCostsResponse>(
            `/api/costs/operational?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
          ));

      this.operationalCostRows.set(response.rows || []);
    } catch {
      this.operationalCostRows.set([]);
      this.operationalCostError.set('No se pudieron cargar los costos operativos.');
    } finally {
      this.operationalCostLoading.set(false);
    }
  }

  protected async saveOperationalCost(): Promise<void> {
    const currentUser = this.currentUser();

    if (this.operationalCostAmount() <= 0) {
      this.operationalCostError.set('Ingresa un monto valido para el costo operativo.');
      return;
    }

    const selectedInvoice = this.purchaseInvoiceOptions().find((invoice) => invoice.key === this.operationalCostPurchaseInvoiceKey());

    if (!selectedInvoice) {
      this.operationalCostError.set('Selecciona una factura de compra existente para registrar el costo operativo.');
      return;
    }

    this.operationalCostSaving.set(true);
    this.operationalCostError.set('');

    try {
      const payload = {
        date: this.operationalCostDate(),
        type: this.operationalCostType(),
        description: this.operationalCostDescription(),
        amount: this.operationalCostAmount(),
        userId: currentUser?.id || null,
        invoiceId: null,
        invoiceNumber: selectedInvoice.invoiceNumber,
        purchaseId: selectedInvoice.purchaseId,
        purchaseType: selectedInvoice.purchaseType,
        appliesTo: this.operationalCostAppliesTo(),
        reference: this.operationalCostReference(),
      };

      if (this.desktopApi?.createOperationalCost) {
        await this.desktopApi.createOperationalCost(payload);
      } else {
        await firstValueFrom(this.http.post('/api/costs/operational', payload));
      }

      this.operationalCostDescription.set('');
      this.operationalCostAmount.set(0);
      this.operationalCostPurchaseInvoiceKey.set('');
      this.operationalCostReference.set('');
      this.operationalCostModalOpen.set(false);
      await this.loadOperationalCosts();
    } catch (error) {
      this.operationalCostError.set(this.extractErrorMessage(error, 'No se pudo guardar el costo operativo.'));
    } finally {
      this.operationalCostSaving.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA EL HISTORICO REAL DE MOVIMIENTOS DESDE dbo.auditoria.
  // SI USA API HTTP, LLAMA GET /api/history/audit UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getAuditHistory() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO listAuditHistory() EN server/data-access.js.
  protected async loadAuditHistory(): Promise<void> {
    this.auditHistoryLoading.set(true);
    this.auditHistoryError.set('');

    try {
      const response = this.desktopApi?.getAuditHistory
        ? await this.desktopApi.getAuditHistory(200)
        : await firstValueFrom(this.http.get<AuditHistoryResponse>('/api/history/audit?limit=200'));

      this.auditHistory.set(response.history || []);
    } catch {
      this.auditHistory.set([]);
      this.auditHistoryError.set('No se pudo cargar el historico de auditoria.');
    } finally {
      this.auditHistoryLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LOS CREDITOS DESDE dbo.VENTA_CREDITO PARA LA PAGINA CREDITOS.
  // SI USA API HTTP, LLAMA GET /api/credits UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getCredits() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO listCredits() EN server/data-access.js,
  // DONDE ESTA UBICADA LA CONSULTA A dbo.VENTA_CREDITO CON JOIN A cliente Y producto.
  protected async loadCredits(): Promise<void> {
    this.creditLoading.set(true);
    this.creditError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getCredits()
        : await firstValueFrom(this.http.get<CreditsResponse>('/api/credits'));

      this.creditLines.set(response.credits);
    } catch {
      this.creditLines.set([]);
      this.creditError.set('No se pudieron cargar los creditos.');
    } finally {
      this.creditLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LOS TOTALES DE VENTAS Y COMPRAS PARA LAS TARJETAS DEL DASHBOARD.
  // SI USA API HTTP, LLAMA GET /api/dashboard/sales-summary UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getDashboardSalesSummary() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO getDashboardSalesSummary() EN server/data-access.js,
  // DONDE SE CONSULTAN dbo.VENTA_EFECTIVO, dbo.VENTA_TRANSFERENCIA, dbo.VENTA_CREDITO,
  // dbo.COMPRA_EFECTIVO Y dbo.COMPRA_CREDITO.
  protected async loadDashboardSalesSummary(): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getDashboardSalesSummary()
        : await firstValueFrom(this.http.get<DashboardSalesSummaryResponse>('/api/dashboard/sales-summary'));

      this.dashboardSalesSummary.set(response);
    } catch {
      this.dashboardSalesSummary.set({
        cashTransferTotal: 0,
        currentMonthCashTransferTotal: 0,
        creditTotal: 0,
        currentMonthCreditTotal: 0,
        lastMonthSalesTotal: 0,
        accumulatedSalesTotal: 0,
        totalPurchases: 0,
        accumulatedPurchasesTotal: 0,
        lastMonthLabel: '',
        purchaseMonthLabel: '',
      });
    }
  }

  protected setDashboardSalesTotalView(view: 'month' | 'accumulated'): void {
    this.dashboardSalesTotalView.set(view);
  }

  protected setDashboardCashTransferView(view: 'month' | 'accumulated'): void {
    this.dashboardCashTransferView.set(view);
  }

  protected setDashboardCreditView(view: 'month' | 'accumulated'): void {
    this.dashboardCreditView.set(view);
  }

  protected setDashboardPurchasesTotalView(view: 'month' | 'accumulated'): void {
    this.dashboardPurchasesTotalView.set(view);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LA TENDENCIA REAL DE VENTAS PARA EL GRAFICO DEL DASHBOARD.
  // SI USA API HTTP, LLAMA GET /api/dashboard/sales-trend UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.getDashboardSalesTrend() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO getDashboardSalesTrend() EN server/data-access.js,
  // DONDE SE CONSULTAN dbo.VENTA_EFECTIVO, dbo.VENTA_CREDITO Y dbo.VENTA_TRANSFERENCIA.
  protected async loadDashboardSalesTrend(): Promise<void> {
    try {
      const period = this.salesTrendPeriod();
      const response = this.desktopApi
        ? await this.desktopApi.getDashboardSalesTrend(period)
        : await firstValueFrom(this.http.get<DashboardSalesTrendResponse>(`/api/dashboard/sales-trend?period=${period}`));

      this.salesTrendData.set(response.trend.map((item) => ({
        ...item,
        label: this.formatSalesTrendLabel(item.periodStart, period),
      })));
    } catch {
      this.salesTrendData.set([]);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LA PAGINA FACTURAS DESDE SQL SERVER.
  // LLAMA /api/invoices Y /api/invoices/summary O LOS HANDLERS DE ELECTRON.
  protected async loadInvoicesPageData(): Promise<void> {
    this.invoiceLoading.set(true);
    this.invoiceError.set('');

    try {
      const [invoicesResponse, summaryResponse] = await Promise.all([
        this.desktopApi
          ? this.desktopApi.getInvoices()
          : firstValueFrom(this.http.get<InvoicesResponse>('/api/invoices')),
        this.desktopApi
          ? this.desktopApi.getInvoicesSummary()
          : firstValueFrom(this.http.get<InvoicesSummaryResponse>('/api/invoices/summary')),
      ]);

      this.invoiceRows.set(invoicesResponse.invoices);
      this.invoicesSummary.set(summaryResponse);
      this.invoicePage.set(1);
    } catch (error) {
      this.invoiceRows.set([]);
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudieron cargar las facturas.'));
    } finally {
      this.invoiceLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LAS VENTAS DEL DIA DESDE SQL SERVER PARA EL MODAL DE FACTURACION.
  // LLAMA /api/invoices/today O window.electronAPI.getTodayInvoices().
  // AMBOS FLUJOS TERMINAN EJECUTANDO listTodayInvoices() EN server/data-access.js,
  // DONDE SE CONSULTA dbo.FACTURA FILTRANDO POR FECHA ACTUAL.
  protected async loadTodayInvoices(): Promise<void> {
    this.todayInvoiceLoading.set(true);
    this.todayInvoiceError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getTodayInvoices()
        : await firstValueFrom(this.http.get<InvoicesResponse>('/api/invoices/today'));

      this.todayInvoiceRows.set(response.invoices);
    } catch (error) {
      this.todayInvoiceRows.set([]);
      this.todayInvoiceError.set(this.extractErrorMessage(error, 'No se pudieron cargar las ventas del dia.'));
    } finally {
      this.todayInvoiceLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA EL HISTORICO DE CORTES DESDE dbo.CORTE_DIARIO.
  // LLAMA /api/daily-cuts O window.electronAPI.getDailyCuts().
  protected async loadDailyCuts(): Promise<void> {
    this.cutLoading.set(true);
    this.cutError.set('');

    try {
      const dateFrom = this.cutFilterFromDate();
      const dateTo = this.cutFilterToDate();
      const response = this.desktopApi
        ? await this.desktopApi.getDailyCuts(dateFrom, dateTo)
        : await firstValueFrom(
            this.http.get<DailyCutsResponse>(
              `/api/daily-cuts?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`,
            ),
          );

      this.cutRows.set(response.cuts);
      this.selectedCutId.set(response.cuts[0]?.id ?? null);
      const preview = await this.loadDailyCutPreview(dateTo);
      this.cutPreview.set(preview);
      await this.loadCreditPaymentsForCut(dateTo, preview.userId ?? undefined);
    } catch (error) {
      this.cutRows.set([]);
      this.cutPreview.set(null);
      this.creditPaymentRows.set([]);
      this.cutError.set(this.extractErrorMessage(error, 'No se pudieron cargar los cortes.'));
    } finally {
      this.cutLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CALCULA EL CORTE DEL DIA SIN GUARDARLO EN dbo.CORTE_DIARIO.
  // LLAMA /api/daily-cuts/preview O window.electronAPI.previewDailyCut().
  protected async loadDailyCutPreview(date: string, userId?: number): Promise<DailyCut> {
    const resolvedUserId = userId ?? this.currentUser()?.id;
    const response = this.desktopApi
      ? await this.desktopApi.previewDailyCut(date, resolvedUserId)
      : await firstValueFrom(
          this.http.get<DailyCutResponse>(
            `/api/daily-cuts/preview?date=${encodeURIComponent(date)}${resolvedUserId ? `&userId=${encodeURIComponent(resolvedUserId)}` : ''}`,
          ),
        );

    return response.cut;
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CONSULTA LOS ABONOS DE CREDITO DESDE dbo.PAGOS_CREDITO POR FECHA.
  protected async loadCreditPaymentsForCut(date: string, userId?: number): Promise<void> {
    try {
      const cutDate = String(date || this.cutFilterToDate()).slice(0, 10);
      const resolvedUserId = userId ?? this.currentUser()?.id;
      const response = this.desktopApi
        ? await this.desktopApi.getCreditPayments(cutDate, resolvedUserId)
        : await firstValueFrom(
            this.http.get<CreditPaymentsResponse>(
              `/api/credit-payments?date=${encodeURIComponent(cutDate)}${resolvedUserId ? `&userId=${encodeURIComponent(resolvedUserId)}` : ''}`,
            ),
          );

      this.creditPaymentRows.set(response.payments);
    } catch {
      this.creditPaymentRows.set([]);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GENERA UN CORTE NUEVO EN dbo.CORTE_DIARIO PARA LA FECHA SELECCIONADA.
  // LLAMA /api/daily-cuts O window.electronAPI.createDailyCut().
  protected async createDailyCut(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      this.cutError.set('No hay un usuario autenticado para generar el corte.');
      return;
    }

    this.cutSaving.set(true);
    this.cutError.set('');

    try {
      const date = this.cutFilterToDate();
      const response = this.desktopApi
        ? await this.desktopApi.createDailyCut({ date, userId: currentUser.id })
        : await firstValueFrom(this.http.post<DailyCutResponse>('/api/daily-cuts', { date, userId: currentUser.id }));

      this.cutRows.update((cuts) => [response.cut, ...cuts.filter((cut) => cut.id !== response.cut.id)]);
      this.cutPreview.set(response.cut);
      this.selectedCutId.set(response.cut.id);
      await this.loadCreditPaymentsForCut(response.cut.date, response.cut.userId ?? undefined);
    } catch (error) {
      this.cutError.set(this.extractErrorMessage(error, 'No se pudo generar el corte.'));
    } finally {
      this.cutSaving.set(false);
    }
  }

  private async fetchProducts(): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getProducts()
        : await firstValueFrom(this.http.get<ProductsResponse>('/api/products'));

      this.products.set(
        response.products.map((product) => ({
          ...product,
          margin:
            product.margin ??
            (product.salePrice > 0 ? (product.salePrice - product.unitCost) / product.salePrice : 0),
        })),
      );
      this.cart.set([]);
      this.purchaseCosts.set({});
      this.billingPage.set(1);
      this.costsPage.set(1);
      this.inventoryPage.set(1);
    } catch {
      return;
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof (error as { error?: unknown }).error === 'object' &&
      (error as { error?: { message?: string } }).error?.message
    ) {
      return (error as { error: { message: string } }).error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

  private showSaleSuccess(message: string, variant: 'success' | 'error' = 'success'): void {
    this.saleToastVariant.set(variant);
    this.saleSuccessMessage.set(message);

    if (this.saleSuccessTimeoutId !== null) {
      clearTimeout(this.saleSuccessTimeoutId);
    }

    this.saleSuccessTimeoutId = setTimeout(() => {
      this.saleSuccessMessage.set('');
      this.saleToastVariant.set('success');
      this.saleSuccessTimeoutId = null;
    }, 3000);
  }

  private showInventorySuccess(message: string): void {
    this.inventorySuccessMessage.set(message);

    if (this.inventorySuccessTimeoutId !== null) {
      clearTimeout(this.inventorySuccessTimeoutId);
    }

    this.inventorySuccessTimeoutId = setTimeout(() => {
      this.inventorySuccessMessage.set('');
      this.inventorySuccessTimeoutId = null;
    }, 3000);
  }

  private saveActivePage(page: Page): void {
    try {
      localStorage.setItem(activePageStorageKey, page);
    } catch {
      return;
    }
  }

  private clearSession(): void {
    try {
      localStorage.removeItem(sessionStorageKey);
      localStorage.removeItem(activePageStorageKey);
    } catch {
      return;
    }
  }

  private restoreSavedActivePage(): Page {
    try {
      const savedPage = localStorage.getItem(activePageStorageKey) as Page | null;
      return savedPage && availablePages.includes(savedPage) ? savedPage : 'billing';
    } catch {
      return 'billing';
    }
  }

  private activatePage(page: Page, persist: boolean): void {
    this.activePage.set(page);

    if (persist) {
      this.saveActivePage(page);
    }

    this.loadPageData(page);
    this.scheduleVisibleChartsRefresh();
  }

  private loadPageData(page: Page): void {
    if (page === 'inventory-out-of-stock') {
      this.kardexPage.set(1);
    }

    if (page === 'dashboard') {
      void this.loadDashboardSalesSummary();
      void this.loadDashboardSalesTrend();
      void this.loadSalesDropAlert();
      void this.loadPurchases();
      void this.loadAttendanceUsers();
      void this.loadAuditHistory();
      return;
    }

    if (page === 'billing') {
      void this.loadExpiringProducts();
      void this.loadSalesDropAlert();
      void this.loadNextInvoiceNumber();
      return;
    }

    if (page === 'invoices') {
      void this.loadInvoicesPageData();
      void this.loadDashboardSalesTrend();
      return;
    }

    if (page === 'purchases') {
      this.purchasePage.set(1);
      void this.loadSuppliers();
      void this.loadPurchases();
      return;
    }

    if (page === 'credits') {
      void this.loadCredits();
      return;
    }

    if (page === 'costs') {
      this.costsPage.set(1);
      void this.loadPurchases();
      void this.loadCostIncreaseAlerts();
      void this.loadOperationalCosts();
      return;
    }

    if (page === 'history') {
      void this.loadAuditHistory();
      return;
    }

    if (page === 'attendance' || page === 'payroll' || page === 'payroll-generate') {
      void this.loadAttendanceUsers();
    }
  }

  private mapAttendanceUser(user: AttendanceUsersResponse['users'][number]): AttendanceUser {
    const history = (user.history || [])
      .filter((record) => Boolean(record.date))
      .map((record) => ({
        id: record.id,
        date: new Date(record.date || ''),
        weekNumber: Number(record.weekNumber || 0),
        entryTime: record.entryTime || '',
        exitTime: record.exitTime || '',
        attendanceStatus: this.formatAttendanceStatus(record.status),
        workedHours: Number(record.workedHours || 0),
      }))
      .filter((record) => !Number.isNaN(record.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    const latestHistory = history[0];
    const resolvedStatus =
      this.formatAttendanceStatus(user.status) === 'Sin registro' && latestHistory
        ? latestHistory.attendanceStatus
        : this.formatAttendanceStatus(user.status);

    return {
      id: user.id,
      name: user.nombre,
      username: user.usuario,
      role: user.rol,
      area: this.resolveAttendanceArea(user.rol),
      date: user.date ? new Date(user.date) : null,
      entryTime: user.entryTime || '',
      exitTime: user.exitTime || '',
      hourlyRate: this.resolveHourlyRate(user.rol),
      attendanceStatus: resolvedStatus,
      workedHours: Number(user.workedHours || 0),
      weeklyHours: Number(user.weeklyHours || 0),
      attendanceDays: Number(user.attendanceDays || 0),
      history,
    };
  }

  private syncPayrollState(users: AttendanceUser[]): void {
    const availableWeeks = new Set<number>();

    for (const user of users) {
      for (const record of user.history) {
        if (record.weekNumber > 0) {
          availableWeeks.add(record.weekNumber);
        }
      }
    }

    const sortedWeeks = [...availableWeeks].sort((a, b) => b - a);
    const currentSelectedWeek = this.selectedAttendanceWeek();

    if (sortedWeeks.length === 0) {
      this.selectedAttendanceWeek.set(null);
    } else if (currentSelectedWeek === null || !availableWeeks.has(currentSelectedWeek)) {
      this.selectedAttendanceWeek.set(sortedWeeks[0]);
    }
    this.payrollBonuses.set(this.buildPayrollBonusesState(users, sortedWeeks));
    this.restoreGeneratedPayrollHoursForWeek(this.selectedAttendanceWeek(), users);
  }

  private buildPayrollWeekRow(existing?: PayrollHoursMatrix[number]): PayrollHoursMatrix[number] {
    return {
      monday: this.buildPayrollShiftRow(existing?.monday),
      tuesday: this.buildPayrollShiftRow(existing?.tuesday),
      wednesday: this.buildPayrollShiftRow(existing?.wednesday),
      thursday: this.buildPayrollShiftRow(existing?.thursday),
      friday: this.buildPayrollShiftRow(existing?.friday),
      saturday: this.buildPayrollShiftRow(existing?.saturday),
      sunday: this.buildPayrollShiftRow(existing?.sunday),
    };
  }

  private buildPayrollShiftRow(existing?: PayrollHoursMatrix[number][PayrollDayId]): PayrollHoursMatrix[number][PayrollDayId] {
    return {
      morning: Number(existing?.morning || 0),
      afternoon: Number(existing?.afternoon || 0),
      night: Number(existing?.night || 0),
    };
  }

  private resolveAttendanceArea(role: string): string {
    const normalizedRole = this.normalizeText(role);

    if (normalizedRole.includes('admin')) {
      return 'Administracion';
    }

    if (normalizedRole.includes('caja') || normalizedRole.includes('factur')) {
      return 'Ventas';
    }

    if (normalizedRole.includes('compr')) {
      return 'Compras';
    }

    if (normalizedRole.includes('bodega') || normalizedRole.includes('invent')) {
      return 'Bodega';
    }

    if (normalizedRole.includes('repart') || normalizedRole.includes('logist')) {
      return 'Logistica';
    }

    return 'Operaciones';
  }

  private resolveHourlyRate(role: string): number {
    const normalizedRole = this.normalizeText(role);

    if (normalizedRole.includes('admin')) {
      return 95;
    }

    if (normalizedRole.includes('caja') || normalizedRole.includes('factur')) {
      return 88;
    }

    if (normalizedRole.includes('compr')) {
      return 82;
    }

    if (normalizedRole.includes('bodega') || normalizedRole.includes('invent')) {
      return 80;
    }

    if (normalizedRole.includes('repart') || normalizedRole.includes('logist')) {
      return 78;
    }

    return 85;
  }

  private formatAttendanceStatus(status: string): string {
    const normalizedStatus = this.normalizeText(status).toUpperCase();

    if (normalizedStatus === 'TARDE') {
      return 'Tarde';
    }

    if (normalizedStatus === 'PUNTUAL') {
      return 'Puntual';
    }

    if (normalizedStatus === 'AUSENTE') {
      return 'Ausente';
    }

    if (normalizedStatus === 'PERMISO') {
      return 'Permiso';
    }

    if (normalizedStatus === 'VACACIONES') {
      return 'Vacaciones';
    }

    if (normalizedStatus === 'INCAPACIDAD') {
      return 'Incapacidad';
    }

    return 'Sin registro';
  }

  private getAttendanceWeekInfo(date: Date): { year: number; week: number } {
    const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return { year: value.getUTCFullYear(), week };
  }

  private currentAttendanceWeekKey(): string {
    const now = new Date();
    const weekInfo = this.getAttendanceWeekInfo(now);
    return `${weekInfo.year}-${String(weekInfo.week).padStart(2, '0')}`;
  }

  private attendanceWeekKeyForDate(date: Date): string {
    const weekInfo = this.getAttendanceWeekInfo(date);
    return `${weekInfo.year}-${String(weekInfo.week).padStart(2, '0')}`;
  }

  private latestAttendanceWeekGroup(userId: number): AttendanceWeekGroup | null {
    const group = this.attendanceUserGroups().find((item) => item.user.id === userId);
    const selectedWeek = this.selectedAttendanceWeek();

    if (!group) {
      return null;
    }

    return (
      group.weeks.find((week) => selectedWeek !== null && week.weekNumber === selectedWeek) ||
      group.weeks[0] ||
      null
    );
  }

  protected currentWeekHours(userId: number): number {
    return Number((this.latestAttendanceWeekGroup(userId)?.totalHours || 0).toFixed(2));
  }

  protected updateAttendanceWeek(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.setAttendanceWeek(Number.isFinite(value) && value > 0 ? value : null);
  }

  protected setAttendanceWeek(week: number | null): void {
    const nextWeek = week && week > 0 ? week : null;
    this.selectedAttendanceWeek.set(nextWeek);
    this.restoreGeneratedPayrollHoursForWeek(nextWeek);
  }

  protected selectedAttendanceWeekLabel(): string {
    const week = this.selectedAttendanceWeek();
    return week ? `Semana ${week}` : 'Sin semana';
  }

  protected latestAttendanceRecordForSelectedWeek(userId: number): AttendanceDayRecord | null {
    return this.latestAttendanceWeekGroup(userId)?.days[0] || null;
  }

  protected isAttendanceUserExpanded(userId: number): boolean {
    return this.attendanceExpandedUserIds().includes(userId);
  }

  protected toggleAttendanceUser(userId: number): void {
    this.attendanceExpandedUserIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  protected isAttendanceWeekExpanded(weekKey: string): boolean {
    return this.attendanceExpandedWeekKeys().includes(weekKey);
  }

  protected toggleAttendanceWeek(weekKey: string): void {
    this.attendanceExpandedWeekKeys.update((keys) =>
      keys.includes(weekKey) ? keys.filter((key) => key !== weekKey) : [...keys, weekKey],
    );
  }

  protected openAttendanceMarkModal(user: AttendanceUser): void {
    const latestRecord = user.history[0];
    this.attendanceMarkUserId.set(user.id);
    this.attendanceMarkDate.set(latestRecord ? latestRecord.date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    this.attendanceMarkEntryTime.set(latestRecord?.entryTime || '08:00');
    this.attendanceMarkExitTime.set(latestRecord?.exitTime || '17:00');
    this.attendanceMarkError.set('');
    this.attendanceMarkModalOpen.set(true);
  }

  protected closeAttendanceMarkModal(): void {
    this.attendanceMarkModalOpen.set(false);
    this.attendanceMarkSaving.set(false);
    this.attendanceMarkError.set('');
  }

  protected updateAttendanceMarkDate(event: Event): void {
    this.attendanceMarkDate.set((event.target as HTMLInputElement).value);
  }

  protected updateAttendanceMarkEntryTime(event: Event): void {
    this.attendanceMarkEntryTime.set((event.target as HTMLInputElement).value);
  }

  protected updateAttendanceMarkExitTime(event: Event): void {
    this.attendanceMarkExitTime.set((event.target as HTMLInputElement).value);
  }

  protected async saveAttendanceMark(): Promise<void> {
    const currentUser = this.currentUser();
    const employeeId = this.attendanceMarkUserId();

    if (!currentUser || !employeeId) {
      this.attendanceMarkError.set('Usuario requerido para guardar la marca.');
      return;
    }

    this.attendanceMarkSaving.set(true);
    this.attendanceMarkError.set('');

    try {
      const payload = {
        employeeId,
        date: this.attendanceMarkDate(),
        entryTime: this.attendanceMarkEntryTime(),
        exitTime: this.attendanceMarkExitTime(),
        recordedBy: currentUser.usuario,
      };
      const response = this.desktopApi?.saveAttendanceMark
        ? await this.desktopApi.saveAttendanceMark(payload)
        : await firstValueFrom(this.http.post<AttendanceMarkResponse>('/api/attendance/mark', payload));

      await this.loadAttendanceUsers();
      const savedDate = response.mark?.date ? new Date(response.mark.date) : new Date(this.attendanceMarkDate());
      const weekKey = `${employeeId}-${this.attendanceWeekKeyForDate(savedDate)}`;

      this.attendanceExpandedUserIds.update((ids) =>
        ids.includes(employeeId) ? ids : [...ids, employeeId],
      );
      this.attendanceExpandedWeekKeys.update((keys) =>
        keys.includes(weekKey) ? keys : [...keys, weekKey],
      );
      this.attendanceMarkModalOpen.set(false);
    } catch (error) {
      this.attendanceMarkError.set(this.extractErrorMessage(error, 'No se pudo guardar la marca de asistencia.'));
    } finally {
      this.attendanceMarkSaving.set(false);
    }
  }

  protected attendanceUserById(userId: number | null): AttendanceUser | null {
    if (!userId) {
      return null;
    }

    return this.attendanceUsers().find((user) => user.id === userId) || null;
  }

  protected attendanceCurrentWeekHistory(userId: number | null): AttendanceDayRecord[] {
    const user = this.attendanceUserById(userId);

    if (!user) {
      return [];
    }

    return this.latestAttendanceWeekGroup(user.id)?.days || [];
  }

  protected formatAttendanceDate(value: Date): string {
    return new Intl.DateTimeFormat('es-HN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(value);
  }

  protected workedHours(user: AttendanceUser): number {
    return this.currentWeekHours(user.id);
  }

  protected attendanceStatus(user: AttendanceUser): string {
    return this.latestAttendanceRecordForSelectedWeek(user.id)?.attendanceStatus || user.attendanceStatus;
  }

  protected isPayrollUserExpanded(userId: number): boolean {
    return this.payrollExpandedUserIds().includes(userId);
  }

  protected togglePayrollUser(userId: number): void {
    this.payrollExpandedUserIds.update((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId],
    );
  }

  protected isPayrollWeekExpanded(weekKey: string): boolean {
    return this.payrollExpandedWeekKeys().includes(weekKey);
  }

  protected togglePayrollWeek(weekKey: string): void {
    this.payrollExpandedWeekKeys.update((keys) =>
      keys.includes(weekKey) ? keys.filter((key) => key !== weekKey) : [...keys, weekKey],
    );
  }

  protected trendPointPosition(index: number, total: number): number {
    if (total <= 1) {
      return 50;
    }

    return 6 + (88 / (total - 1)) * index;
  }

  protected trendPointHeight(value: number, maxValue: number): number {
    return 88 - (Math.max(value, 0) / Math.max(maxValue, 1)) * 72;
  }

  protected updateAttendanceTime(
    userId: number,
    field: 'entryTime' | 'exitTime',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    this.attendanceUsers.update((users) =>
      users.map((user) => (user.id === userId ? { ...user, [field]: value } : user)),
    );
  }

  protected updateHourlyRate(userId: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.attendanceUsers.update((users) =>
      users.map((user) => (user.id === userId ? { ...user, hourlyRate: value } : user)),
    );
  }

  protected updatePayrollBonus(userId: number, weekNumber: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollBonuses.update((bonuses) => ({
      ...bonuses,
      [weekNumber]: {
        ...(bonuses[weekNumber] || {}),
        [userId]: value,
      },
    }));
  }

  protected updateGeneratedPayrollHours(
    userId: number,
    dayId: PayrollDayId,
    shiftId: PayrollShiftId,
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollHours.update((matrix) => ({
      ...matrix,
      [userId]: {
        ...this.buildPayrollWeekRow(matrix[userId]),
        [dayId]: {
          ...this.buildPayrollShiftRow(matrix[userId]?.[dayId]),
          [shiftId]: value,
        },
      },
    }));
  }

  protected userWeeklyShiftHours(userId: number, shiftId: PayrollShiftId): number {
    return this.payrollDays.reduce(
      (total, day) => total + (this.payrollHours()[userId]?.[day.id]?.[shiftId] || 0),
      0,
    );
  }

  protected userWeeklyGeneratedHours(userId: number): number {
    return this.payrollShifts.reduce(
      (total, shift) => total + this.userWeeklyShiftHours(userId, shift.id),
      0,
    );
  }

  protected userWeeklyGeneratedPay(userId: number): number {
    return this.payrollShifts.reduce(
      (total, shift) => total + this.userWeeklyShiftHours(userId, shift.id) * shift.rate,
      0,
    );
  }

  protected payrollBonusForWeek(userId: number, weekNumber: number): number {
    return Number((this.payrollBonuses()[weekNumber]?.[userId] ?? 0).toFixed(2));
  }

  private payrollBonusesStorageKey(week: number): string {
    return `${payrollBonusesStoragePrefix}-${week}`;
  }

  private payrollHoursStorageKey(week: number): string {
    return `${payrollHoursStoragePrefix}-${week}`;
  }

  private buildPayrollBonusesState(users: AttendanceUser[], weeks: number[]): PayrollBonusMatrix {
    const nextBonuses: PayrollBonusMatrix = {};

    for (const week of weeks) {
      const persistedBonuses = this.readPayrollBonusesFromStorage(week);
      nextBonuses[week] = {};

      for (const user of users) {
        nextBonuses[week][user.id] = persistedBonuses[user.id] ?? 0;
      }
    }

    return nextBonuses;
  }

  private restoreGeneratedPayrollHoursForWeek(week: number | null, users = this.attendanceUsers()): void {
    const nextMatrix: PayrollHoursMatrix = {};
    const persistedHours = week === null ? {} : this.readPayrollHoursFromStorage(week);

    for (const user of users) {
      nextMatrix[user.id] = this.buildPayrollWeekRow(persistedHours[user.id]);
    }

    this.payrollHours.set(nextMatrix);
  }

  private calculatePayrollDayLine(day: AttendanceDayRecord): PayrollDayLine {
    const weekNumber = day.weekNumber || this.getAttendanceWeekInfo(day.date).week;
    const dayIndex = this.isoWeekday(day.date);
    const entryDate = this.combineDateAndTime(day.date, day.entryTime);
    const exitDate = this.combineDateAndTime(day.date, day.exitTime);
    const totalWorkedHours =
      entryDate && exitDate && exitDate > entryDate
        ? Number(((exitDate.getTime() - entryDate.getTime()) / 3600000).toFixed(2))
        : Number((day.workedHours || 0).toFixed(2));

    let normalHours = 0;
    let extra1Hours = 0;
    let extra2Hours = 0;
    let extra3Hours = 0;

    if (entryDate && exitDate && exitDate > entryDate) {
      if (dayIndex >= 1 && dayIndex <= 5) {
        normalHours = this.overlapHours(day.date, day.entryTime, day.exitTime, 8, 16);
        extra1Hours = this.overlapHours(day.date, day.entryTime, day.exitTime, 16, 20);
        extra2Hours = this.overlapHours(day.date, day.entryTime, day.exitTime, 20, 22);
      } else if (dayIndex === 6) {
        normalHours = this.overlapHours(day.date, day.entryTime, day.exitTime, 8, 12);
        extra3Hours = this.overlapHours(day.date, day.entryTime, day.exitTime, 12, 22);
      } else if (dayIndex === 7) {
        extra3Hours = totalWorkedHours;
      }
    }

    const normalPay = Number((normalHours * payrollNormalRate).toFixed(2));
    const extra1Pay = Number((extra1Hours * payrollExtra1Rate).toFixed(2));
    const extra2Pay = Number((extra2Hours * payrollExtra3WeekdayRate).toFixed(2));
    const extra3Rate = payrollExtra3WeekendRate;
    const extra3Pay = Number((extra3Hours * extra3Rate).toFixed(2));

    return {
      id: `${day.id}-${weekNumber}`,
      date: day.date,
      weekNumber,
      dayName: this.payrollDayName(dayIndex),
      entryTime: day.entryTime,
      exitTime: day.exitTime,
      normalHours: Number(normalHours.toFixed(2)),
      extra1Hours: Number(extra1Hours.toFixed(2)),
      extra2Hours: Number(extra2Hours.toFixed(2)),
      extra3Hours: Number(extra3Hours.toFixed(2)),
      normalPay,
      extra1Pay,
      extra2Pay,
      extra3Pay,
      totalHours: Number((normalHours + extra1Hours + extra2Hours + extra3Hours).toFixed(2)),
      totalPay: Number((normalPay + extra1Pay + extra2Pay + extra3Pay).toFixed(2)),
    };
  }

  private overlapHours(date: Date, entryTime: string, exitTime: string, startHour: number, endHour: number): number {
    const entryDate = this.combineDateAndTime(date, entryTime);
    const exitDate = this.combineDateAndTime(date, exitTime);
    const rangeStart = this.combineDateAndTime(date, `${String(startHour).padStart(2, '0')}:00`);
    const rangeEnd = this.combineDateAndTime(date, `${String(endHour).padStart(2, '0')}:00`);

    if (!entryDate || !exitDate || !rangeStart || !rangeEnd || exitDate <= entryDate) {
      return 0;
    }

    const overlapStart = Math.max(entryDate.getTime(), rangeStart.getTime());
    const overlapEnd = Math.min(exitDate.getTime(), rangeEnd.getTime());

    if (overlapEnd <= overlapStart) {
      return 0;
    }

    return Number((((overlapEnd - overlapStart) / 3600000)).toFixed(2));
  }

  private combineDateAndTime(date: Date, timeValue: string): Date | null {
    const normalizedTime = (timeValue || '').trim();

    if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
      return null;
    }

    const [hoursText, minutesText] = normalizedTime.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0));
  }

  private isoWeekday(date: Date): number {
    const day = date.getUTCDay();
    return day === 0 ? 7 : day;
  }

  private payrollDayName(dayIndex: number): string {
    switch (dayIndex) {
      case 1:
        return 'Lunes';
      case 2:
        return 'Martes';
      case 3:
        return 'Miercoles';
      case 4:
        return 'Jueves';
      case 5:
        return 'Viernes';
      case 6:
        return 'Sabado';
      case 7:
        return 'Domingo';
      default:
        return 'Dia';
    }
  }

  private payrollTrendGrouping(date: Date, period: PayrollTrendPeriod): { key: string; label: string; sortValue: number } {
    if (period === 'month') {
      const year = date.getFullYear();
      const month = date.getMonth();

      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('es-HN', { month: 'short', year: 'numeric' }).format(date),
        sortValue: year * 100 + month,
      };
    }

    if (period === 'week') {
      const weekInfo = this.getAttendanceWeekInfo(date);
      return {
        key: `${weekInfo.year}-${String(weekInfo.week).padStart(2, '0')}`,
        label: `Sem ${weekInfo.week} ${weekInfo.year}`,
        sortValue: weekInfo.year * 100 + weekInfo.week,
      };
    }

    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      key: normalizedDate.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'short' }).format(date),
      sortValue: normalizedDate.getTime(),
    };
  }

  private readPayrollBonusesFromStorage(week: number): Record<number, number> {
    try {
      const raw = localStorage.getItem(this.payrollBonusesStorageKey(week));

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const bonuses: Record<number, number> = {};

      for (const [userIdText, value] of Object.entries(parsed || {})) {
        const userId = Number(userIdText);
        const amount = Number(value);

        if (Number.isFinite(userId) && userId > 0 && Number.isFinite(amount) && amount >= 0) {
          bonuses[userId] = Number(amount.toFixed(2));
        }
      }

      return bonuses;
    } catch {
      return {};
    }
  }

  private readPayrollHoursFromStorage(week: number): PayrollHoursMatrix {
    try {
      const raw = localStorage.getItem(this.payrollHoursStorageKey(week));

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, Partial<Record<PayrollDayId, Partial<Record<PayrollShiftId, unknown>>>>>;
      const matrix: PayrollHoursMatrix = {};

      for (const [userIdText, userWeek] of Object.entries(parsed || {})) {
        const userId = Number(userIdText);

        if (!Number.isFinite(userId) || userId <= 0) {
          continue;
        }

        const weekRow = this.buildPayrollWeekRow();

        for (const day of this.payrollDays) {
          for (const shift of this.payrollShifts) {
            const value = Number(userWeek?.[day.id]?.[shift.id] ?? 0);
            weekRow[day.id][shift.id] = Number.isFinite(value) && value >= 0 ? value : 0;
          }
        }

        matrix[userId] = weekRow;
      }

      return matrix;
    } catch {
      return {};
    }
  }

  protected toggleThemeMenu(): void {
    this.themeMenuOpen.update((isOpen) => !isOpen);
  }

  protected setTheme(themeId: ThemeId): void {
    this.activeThemeId.set(themeId);
    this.themeMenuOpen.set(false);

    try {
      localStorage.setItem('yahweh-rohi-theme', themeId);
    } catch {
      return;
    }
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.billingPage.set(1);
    this.inventoryPage.set(1);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO PERMITE LEER CODIGO DE BARRA DESDE EL BUSCADOR DE FACTURACION.
  // EL ESCANER ESCRIBE EL CODIGO EN EL INPUT Y NORMALMENTE ENVIA ENTER AL FINAL.
  // SI EL CODIGO COINCIDE EXACTAMENTE CON EL SKU/CODIGO DEL PRODUCTO, LO AGREGA AL CARRITO.
  protected handleBillingSearchEnter(event: Event): void {
    event.preventDefault();

    const input = event.target as HTMLInputElement;
    const code = input.value.trim().toLowerCase();

    if (!code) {
      return;
    }

    const exactProduct = this.products().find((product) => product.sku.trim().toLowerCase() === code);

    if (!exactProduct) {
      return;
    }

    this.addToCart(exactProduct.id);
    this.searchTerm.set('');
    input.value = '';
    this.billingPage.set(1);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
    this.billingPage.set(1);
    this.inventoryPage.set(1);
  }

  protected previousBillingPage(): void {
    this.billingPage.update((page) => Math.max(page - 1, 1));
  }

  protected nextBillingPage(): void {
    this.billingPage.update((page) => Math.min(page + 1, this.billingPageCount()));
  }

  protected previousCostsPage(): void {
    this.costsPage.update((page) => Math.max(page - 1, 1));
  }

  protected costMarginClass(margin: number): string {
    const marginPercent = Math.round(margin * 1000) / 10;

    if (marginPercent < 20) {
      return 'margin-value danger';
    }

    if (marginPercent >= 20 && marginPercent <= 30) {
      return 'margin-value success';
    }

    if (marginPercent > 30) {
      return 'margin-value info';
    }

    return 'margin-value neutral';
  }

  protected nextCostsPage(): void {
    this.costsPage.update((page) => Math.min(page + 1, this.costsPageCount()));
  }

  protected previousInventoryPage(): void {
    this.inventoryPage.update((page) => Math.max(page - 1, 1));
  }

  protected nextInventoryPage(): void {
    this.inventoryPage.update((page) => Math.min(page + 1, this.inventoryPageCount()));
  }

  protected previousKardexPage(): void {
    this.kardexPage.update((page) => Math.max(page - 1, 1));
  }

  protected nextKardexPage(): void {
    this.kardexPage.update((page) => Math.min(page + 1, this.kardexPageCount()));
  }

  protected previousInvoicePage(): void {
    this.invoicePage.update((page) => Math.max(page - 1, 1));
  }

  protected nextInvoicePage(): void {
    this.invoicePage.update((page) => Math.min(page + 1, this.invoicePageCount()));
  }

  protected previousPurchasePage(): void {
    this.purchasePage.update((page) => Math.max(page - 1, 1));
  }

  protected nextPurchasePage(): void {
    this.purchasePage.update((page) => Math.min(page + 1, this.purchasePageCount()));
  }

  protected stockStatus(product: Product): string {
    if (product.stock === 0) {
      return 'Agotado';
    }

    return product.stock <= product.minStock ? 'Stock bajo' : 'Disponible';
  }

  protected productProfitMargin(product: Product): number {
    if (product.salePrice <= 0) {
      return 0;
    }

    return (product.salePrice - product.unitCost) / product.salePrice;
  }

  protected updateInventoryNumberField(
    productId: number,
    field: 'stock' | 'minStock' | 'unitCost' | 'salePrice',
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.products.update((products) =>
      products.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        const updated = { ...product, [field]: value };
        return {
          ...updated,
          margin: this.productProfitMargin(updated),
        };
      }),
    );
  }

  protected adjustInventoryStock(productId: number, quantity: number): void {
    const product = this.products().find((item) => item.id === productId);
    if (!product) {
      return;
    }

    this.products.update((products) =>
      products.map((item) =>
        item.id === productId ? { ...item, stock: Math.max(item.stock + quantity, 0) } : item,
      ),
    );

    this.movements.update((items) => [
      {
        date: new Date(),
        type: quantity >= 0 ? 'Ajuste entrada' : 'Ajuste salida',
        detail: `${product.name} · ${Math.abs(quantity)} unidades`,
        total: Math.abs(quantity) * product.unitCost,
      },
      ...items,
    ]);
  }

  protected updateInventoryDraft(field: keyof InventoryDraft, event: Event): void {
    const input = event.target as HTMLInputElement;
    const numericFields = ['stock', 'minStock', 'maxStock', 'unitCost', 'salePrice'];
    const value = numericFields.includes(field)
      ? Math.max(Number(input.value) || 0, 0)
      : input.value;

    this.inventoryDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  protected openInventoryModal(): void {
    this.inventoryEditingProductId.set(null);
    const nextId = Math.max(...this.products().map((product) => product.id), 0) + 1;
    this.inventoryDraft.set({
      sku: `NVO-${String(nextId).padStart(3, '0')}`,
      name: '',
      imageUrl: '',
      category: 'Camisas',
      stock: 0,
      minStock: 5,
      maxStock: 0,
      unitCost: 0,
      salePrice: 0,
    });
    this.inventoryModalOpen.set(true);
  }

  protected openInventoryEditModal(productId: number): void {
    const product = this.products().find((item) => item.id === productId);

    if (!product) {
      return;
    }

    this.inventoryEditingProductId.set(productId);
    this.inventoryDraft.set({
      sku: product.sku,
      name: product.name,
      imageUrl: product.imageUrl || '',
      category: product.category,
      stock: product.stock,
      minStock: product.minStock,
      maxStock: product.maxStock || 0,
      unitCost: product.unitCost,
      salePrice: product.salePrice,
    });
    this.inventoryModalOpen.set(true);
  }

  protected closeInventoryModal(): void {
    this.inventoryModalOpen.set(false);
    this.inventoryEditingProductId.set(null);
  }

  protected async saveInventoryProduct(): Promise<void> {
    const draft = this.inventoryDraft();
    const name = draft.name.trim();
    const sku = draft.sku.trim();

    if (!name || !sku) {
      return;
    }

    const editingProductId = this.inventoryEditingProductId();

    if (editingProductId !== null) {
      await this.requestUpdateInventoryStock({
        productId: editingProductId,
        stock: draft.stock,
        minStock: draft.minStock,
        maxStock: draft.maxStock || null,
      });

      this.products.update((products) =>
        products.map((product) => {
          if (product.id !== editingProductId) {
            return product;
          }

          const updated: Product = {
            ...product,
            sku,
            name,
            imageUrl: draft.imageUrl.trim() || null,
            category: draft.category.trim() || 'General',
            stock: draft.stock,
            minStock: draft.minStock,
            maxStock: draft.maxStock || null,
            unitCost: draft.unitCost,
            salePrice: draft.salePrice,
          };

          return {
            ...updated,
            margin: this.productProfitMargin(updated),
          };
        }),
      );
      this.closeInventoryModal();
      this.showInventorySuccess('Cambio realizado correctamente.');
      return;
    }

    const nextId = Math.max(...this.products().map((product) => product.id)) + 1;
    const product: Product = {
      id: nextId,
      sku,
      name,
      imageUrl: draft.imageUrl.trim() || null,
      category: draft.category.trim() || 'General',
      stock: draft.stock,
      minStock: draft.minStock,
      maxStock: draft.maxStock || null,
      unitCost: draft.unitCost,
      salePrice: draft.salePrice,
      margin: draft.salePrice > 0 ? (draft.salePrice - draft.unitCost) / draft.salePrice : 0,
    };

    this.products.update((products) => [...products, product]);
    this.inventoryDraft.set({
      sku: `NVO-${String(nextId + 1).padStart(3, '0')}`,
      name: '',
      imageUrl: '',
      category: 'Camisas',
      stock: 0,
      minStock: 5,
      maxStock: 0,
      unitCost: 0,
      salePrice: 0,
    });
    this.closeInventoryModal();
    this.showInventorySuccess('Producto guardado correctamente.');
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO MANDA A GUARDAR LOS CAMBIOS DE STOCK DEL MODAL DE INVENTARIO.
  // SI USA API HTTP, LLAMA PUT /api/products/:productId/inventory UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.updateInventoryStockLevels() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO updateInventoryStockLevels() EN server/data-access.js,
  // DONDE ESTA UBICADA LA CONSULTA UPDATE dbo.inventario.
  private async requestUpdateInventoryStock(payload: {
    productId: number;
    stock: number;
    minStock: number;
    maxStock: number | null;
  }): Promise<InventoryStockUpdateResponse> {
    if (this.desktopApi) {
      return this.desktopApi.updateInventoryStockLevels(payload);
    }

    return firstValueFrom(
      this.http.put<InventoryStockUpdateResponse>(`/api/products/${payload.productId}/inventory`, payload),
    );
  }

  protected addToCart(productId: number): void {
    const product = this.products().find((item) => item.id === productId);
    if (!product) {
      return;
    }

    if (this.activeMode() === 'sale' && Number(product.stock || 0) <= 0) {
      this.showSaleSuccess('El articulo esta en cero y no puede ser facturado.', 'error');
      return;
    }

    this.cart.update((lines) => {
      const existing = lines.find((line) => line.productId === productId);
      if (existing) {
        return lines.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [...lines, { productId, quantity: 1 }];
    });

    if (this.activeMode() === 'purchase') {
      this.purchaseCosts.update((costs) => ({
        ...costs,
        [productId]: costs[productId] ?? product.unitCost,
      }));
    }
  }

  protected updatePurchaseCost(productId: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    this.purchaseCosts.update((costs) => ({ ...costs, [productId]: value }));
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO SE EJECUTA AL CAMBIAR LA FORMA DE PAGO EN EL FORMULARIO DE VENTA.
  // SI LA FORMA DE PAGO ES CREDITO, EXIGE SELECCIONAR UN CLIENTE ANTES DE GENERAR LA VENTA.
  protected selectPaymentMethod(paymentMethod: PaymentMethod): void {
    this.selectedPaymentMethod.set(paymentMethod);

    if (paymentMethod === 'credito' && !this.selectedCustomerId()) {
      this.checkoutError.set('Selecciona un cliente para registrar una venta al credito.');
      this.openCustomerModal();
      return;
    }

    if (paymentMethod !== 'credito') {
      if (!this.selectedCustomerId()) {
        this.selectedCustomer.set('Cliente final');
      }

      this.checkoutError.set('');
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GUARDA EL ID Y NOMBRE DEL CLIENTE SELECCIONADO EN EL MODAL.
  // EL ID_CLIENTE SE ENVIA LUEGO EN persistSale() PARA INSERTARSE EN LA TABLA DE PAGO CORRECTA.
  protected selectCustomer(customer: CustomerOption): void {
    this.selectedCustomer.set(customer.nombre + (customer.apellido ? ' ' + customer.apellido : ''));
    this.selectedCustomerId.set(customer.id);
    this.checkoutError.set('');
    this.customerModalOpen.set(false);
  }

  protected openCustomerModal(): void {
    this.customerModalOpen.set(true);
    void this.loadCustomers();
  }

  protected closeCustomerModal(): void {
    this.customerModalOpen.set(false);
  }

  protected selectSupplier(supplierName: string): void {
    this.selectedSupplier.set(supplierName);
    this.supplierModalOpen.set(false);
  }

  protected openSupplierModal(): void {
    this.supplierModalOpen.set(true);
    void this.loadSuppliers();
  }

  protected closeSupplierModal(): void {
    this.supplierModalOpen.set(false);
  }

  protected decreaseQuantity(productId: number): void {
    this.cart.update((lines) =>
      lines
        .map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity - 1 } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  protected removeFromCart(productId: number): void {
    this.cart.update((lines) => lines.filter((line) => line.productId !== productId));
    this.purchaseCosts.update((costs) => {
      const remaining = { ...costs };
      delete remaining[productId];
      return remaining;
    });
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO VALIDA SI LA OPERACION ES COMPRA O VENTA ANTES DE FINALIZAR.
  // EN VENTA MANDA A LLAMAR persistSale(), QUE TERMINA EJECUTANDO LA INSERCION EN SQL SERVER.
  protected completeTransaction(): void {
    if (this.cart().length === 0) {
      this.showSaleSuccess(
        'No se puede realizar la venta por que no existe un producto facturado.',
        'error',
      );
      return;
    }

    if (this.activeMode() === 'purchase') {
      this.receivePurchase();
      this.cart.set([]);
      this.purchaseCosts.set({});
      this.selectedSupplier.set('');
      return;
    }

    void this.persistSale();
  }

  protected resetCart(): void {
    this.cart.set([]);
    this.purchaseCosts.set({});
    this.selectedPaymentMethod.set('efectivo');
    this.selectedCustomer.set('Cliente final');
    this.selectedCustomerId.set(null);
    this.selectedSupplier.set('');
  }

  private receivePurchase(): void {
    const now = new Date();
    const history: PriceHistory[] = [];

    this.products.update((products) =>
      products.map((product) => {
        const line = this.cart().find((item) => item.productId === product.id);
        if (!line) {
          return product;
        }

        const previousCost = product.unitCost;
        const previousPrice = product.salePrice;
        const purchaseCost = this.purchaseCosts()[product.id] ?? product.unitCost;
        const totalUnits = product.stock + line.quantity;
        const weightedCost =
          totalUnits === 0
            ? product.unitCost
            : (product.stock * product.unitCost + line.quantity * purchaseCost) / totalUnits;
        const newPrice = Math.ceil((weightedCost / (1 - product.margin)) / 5) * 5;

        if (previousCost !== weightedCost || previousPrice !== newPrice) {
          history.push({
            product: product.name,
            user: this.currentUser()?.nombre || 'Sistema',
            date: now,
            previousCost,
            newCost: weightedCost,
            previousPrice,
            newPrice,
            reason: 'Compra recibida y precio sugerido recalculado',
          });
        }

        return {
          ...product,
          stock: totalUnits,
          unitCost: weightedCost,
          salePrice: newPrice,
        };
      }),
    );

    this.history.update((items) => [...history, ...items].slice(0, 8));
    this.movements.update((items) => [
      {
        date: now,
        type: 'Compra',
        detail: `Entrada de ${this.cart().length} productos`,
        total: this.cartTotal(),
      },
      ...items,
    ]);
  }

  private registerSale(): void {
    const now = new Date();

    this.products.update((products) =>
      products.map((product) => {
        const line = this.cart().find((item) => item.productId === product.id);
        return line ? { ...product, stock: Math.max(product.stock - line.quantity, 0) } : product;
      }),
    );

    this.movements.update((items) => [
      {
        date: now,
        type: 'Venta',
        detail: `Salida de ${this.cart().length} productos`,
        total: this.cartTotal(),
      },
      ...items,
    ]);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO VALIDA Y PREPARA LA VENTA ANTES DE MANDARLA A LA BASE DE DATOS.
  // OBLIGA A SELECCIONAR CLIENTE SOLO CUANDO LA FORMA DE PAGO ES CREDITO.
  // TAMBIEN ENVIA ID_TP E ID_CLIENTE PARA QUE registerSale() LOS GUARDE EN LA TABLA DE PAGO CORRECTA.
  // requestCreateSale() ESTA UBICADO EN src/app/app.ts Y MANDA LA PETICION A /api/sales O A ELECTRON.
  // LA CONSULTA FINAL A SQL SERVER ESTA UBICADA EN server/data-access.js, PROCEDIMIENTO registerSale().
  // registerSale() VALIDA ID_TP Y GUARDA EN VENTA_EFECTIVO, VENTA_CREDITO O VENTA_TRANSFERENCIA.
  private async persistSale(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      this.checkoutError.set('No hay un usuario autenticado para registrar la venta.');
      return;
    }

    const paymentTypeId = this.selectedPaymentTypeId();

    if (paymentTypeId === 2 && !this.selectedCustomerId()) {
      this.checkoutError.set('Selecciona un cliente para registrar una venta al credito.');
      this.openCustomerModal();
      return;
    }

    this.checkoutLoading.set(true);
    this.checkoutError.set('');

    try {
      const lines = this.cartDetails().map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        unitCost: line.product.unitCost,
        salePrice: line.product.salePrice,
      }));

      await this.requestCreateSale({
        user: currentUser.usuario,
        userId: currentUser.id,
        paymentTypeId,
        customerId: this.selectedCustomerId(),
        lines,
      });

      this.registerSale();
      this.cart.set([]);
      this.purchaseCosts.set({});
      this.selectedPaymentMethod.set('efectivo');
      this.selectedCustomer.set('Cliente final');
      this.selectedCustomerId.set(null);
      this.selectedSupplier.set('');
      await this.fetchProducts();
      await this.loadNextInvoiceNumber();
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      this.showSaleSuccess('Venta realizada correctamente.');
      this.checkoutLoading.set(false);
    } catch (error) {
      this.checkoutError.set(this.extractErrorMessage(error, 'No se pudo registrar la venta.'));
      this.checkoutLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO MANDA LA VENTA AL BACKEND LOCAL O AL DRIVER DE ELECTRON.
  // SI USA API HTTP, LLAMA POST /api/sales UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.createSale() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO registerSale() EN server/data-access.js,
  // DONDE ESTA UBICADA LA CONSULTA INSERT INTO VENTA_EFECTIVO, VENTA_CREDITO O VENTA_TRANSFERENCIA.
  private async requestCreateSale(payload: {
    user: string;
    userId: number;
    paymentTypeId: number;
    customerId: number | null;
    lines: Array<{
      productId: number;
      quantity: number;
      unitCost: number;
      salePrice: number;
    }>;
  }): Promise<SaleResponse> {
    if (this.desktopApi) {
      return this.desktopApi.createSale(payload);
    }

    return firstValueFrom(this.http.post<SaleResponse>('/api/sales', payload));
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CONVIERTE LA FORMA DE PAGO SELECCIONADA AL ID_TP DE dbo.TIPO_PAGO.
  // EL VALOR SE USA EN persistSale() Y SE INSERTA EN LA TABLA DE PAGO CORRECTA DESDE registerSale().
  private selectedPaymentTypeId(): number {
    return this.paymentMethodOptions.find((paymentMethod) => paymentMethod.id === this.selectedPaymentMethod())?.paymentTypeId || 1;
  }

  private updateSalesTrendChart(): void {
    if (!this.salesTrendCanvas) {
      return;
    }

    if (!this.salesTrendChart) {
      this.salesTrendChart = this.createSalesTrendChart(this.salesTrendCanvas.nativeElement, true);
    }

    if (!this.salesTrendChart) {
      return;
    }

    this.updateTrendChartData(this.salesTrendChart);
  }

  private updateVisibleCharts(): void {
    const page = this.activePage();

    if (page === 'dashboard') {
      this.updateSalesTrendChart();
      this.updatePurchasesTrendChart();
      this.updateDashboardModuleCharts();
      return;
    }

    if (page === 'invoices') {
      this.updateInvoicesSalesTrendChart();
      return;
    }

    if (page === 'purchases') {
      this.updatePurchasesTrendChart();
      return;
    }

    if (page === 'payroll') {
      this.updatePayrollTrendChart();
      return;
    }

    if (page === 'costs') {
      this.updateCostsDistributionChart();
      this.updateCostsEvolutionChart();
      this.updateCostsCategoryChart();
      return;
    }

    if (page === 'history') {
      this.updateAuditUserTrendChart();
    }
  }

  private scheduleVisibleChartsRefresh(): void {
    queueMicrotask(() => {
      this.updateVisibleCharts();
      requestAnimationFrame(() => {
        this.updateVisibleCharts();
        setTimeout(() => this.updateVisibleCharts(), 0);
      });
    });
  }

  private updateInvoicesSalesTrendChart(): void {
    if (!this.invoicesSalesTrendCanvas) {
      return;
    }

    if (!this.invoicesSalesTrendChart) {
      this.invoicesSalesTrendChart = this.createSalesTrendChart(this.invoicesSalesTrendCanvas.nativeElement);
    }

    if (!this.invoicesSalesTrendChart) {
      return;
    }

    this.updateTrendChartData(this.invoicesSalesTrendChart);
  }

  private updatePayrollTrendChart(): void {
    if (!this.payrollTrendCanvas) {
      return;
    }

    if (!this.payrollTrendChart) {
      this.payrollTrendChart = this.createPayrollTrendChart(this.payrollTrendCanvas.nativeElement);
    }

    const trendSeries = this.payrollTrendChartSeries();
    const chartPalette = this.chartLinePalette();
    this.payrollTrendChart.data.labels = trendSeries.labels;
    this.payrollTrendChart.data.datasets = trendSeries.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: chartPalette[index]?.border || '#e879f9',
      backgroundColor: chartPalette[index]?.background || 'rgb(232 121 249 / 14%)',
      borderWidth: 2.4,
      pointBackgroundColor: chartPalette[index]?.border || '#e879f9',
      pointBorderColor: '#0f172a',
      pointHoverRadius: 6,
      pointRadius: 4,
      tension: 0.38,
    }));
    this.payrollTrendChart.resize();
    this.payrollTrendChart.update();
  }

  private updatePurchasesTrendChart(): void {
    if (!this.purchasesTrendCanvas) {
      return;
    }

    if (!this.purchasesTrendChart) {
      this.purchasesTrendChart = this.createPurchasesTrendChart(this.purchasesTrendCanvas.nativeElement);
    }

    const purchasesTrendData = this.purchasesTrendData();
    const [lineStyle] = this.chartLinePalette();
    this.purchasesTrendChart.data.labels = purchasesTrendData.map((item) => item.label);
    this.purchasesTrendChart.data.datasets[0].borderColor = lineStyle.border;
    this.purchasesTrendChart.data.datasets[0].backgroundColor = lineStyle.background;
    this.purchasesTrendChart.data.datasets[0].pointBackgroundColor = lineStyle.border;
    this.purchasesTrendChart.data.datasets[0].data = purchasesTrendData.map((item) => item.value);
    this.purchasesTrendChart.resize();
    this.purchasesTrendChart.update();
  }

  private updateCostsDistributionChart(): void {
    if (!this.costsDistributionCanvas) {
      return;
    }

    if (!this.costsDistributionChart) {
      this.costsDistributionChart = this.createCostsDistributionChart(this.costsDistributionCanvas.nativeElement);
    }

    const series = this.costDistributionSeries();
    this.costsDistributionChart.data.labels = series.map((item) => item.label);
    this.costsDistributionChart.data.datasets[0].data = series.map((item) => item.value);
    this.costsDistributionChart.data.datasets[0].backgroundColor = this.isBlackGreenTheme()
      ? ['#8bd34f', '#66b63f', '#b5ea73', '#4f8f35']
      : series.map((item) => item.color);
    this.costsDistributionChart.resize();
    this.costsDistributionChart.update();
  }

  private updateCostsEvolutionChart(): void {
    if (!this.costsEvolutionCanvas) {
      return;
    }

    if (!this.costsEvolutionChart) {
      this.costsEvolutionChart = this.createCostsEvolutionChart(this.costsEvolutionCanvas.nativeElement);
    }

    const trend = this.costMonthlyTrend();
    const [lineStyle] = this.chartLinePalette();
    this.costsEvolutionChart.data.labels = trend.map((item) => item.label);
    this.costsEvolutionChart.data.datasets[0].borderColor = lineStyle.border;
    this.costsEvolutionChart.data.datasets[0].backgroundColor = lineStyle.background;
    this.costsEvolutionChart.data.datasets[0].pointBackgroundColor = lineStyle.border;
    this.costsEvolutionChart.data.datasets[0].data = trend.map((item) => item.total);
    this.costsEvolutionChart.resize();
    this.costsEvolutionChart.update();
  }

  private updateCostsCategoryChart(): void {
    if (!this.costsCategoryCanvas) {
      return;
    }

    if (!this.costsCategoryChart) {
      this.costsCategoryChart = this.createCostsCategoryChart(this.costsCategoryCanvas.nativeElement);
    }

    const series = this.costCategoryComparisonSeries();
    const categoryPalette = this.chartLinePalette();
    this.costsCategoryChart.data.labels = series.map((item) => item.category);
    this.costsCategoryChart.data.datasets[0].backgroundColor = this.isBlackGreenTheme() ? '#66b63f' : 'rgb(34 197 94 / 84%)';
    this.costsCategoryChart.data.datasets[1].borderColor = categoryPalette[1]?.border || '#60a5fa';
    this.costsCategoryChart.data.datasets[1].backgroundColor = categoryPalette[1]?.background || 'rgb(96 165 250 / 18%)';
    this.costsCategoryChart.data.datasets[0].data = series.map((item) => item.costTotal);
    this.costsCategoryChart.data.datasets[1].data = series.map((item) => item.saleTotal);
    this.costsCategoryChart.resize();
    this.costsCategoryChart.update();
  }

  private updateAuditUserTrendChart(): void {
    if (!this.auditUserTrendCanvas) {
      return;
    }

    if (!this.auditUserTrendChart) {
      this.auditUserTrendChart = this.createAuditUserTrendChart(this.auditUserTrendCanvas.nativeElement);
    }

    const series = this.auditUserTrendSeries();
    const palette = this.chartLinePalette();

    this.auditUserTrendChart.data.labels = series.labels;
    this.auditUserTrendChart.data.datasets = series.datasets.map((dataset, index) => {
      const { border: borderColor, background: backgroundColor } = palette[index] || palette[0];

      return {
        label: dataset.label,
        data: dataset.data,
        borderColor,
        backgroundColor,
        borderWidth: 2.6,
        fill: false,
        pointBackgroundColor: borderColor,
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
      };
    });
    this.auditUserTrendChart.resize();
    this.auditUserTrendChart.update();
  }

  private updateDashboardModuleCharts(): void {
    this.updateDashboardPayrollChart();
    this.updateDashboardAttendanceChart();
    this.updateDashboardInventoryChart();
    this.updateDashboardCostsChart();
    this.updateDashboardHistoryChart();
  }

  private updateDashboardPayrollChart(): void {
    if (!this.dashboardPayrollChartCanvas) {
      return;
    }

    if (!this.dashboardPayrollChart) {
      this.dashboardPayrollChart = this.createDashboardBarChart(
        this.dashboardPayrollChartCanvas.nativeElement,
        'Pago',
        true,
      );
    }

    const rows = this.dashboardPayrollChartRows();
    this.dashboardPayrollChart.data.labels = rows.map((row) => row.label);
    this.dashboardPayrollChart.data.datasets[0].data = rows.map((row) => row.value);
    this.dashboardPayrollChart.update();
    this.dashboardPayrollChart.resize();
  }

  private updateDashboardAttendanceChart(): void {
    if (!this.dashboardAttendanceChartCanvas) {
      return;
    }

    if (!this.dashboardAttendanceChart) {
      this.dashboardAttendanceChart = this.createDashboardPieChart(
        this.dashboardAttendanceChartCanvas.nativeElement,
        false,
      );
    }

    const rows = this.dashboardAttendanceChartRows();
    this.dashboardAttendanceChart.data.labels = rows.map((row) => row.label);
    this.dashboardAttendanceChart.data.datasets[0].data = rows.map((row) => row.value);
    this.dashboardAttendanceChart.update();
    this.dashboardAttendanceChart.resize();
  }

  private updateDashboardInventoryChart(): void {
    if (!this.dashboardInventoryChartCanvas) {
      return;
    }

    if (!this.dashboardInventoryChart) {
      this.dashboardInventoryChart = this.createDashboardInventoryTrendChart(
        this.dashboardInventoryChartCanvas.nativeElement,
      );
    }

    const rows = this.dashboardInventoryChartRows();
    this.dashboardInventoryChart.data.labels = rows.map((row) => row.label);
    this.dashboardInventoryChart.data.datasets[0].data = rows.map((row) => row.value);
    this.dashboardInventoryChart.update();
    this.dashboardInventoryChart.resize();
  }

  private updateDashboardCostsChart(): void {
    if (!this.dashboardCostsChartCanvas) {
      return;
    }

    if (!this.dashboardCostsChart) {
      this.dashboardCostsChart = this.createDashboardBarChart(
        this.dashboardCostsChartCanvas.nativeElement,
        'Costo',
        true,
      );
    }

    const rows = this.dashboardCostChartRows();
    this.dashboardCostsChart.data.labels = rows.map((row) => row.label);
    this.dashboardCostsChart.data.datasets[0].data = rows.map((row) => row.value);
    this.dashboardCostsChart.update();
    this.dashboardCostsChart.resize();
  }

  private updateDashboardHistoryChart(): void {
    if (!this.dashboardHistoryChartCanvas) {
      return;
    }

    if (!this.dashboardHistoryChart) {
      this.dashboardHistoryChart = this.createDashboardHistoryTrendChart(this.dashboardHistoryChartCanvas.nativeElement);
    }

    const series = this.auditUserTrendSeries();
    const palette = this.chartLinePalette();
    this.dashboardHistoryChart.data.labels = series.labels;
    this.dashboardHistoryChart.data.datasets = series.datasets.map((dataset, index) => {
      const style = palette[index] || palette[0];

      return {
        label: dataset.label,
        data: dataset.data,
        borderColor: style.border,
        backgroundColor: style.background,
        borderWidth: 2.2,
        fill: false,
        pointBackgroundColor: style.border,
        pointBorderColor: '#0f172a',
        pointHoverRadius: 5,
        pointRadius: 3,
        tension: 0.38,
      };
    });
    this.dashboardHistoryChart.update();
    this.dashboardHistoryChart.resize();
  }

  private updateTrendChartData(chart: Chart<'line', number[], string>): void {
    const trendData = this.salesTrendData();
    const palette = this.chartLinePalette();
    chart.data.labels = trendData.map((item) => item.label);
    chart.data.datasets.forEach((dataset, index) => {
      const style = palette[index];

      if (!style) {
        return;
      }

      dataset.borderColor = style.border;
      dataset.backgroundColor = style.background;
      dataset.pointBackgroundColor = style.border;
    });
    chart.data.datasets[0].data = trendData.map((item) => item.efectivo);
    chart.data.datasets[1].data = trendData.map((item) => item.credito);
    chart.data.datasets[2].data = trendData.map((item) => item.transferencia);
    chart.resize();
    chart.update();
  }

  private isBlackGreenTheme(): boolean {
    return this.activeThemeId() === 'black-green';
  }

  private chartLinePalette(): Array<{ border: string; background: string }> {
    if (this.isBlackGreenTheme()) {
      return [
        { border: '#8bd34f', background: 'rgb(139 211 79 / 10%)' },
        { border: '#66b63f', background: 'rgb(102 182 63 / 8%)' },
        { border: '#b5ea73', background: 'rgb(181 234 115 / 8%)' },
        { border: '#4f8f35', background: 'rgb(79 143 53 / 8%)' },
        { border: '#d4f49a', background: 'rgb(212 244 154 / 7%)' },
      ];
    }

    return [
      { border: '#14b8a6', background: 'rgb(20 184 166 / 14%)' },
      { border: '#3b82f6', background: 'rgb(59 130 246 / 14%)' },
      { border: '#f97316', background: 'rgb(249 115 22 / 14%)' },
      { border: '#a855f7', background: 'rgb(168 85 247 / 12%)' },
      { border: '#22c55e', background: 'rgb(34 197 94 / 12%)' },
    ];
  }

  private createSalesTrendChart(canvas: HTMLCanvasElement, shaded = false): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Efectivo',
            data: [],
            borderColor: '#56d4ff',
            backgroundColor: 'rgb(86 212 255 / 12%)',
            borderWidth: 2.4,
            pointBackgroundColor: '#56d4ff',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.42,
            fill: shaded ? 'origin' : false,
          },
          {
            label: 'Credito',
            data: [],
            borderColor: '#b96bff',
            backgroundColor: 'rgb(185 107 255 / 10%)',
            borderDash: [5, 5],
            borderWidth: 2.4,
            pointBackgroundColor: '#b96bff',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.42,
            fill: shaded ? 'origin' : false,
          },
          {
            label: 'Transferencia',
            data: [],
            borderColor: '#66b63f',
            backgroundColor: 'rgb(107 112 98 / 5%)',
            borderDash: [10, 4],
            borderWidth: 2.4,
            pointBackgroundColor: '#66b63f',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.42,
            fill: shaded ? 'origin' : false,
          },
        ],
      },
      options: {
        animation: {
          duration: 450,
        },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            align: 'end',
            labels: {
              boxHeight: 3,
              boxWidth: 28,
              color: 'rgb(203 213 225 / 70%)',
              font: {
                size: 11,
                weight: 800,
              },
              usePointStyle: false,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const valueLine = `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`;
                const category = String(context.label || '');
                const seriesItem = this.costCategoryComparisonSeries().find((item) => item.category === category);

                if (!seriesItem || seriesItem.saleTotal <= 0) {
                  return [valueLine, 'Utilidad: 0.0%'];
                }

                const margin = (seriesItem.saleTotal - seriesItem.costTotal) / seriesItem.saleTotal;
                return [valueLine, `Utilidad: ${new Intl.NumberFormat('es-HN', {
                  style: 'percent',
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(margin)}`];
              },
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 12%)',
            },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: {
                size: 10,
                weight: 800,
              },
            },
          },
          y: {
            beginAtZero: true,
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 18%)',
            },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: {
                size: 10,
                weight: 800,
              },
            },
          },
        },
      },
    });
  }

  private createDashboardBarChart(
    canvas: HTMLCanvasElement,
    label: string,
    currencyValues: boolean,
  ): Chart<'bar', number[], string> {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label,
            data: [],
            backgroundColor: this.isBlackGreenTheme() ? '#66b63f' : 'rgb(34 197 94 / 84%)',
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 30,
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const value = Number(context.raw || 0);
                return `${context.dataset.label}: ${currencyValues ? this.formatCurrency(value) : this.formatNumber(value)}`;
              },
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'rgb(203 213 225 / 60%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 14%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => currencyValues ? this.formatCompactCurrency(Number(value)) : this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
              precision: currencyValues ? undefined : 0,
            },
          },
        },
      },
    });
  }

  private createDashboardPieChart(
    canvas: HTMLCanvasElement,
    currencyValues: boolean,
  ): Chart<'pie', number[], string> {
    return new Chart(canvas, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: this.isBlackGreenTheme()
              ? ['#8bd34f', '#66b63f', '#b5ea73', '#4f8f35']
              : ['#22c55e', '#14b8a6', '#84cc16', '#0ea5e9'],
            borderColor: 'rgb(15 23 42 / 18%)',
            borderWidth: 2,
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              color: 'rgb(203 213 225 / 74%)',
              font: { size: 10, weight: 800 },
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const value = Number(context.raw || 0);
                return `${context.label}: ${currencyValues ? this.formatCurrency(value) : this.formatNumber(value)}`;
              },
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
      },
    });
  }

  private createDashboardHistoryTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        animation: { duration: 420 },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxHeight: 3,
              boxWidth: 22,
              color: 'rgb(203 213 225 / 72%)',
              font: { size: 10, weight: 800 },
            },
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatNumber(Number(context.raw || 0))} movimientos`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: 'rgb(148 163 184 / 10%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 14%)' },
            ticks: {
              precision: 0,
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
            },
          },
        },
      },
    });
  }

  private createDashboardInventoryTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Productos',
            data: [],
            borderColor: this.isBlackGreenTheme() ? '#8bd34f' : '#22c55e',
            backgroundColor: this.isBlackGreenTheme() ? 'rgb(139 211 79 / 14%)' : 'rgb(34 197 94 / 14%)',
            borderWidth: 2.6,
            fill: true,
            pointBackgroundColor: this.isBlackGreenTheme() ? '#8bd34f' : '#22c55e',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.38,
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `Productos: ${this.formatNumber(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: 'rgb(148 163 184 / 10%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 14%)' },
            ticks: {
              precision: 0,
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
            },
          },
        },
      },
    });
  }

  private createPayrollTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        animation: {
          duration: 450,
        },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            align: 'end',
            labels: {
              boxHeight: 3,
              boxWidth: 28,
              color: 'rgb(203 213 225 / 70%)',
              font: {
                size: 11,
                weight: 800,
              },
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 12%)',
              drawTicks: false,
            },
            ticks: {
              color: 'rgb(203 213 225 / 72%)',
              font: {
                size: 11,
                weight: 700,
              },
            },
          },
          y: {
            beginAtZero: true,
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 10%)',
            },
            ticks: {
              color: 'rgb(203 213 225 / 72%)',
              callback: (value) => this.formatCompactCurrency(Number(value)),
              font: {
                size: 11,
                weight: 700,
              },
            },
          },
        },
      },
    });
  }

  private createPurchasesTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Compras',
            data: [],
            borderColor: '#8bd34f',
            backgroundColor: 'rgb(216 216 199 / 5%)',
            borderWidth: 2.6,
            fill: true,
            pointBackgroundColor: '#8bd34f',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.42,
          },
        ],
      },
      options: {
        animation: {
          duration: 450,
        },
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        interaction: {
          intersect: false,
          mode: 'index',
        },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            align: 'end',
            labels: {
              boxHeight: 3,
              boxWidth: 28,
              color: 'rgb(203 213 225 / 70%)',
              font: {
                size: 11,
                weight: 800,
              },
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 12%)',
            },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: {
                size: 10,
                weight: 800,
              },
            },
          },
          y: {
            beginAtZero: true,
            border: {
              color: 'rgb(148 163 184 / 24%)',
            },
            grid: {
              color: 'rgb(148 163 184 / 18%)',
            },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: {
                size: 10,
                weight: 800,
              },
            },
          },
        },
      },
    });
  }

  private createCostsDistributionChart(canvas: HTMLCanvasElement): Chart<'pie', number[], string> {
    return new Chart(canvas, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: ['#8bd34f', '#66b63f'],
            borderColor: 'rgb(15 23 42 / 18%)',
            borderWidth: 2,
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgb(203 213 225 / 74%)',
              font: { size: 11, weight: 800 },
              padding: 14,
            },
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.label}: ${this.formatCurrency(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
      },
    });
  }

  private createCostsEvolutionChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Gasto',
            data: [],
            borderColor: '#f97316',
            backgroundColor: 'rgb(249 115 22 / 16%)',
            borderWidth: 2.6,
            fill: true,
            pointBackgroundColor: '#fb923c',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            tension: 0.42,
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `Gasto: ${this.formatCurrency(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: 'rgb(148 163 184 / 12%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 18%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
            },
          },
        },
      },
    });
  }

  private createAuditUserTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        animation: { duration: 420 },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgb(203 213 225 / 74%)',
              font: { size: 11, weight: 800 },
              padding: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatNumber(Number(context.raw || 0))} movimientos`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { color: 'rgb(148 163 184 / 12%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 18%)' },
            ticks: {
              precision: 0,
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
            },
          },
        },
      },
    });
  }

  private createCostsCategoryChart(canvas: HTMLCanvasElement): Chart<'bar' | 'line', number[], string> {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            type: 'bar',
            label: 'Costo',
            data: [],
            backgroundColor: '#66b63f',
            borderRadius: 10,
            borderSkipped: false,
            maxBarThickness: 34,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Valor venta',
            data: [],
            borderColor: '#60a5fa',
            backgroundColor: 'rgb(96 165 250 / 18%)',
            pointBackgroundColor: '#93c5fd',
            pointBorderColor: '#0f172a',
            pointHoverRadius: 6,
            pointRadius: 4,
            borderWidth: 2.6,
            tension: 0.42,
            fill: true,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        animation: { duration: 420 },
        maintainAspectRatio: false,
        plugins: {
          legend: {
            align: 'end',
            labels: {
              boxHeight: 3,
              boxWidth: 28,
              color: 'rgb(203 213 225 / 70%)',
              font: { size: 11, weight: 800 },
              usePointStyle: false,
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 92%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`,
            },
            padding: 12,
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
          },
        },
        responsive: true,
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 18%)' },
            ticks: {
              color: 'rgb(203 213 225 / 56%)',
              callback: (value) => this.formatNumber(Number(value)),
              font: { size: 10, weight: 800 },
            },
          },
        },
      },
    });
  }

  private buildTrendPolyline(items: DashboardTrendItem[], maxValue: number): string {
    return items
      .map((item, index) => {
        const x = this.trendPointPosition(index, items.length);
        const y = this.trendPointHeight(item.value, maxValue);
        return `${x},${y}`;
      })
      .join(' ');
  }

  private buildSalesTrendPath(seriesKey: SalesTrendSeriesKey): string {
    const items = this.salesTrendData();
    const maxValue = this.maxSalesTrendValue();
    const points = items.map((item, index) => ({
      x: this.trendPointPosition(index, items.length),
      y: this.trendPointHeight(item[seriesKey], maxValue),
    }));

    if (points.length === 0) {
      return '';
    }

    if (points.length === 1) {
      return `M ${points[0].x},${points[0].y} L ${points[0].x + 0.1},${points[0].y}`;
    }

    return points.slice(1).reduce((path, point, index) => {
      const previousPoint = points[index];
      const controlX = (previousPoint.x + point.x) / 2;
      return `${path} C ${controlX},${previousPoint.y} ${controlX},${point.y} ${point.x},${point.y}`;
    }, `M ${points[0].x},${points[0].y}`);
  }
}
