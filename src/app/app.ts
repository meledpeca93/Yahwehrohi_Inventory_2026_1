import { NgTemplateOutlet, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { LucideBan, LucideDownload, LucideEye, LucideFileText, LucideRotateCcw, LucideSearch, LucideSettings } from '@lucide/angular';
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
import { DatePickerComponent } from './features/shared/date-picker/date-picker.component';
import { ProductImageComponent } from './features/shared/product-image/product-image.component';
import { ModalTableState, ModalTableConfig } from './features/shared/modal-table/modal-table-state';
import { FacturacionApiService } from './modules/facturacion/services/facturacion-api.service';

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
  | 'financial-movements'
  | 'petty-cash'
  | 'sales-profitability'
  | 'system-health'
  | 'history'
  | 'inventory-sheet'
  | 'inventory-out-of-stock'
  | 'attendance'
  | 'payroll'
  | 'payroll-generate';
type InventoryTableKind = 'main' | 'inactive' | 'kardex' | 'offers' | 'barcodes' | 'components' | 'picker';
interface InventoryColumnOption { key: string; label: string; visible: boolean; }

type AuditHistorySortKey = 'date' | 'action' | 'table' | 'record' | 'user' | 'previousStock' | 'currentStock';
type AuditHistorySortDirection = 'asc' | 'desc';
type AuditHistoryAlignment = 'left' | 'center' | 'right';
type ThemeId =
  | 'black-green'
  | 'forest-light'
  | 'steel-light'
  | 'ember-dark'
  | 'emerald-dark'
  | 'analytics-dark'
  | 'crm-dark'
  | 'combo-mono'
  | 'soft-blue'
  | 'deep-onyx'
  | 'monaco-orange'
  | 'uniform-yellow'
  | 'red-combo'
  | 'coral-black';

interface ThemeOption {
  id: ThemeId;
  name: string;
  tone: string;
}

type SettingsTabId =
  | 'appearance'
  | 'menu'
  | 'tables'
  | 'dashboard'
  | 'billing'
  | 'inventory'
  | 'profitability'
  | 'notifications'
  | 'backup'
  | 'system';
type SystemFontId =
  | 'inter'
  | 'segoe'
  | 'aptos'
  | 'arial'
  | 'calibri'
  | 'verdana'
  | 'trebuchet'
  | 'tahoma'
  | 'georgia'
  | 'times'
  | 'cambria'
  | 'consolas'
  | 'courier';
type InterfaceDensity = 'compact' | 'normal' | 'comfortable';

interface SettingsTab {
  id: SettingsTabId;
  label: string;
}

interface SystemFontOption {
  id: SystemFontId;
  label: string;
  value: string;
}

interface Product {
  id: number;
  sku: string;
  barcodes?: ProductBarcode[];
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
  allowsDecimalQuantity?: boolean;
  supplier?: string | null;
  previousMonthSales?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryLotNumber?: string | null;
  primaryLotExpiryDate?: string | null;
  activeLotCount?: number;
  activeLotNumbers?: string[];
  margin: number;
  isAssembledOffer?: boolean;
  offerId?: number;
  offerStatus?: string;
  offerStartsAt?: string | null;
  offerEndsAt?: string | null;
  offerComponents?: AssembledOfferComponent[];
}

interface ProductBarcode {
  id: number;
  productId: number;
  code: string;
  isPrimary: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AssembledOfferComponent {
  productId: number;
  detailId?: number;
  sku?: string;
  name?: string;
  quantity: number;
  isGift: boolean;
  stock?: number;
  unitCost?: number;
  salePrice?: number;
  referencePrice?: number;
  productActive?: boolean;
}

interface AssembledOffer {
  id: number;
  virtualProductId: number;
  sku: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  salePrice: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  status: string;
  stock: number;
  visibilityReason?: string;
  createdAt?: string | null;
  components: AssembledOfferComponent[];
}

interface AssembledOfferDraft {
  code: string;
  name: string;
  description: string;
  imageUrl: string;
  salePrice: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  components: Array<{
    productId: number | null;
    quantity: string;
    isGift: boolean;
  }>;
}

interface InactiveProduct extends Product {
  deactivatedAt?: string | null;
}

interface ProductReactivationDraft {
  nuevoCosto: string;
  nuevoPrecioVenta: string;
  stockReingreso: string;
}

type InventoryOperationalStatus = 'Todos' | 'Disponible' | 'Stock bajo' | 'Agotado';
type InventoryExpiryFilter = 'Todos' | 'Vigente' | 'Vence pronto' | 'Vencido' | 'Sin fecha';

interface ProductInventoryLot {
  id: number;
  lotNumber: string;
  initialQuantity: number;
  availableQuantity: number;
  unitCost: number;
  entryDate: string | null;
  expiryDate: string | null;
  status: string;
  sourceDocument: string | null;
  createdAt: string | null;
}

interface ProductInventoryMovement {
  id: number;
  date: string | null;
  document: string;
  movementType: string;
  entry: number;
  exit: number;
  unitCost: number;
  userName: string;
}

interface ProductInventoryDetail {
  product: Product;
  lots: ProductInventoryLot[];
  movements: ProductInventoryMovement[];
}

type InventoryMovementSection = 'entries' | 'exits';
type InventoryMovementSummaryMode = 'daily' | 'weekly' | 'monthly' | 'annual';
type InventoryDetailTab = 'photo' | 'orders' | 'changes' | 'exits' | 'entries';

interface InventoryMovementPeriodSummary {
  key: string;
  label: string;
  quantity: number;
  movements: number;
  lastDate: string | null;
  months?: InventoryMovementPeriodSummary[];
}

interface InventoryStockCoverage {
  label: string;
  basis: string;
  dailyAverage: number;
  projectedDays: number | null;
  level: 'good' | 'warning' | 'critical' | 'neutral';
}

interface ProfitabilityKpi {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  variation: number;
  comparison: string;
}

interface ProfitabilityChartPoint {
  label: string;
  value: number;
  sales?: number;
  utility?: number;
  cost?: number;
}

interface ProfitabilityProductRow {
  productId: number;
  productName: string;
  category: string;
  quantity?: number;
  sales?: number;
  utility?: number;
  salePrice?: number;
  cost?: number;
  margin?: number;
  stock?: number;
  supplier?: string;
}

interface ProfitabilityCustomerRow {
  customerId: number;
  customerName: string;
  invoices: number;
  sales: number;
  utility: number;
  firstSale?: string | null;
  lastSale?: string | null;
}

interface ProfitabilityKardexRow {
  id: number;
  date: string | null;
  document: string;
  movementType: string;
  productId: number;
  productName: string;
  category: string;
  entrada: number;
  salida: number;
  existencia: number;
  unitCost: number;
  averageCost: number;
  userName: string;
  warehouse: string;
}

interface ProfitabilityAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

interface SalesProfitabilityAnalytics {
  generatedAt: string;
  selectedPeriod: {
    year: number;
    month: number;
    key: string;
  };
  availableMonths: Array<{
    year: number;
    month: number;
    key: string;
    label: string;
    movements: number;
  }>;
  kpis: ProfitabilityKpi[];
  profitability: {
    income: number;
    costOfSales: number;
    grossProfit: number;
    operationalExpenses: number;
    netProfit: number;
    netMargin: number;
    generalProfitability: string;
    status: { label: string; level: 'excellent' | 'good' | 'regular' | 'critical' };
    monthlySalesVariation: number;
    monthlyUtilityVariation: number;
  };
  charts: {
    salesByHour: ProfitabilityChartPoint[];
    salesLast30Days: ProfitabilityChartPoint[];
    salesByWeekLast12Months: ProfitabilityChartPoint[];
    salesByMonthLast5Years: ProfitabilityChartPoint[];
    monthComparison: ProfitabilityChartPoint[];
    utilityComparison: ProfitabilityChartPoint[];
    annualComparison: ProfitabilityChartPoint[];
  };
  products: {
    topSold: ProfitabilityProductRow[];
    topProfitable: ProfitabilityProductRow[];
    lowProfitability: ProfitabilityProductRow[];
    noMovement: ProfitabilityProductRow[];
    losses: ProfitabilityProductRow[];
  };
  customers: {
    topRevenue: ProfitabilityCustomerRow[];
    topProfit: ProfitabilityCustomerRow[];
    inactive: ProfitabilityCustomerRow[];
    newCustomers: ProfitabilityCustomerRow[];
    recurrent: ProfitabilityCustomerRow[];
  };
  kardex: {
    summary: {
      currentStock: number;
      inventoryCost: number;
      inventoryValue: number;
      potentialProfit: number;
    };
    rows: ProfitabilityKardexRow[];
  };
  alerts: ProfitabilityAlert[];
  reports: string[];
}

interface SystemHealthResponse {
  generatedAt: string;
  environment?: {
    databaseName: string;
    serverName: string;
    dbResponseMs: number;
    nodeVersion: string;
    platform: string;
    appPath: string;
    disk: {
      availableBytes: number | null;
      totalBytes: number | null;
      availablePercent: number | null;
    };
  };
  summary: {
    oldCodes: number;
    activeNewCodes: number;
    missingCodes: number;
    activeExtraCodes: number;
    duplicateProductCodes: number;
    duplicateInventoryCodes: number;
    stockMismatches: number;
    negativeStock: number;
    productsWithoutInventory: number;
    inventoryWithoutProduct: number;
    productRows?: number;
    activeProductRows?: number;
    inventoryRows?: number;
    inactiveProductsWithStock?: number;
    productsWithImage?: number;
    brokenProductImages?: number;
    expiringProducts?: number;
    latestInvoiceNumber?: number;
    invoicesToday?: number;
    annulledInvoices7d?: number;
    invoicesWithoutLines?: number;
    saleLinesWithoutInvoice?: number;
    salesLinesToday?: number;
    salesTotalToday?: number;
    newCodesMonth: number;
    removedOrDisabledCodesMonth: number;
  };
  checks: Array<{
    title: string;
    severity: string;
    affected: number;
  }>;
  tableRows?: Array<{
    name: string;
    rows: number;
  }>;
  brokenImages?: Array<{
    productId: number;
    sku: string;
    name: string;
    imageUrl: string;
    resolvedPath: string | null;
  }>;
  monthlyChanges: Array<{
    action: string;
    total: number;
  }>;
  recentChanges: Array<{
    action: string;
    sku: string;
    officialProductId: number | null;
    affectedProductId: number | null;
    previousStock: number | null;
    newStock: number | null;
    detail: string;
    createdAt: string | null;
  }>;
}

interface DatabaseBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string;
  maxBackups: number;
  backupDir: string;
  lastAutomaticRunKey?: string;
}

interface DatabaseBackupRow {
  id: string;
  createdAt: string | null;
  type: 'Automático' | 'Manual' | 'Pre-Restauración' | 'Restauración' | string;
  status: 'Correcto' | 'Error' | string;
  fileName: string;
  filePath: string;
  size: number;
  message: string;
  userId: number | null;
  user: string;
  protected: boolean;
}

interface DatabaseBackupsResponse {
  config: DatabaseBackupConfig;
  backups: DatabaseBackupRow[];
  latest: DatabaseBackupRow | null;
}

interface DatabaseBackupValidationResponse {
  ok: boolean;
  fileName: string;
  filePath: string;
  size: number;
  freeBytes: number | null;
  databaseName: string | null;
  compatible: boolean;
}

interface InventoryDraft {
  sku: string;
  name: string;
  imageUrl: string;
  category: string;
  primaryLotExpiryDate: string;
  stock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  profitPercentage: number;
  salePrice: number;
  unitMeasure: string;
  allowsDecimalQuantity: boolean;
}

interface CartLine {
  productId: number;
  quantity: number;
}

interface BillingInvoiceSession {
  id: string;
  title: string;
  cart: CartLine[];
  purchaseCosts: Record<number, number>;
  salePrices: Record<number, number>;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerId: number | null;
  receivedAmount: string;
  quoteId: number | null;
  quoteNumber: string;
  createdAt: string;
}

interface OrderCsvLine {
  productName: string;
  productCode: string;
  quantity: number;
  salePrice: number | null;
}

interface OrderCsvData {
  customerName: string;
  paymentMethod: PaymentMethod | null;
  lines: OrderCsvLine[];
}

interface OrderCsvReviewLine {
  id: string;
  product: Product | null;
  productName: string;
  productCode: string;
  quantity: number;
  salePrice: number;
  subtotal: number;
  status: 'ready' | 'out-of-stock' | 'insufficient-stock' | 'missing' | 'invalid';
  issue: string;
}

interface OrderInvoiceSession {
  id: string;
  title: string;
  customerName: string;
  customerId: number | null;
  paymentMethod: PaymentMethod;
  fileName: string;
  lines: OrderCsvReviewLine[];
  receivedAmount: string;
  error: string;
  saving: boolean;
  createdAt: string;
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

interface AuditDataPart {
  key: string;
  value: string;
  raw: string;
}

interface ActivityNotification {
  id: number;
  action: string;
  detail: string;
  user: string;
  createdAt: string | null;
}

interface PriceChangeAlert {
  id: number;
  productId: number | null;
  productName: string;
  imageUrl: string | null;
  previousPrice: number;
  newPrice: number;
  changedAt: string;
  user: string;
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
  utilityTotal?: number;
  quantity?: number;
}

interface CostDistributionPoint {
  label: string;
  value: number;
  color: string;
}

type CostAnalysisPeriod = 'week' | 'month' | 'year';

interface CostProductMovementRow {
  productId: number;
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  sales: number;
  cost: number;
  utility: number;
  margin: number;
  monthlyRotation: number;
  stock: number;
}

interface CostChangedProductRow {
  productId: number;
  productName: string;
  category: string;
  previousCost: number;
  currentCost: number;
  difference: number;
  variation: number;
  lastDate: string | null;
}

interface AuditUserTrendDataset {
  label: string;
  data: number[];
}

interface AuditUserTrendSeries {
  labels: string[];
  datasets: AuditUserTrendDataset[];
}

interface PayrollTrendDataset {
  label: string;
  data: number[];
}

interface PayrollTrendSeries {
  labels: string[];
  datasets: PayrollTrendDataset[];
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
type CreditPaymentMethod = 'efectivo' | 'transferencia';
type CreditTrendPeriod = 'day' | 'week' | 'month';
type CreditHistoryTrendPeriod = 'week' | 'month' | 'year';
type CreditViewMode = 'customer' | 'day';
type PurchaseMainViewMode = 'list' | 'supplier' | 'day';
type FinancialMovementType = 'entrada' | 'salida';
type FinancialPaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta_credito';
type FinancialMovementTarget = 'corte_dia' | 'caja_chica' | 'cuenta_bancaria' | 'tarjeta_credito';
type SalesTrendPeriod = 'day' | 'week' | 'month' | 'year';
type PurchaseTrendPeriod = SalesTrendPeriod;
type PayrollTrendPeriod = 'day' | 'week' | 'month' | 'year';
type PettyCashTrendPeriod = 'day' | 'week' | 'month';
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
  paymentTypeId: number;
  statusId: number | null;
  statusName: string;
  userName: string;
  createdAt: string | null;
  total: number;
  quantity: number;
  lines: PurchaseHistoryRow[];
}

interface PurchasePaymentGroup {
  key: string;
  label: string;
  paymentTypeId: number;
  invoices: PurchaseInvoiceGroup[];
  total: number;
  quantity: number;
}

interface PurchaseDayGroup {
  key: string;
  label: string;
  invoices: PurchaseInvoiceGroup[];
  paymentGroups: PurchasePaymentGroup[];
  total: number;
  quantity: number;
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
  invoicePaymentMethod: string;
  total: number;
  paidAmount: number;
  pendingAmount: number;
}

interface CreditPaymentAllocationResponse {
  customerId: number;
  amount: number;
  paymentMethod: CreditPaymentMethod;
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

interface PettyCashRow {
  id: string;
  date: string;
  userName: string;
  initialAmount: number;
  finalAmount: number;
  turnBilling: number;
  cashToPetty: number;
  registerBalance: number;
  changeWallet: number;
  pettyCashTotal: number;
  fourteenthReserve: number;
  dividendReserve: number;
  totalReserve: number;
  cashOut: number;
  reason: string;
  realCashTotal: number;
  comments: string;
  statusName: string;
  source: 'cut' | 'manual' | 'base';
}

interface PettyCashTrendPoint {
  key: string;
  label: string;
  cashToPetty: number;
  reserves: number;
  netPettyCash: number;
}

interface PettyCashDraft {
  date: string;
  initialAmount: number;
  finalAmount: number;
  turnBilling: number;
  cashToPetty: number;
  registerBalance: number;
  changeWallet: number;
  pettyCashTotal: number;
  cashOut: number;
  reason: string;
  realCashTotal: number;
  comments: string;
  dividendBenefit: number;
  fourteenthBonus: number;
}

interface FinancialMovement {
  id: number;
  date: string;
  movementType: FinancialMovementType;
  paymentMethod: FinancialPaymentMethod;
  target: FinancialMovementTarget;
  category: string;
  description: string;
  amount: number;
  bankAccount: string;
  creditCard: string;
  cutId: number | null;
  pettyCashId: number | null;
  status: string;
  userId: number | null;
  userName: string;
  createdAt: string | null;
  annulledAt: string | null;
  annulledByUserId: number | null;
}

interface FinancialMovementsResponse {
  year: number;
  month: number;
  movements: FinancialMovement[];
}

interface FinancialMovementDraft {
  date: string;
  movementType: FinancialMovementType;
  paymentMethod: FinancialPaymentMethod;
  target: FinancialMovementTarget;
  category: string;
  description: string;
  amount: string;
  bankAccount: string;
  creditCard: string;
}

interface FinancialPaymentGroup {
  key: string;
  label: string;
  paymentMethod: FinancialPaymentMethod;
  movements: FinancialMovement[];
  total: number;
  count: number;
}

interface FinancialMovementTypeGroup {
  key: string;
  label: string;
  movementType: FinancialMovementType;
  movements: FinancialMovement[];
  paymentGroups: FinancialPaymentGroup[];
  total: number;
  count: number;
}

interface FinancialDayGroup {
  key: string;
  label: string;
  movements: FinancialMovement[];
  movementGroups: FinancialMovementTypeGroup[];
  entriesTotal: number;
  outputsTotal: number;
  netTotal: number;
  count: number;
}

interface CreditPayment {
  id: number;
  description: string;
  amount: number;
  paymentMethod: CreditPaymentMethod;
  customerId: number;
  customerName: string;
  invoiceId: number;
  userId: number;
  userName: string;
  createdAt: string;
}

interface CreditPaymentVoucher {
  id: number | null;
  description: string;
  amount: number;
  paymentMethod: CreditPaymentMethod;
  customerId: number;
  customerName: string;
  invoiceId: number | null;
  userId: number;
  userName: string;
  createdAt: string;
  previousBalance: number;
  currentBalance: number;
  appliedAmount: number;
  remainingAmount: number;
  invoicesTouched: number;
  linesTouched: number;
  paymentsCreated: number;
  allocations: CreditPaymentAllocationResponse['allocations'];
}

interface CreditPaymentPeriodGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  payments: CreditPayment[];
}

interface CreditPaymentYearGroup extends CreditPaymentPeriodGroup {
  months: CreditPaymentPeriodGroup[];
}

interface GeneralCreditPaymentCustomerGroup {
  key: string;
  customerId: number;
  customerName: string;
  total: number;
  count: number;
  payments: CreditPayment[];
}

interface GeneralCreditPaymentDayGroup {
  key: string;
  label: string;
  total: number;
  count: number;
  customerCount: number;
  payments: CreditPayment[];
  customers: GeneralCreditPaymentCustomerGroup[];
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

interface InvoicePaymentGroup {
  key: string;
  label: string;
  paymentTypeId: number;
  invoices: InvoiceRow[];
  total: number;
  itemCount: number;
}

interface InvoiceDayGroup {
  key: string;
  label: string;
  invoices: InvoiceRow[];
  paymentGroups: InvoicePaymentGroup[];
  total: number;
  itemCount: number;
}

interface InvoiceMonthlySalesRow {
  key: string;
  label: string;
  invoiceCount: number;
  itemCount: number;
  cashTotal: number;
  creditTotal: number;
  transferTotal: number;
  total: number;
}

interface CreditInvoiceGroup {
  invoiceId: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  openCredits: number;
  customerBalance: number;
  saleStatusName: string;
  invoicePaymentMethod: string;
  total: number;
  originalTotal: number;
  paidAmount: number;
  pendingAmount: number;
  utility: number;
  createdAt: string | null;
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

interface CreditDayGroup {
  key: string;
  label: string;
  customerCount: number;
  articleCount: number;
  total: number;
  utility: number;
  invoices: CreditInvoiceGroup[];
  customers: CreditCustomerGroup[];
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

interface PayrollMonthLine {
  key: string;
  label: string;
  weeks: PayrollWeekLine[];
  subtotalPay: number;
  bonus: number;
  grandTotal: number;
  totalHours: number;
  sortValue: number;
}

interface PayrollWeekEditDraftDay {
  id: string;
  date: string;
  dayName: string;
  normalHours: number;
  extra1Hours: number;
  extra2Hours: number;
  extra3Hours: number;
}

interface PayrollWeekEditDraft {
  userId: number;
  userName: string;
  weekNumber: number;
  weekLabel: string;
  bonus: number;
  days: PayrollWeekEditDraftDay[];
}

interface PayrollPlanEditWeekOption {
  weekNumber: number;
  label: string;
  employeeCount: number;
  totalHours: number;
  salary: number;
  bonus: number;
  total: number;
}

interface PayrollPlanEditEmployee {
  userId: number;
  userName: string;
  userRole: string;
  weekNumber: number;
  weekLabel: string;
  bonus: number;
  days: PayrollWeekEditDraftDay[];
}

interface PayrollPlanEditDraft {
  weekNumber: number;
  weekLabel: string;
  employees: PayrollPlanEditEmployee[];
}

interface PayrollWeekEditTotals {
  normalHours: number;
  extra1Hours: number;
  extra2Hours: number;
  extra3Hours: number;
  totalHours: number;
  normalPay: number;
  extra1Pay: number;
  extra2Pay: number;
  extra3Pay: number;
  salary: number;
  bonus: number;
  total: number;
}

interface PayrollTopEarnerLine {
  user: AttendanceUser;
  hours: number;
  pay: number;
}

interface PayrollScopedLine {
  user: AttendanceUser;
  week: PayrollWeekLine;
  days: PayrollDayLine[];
  subtotalPay: number;
  bonus: number;
  grandTotal: number;
  totalHours: number;
}

interface PayrollTrendDataset {
  label: string;
  data: number[];
}

interface PayrollDatabaseRecord {
  id: number;
  userId: number;
  userName: string;
  userLogin: string;
  userRole: string;
  day: string;
  normalHours: number;
  extra1Hours: number;
  extra2Hours: number;
  extra3Hours: number;
  normalPay: number;
  extra1Pay: number;
  extra2Pay: number;
  extra3Pay: number;
  totalHours: number;
  salary: number;
  bonus: number;
  total: number;
  createdAt: string;
  weekNumber: number;
  createdByUserId: number;
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

interface ProductCreateResponse {
  product: Omit<Product, 'margin'> & { margin?: number };
}

interface ProductBarcodesResponse {
  productId?: number;
  sku?: string;
  barcodes: ProductBarcode[];
}

interface InactiveProductsResponse {
  products: Array<Omit<InactiveProduct, 'margin'> & { margin?: number }>;
}

interface ProductReactivationResponse {
  productId: number;
  previousCost: number;
  newCost: number;
  previousSalePrice: number;
  newSalePrice: number;
  previousStock: number;
  newStock: number;
  movementType: string;
  product: Omit<Product, 'margin'> & { margin?: number };
}

interface ProductInventoryDetailResponse {
  product: Omit<Product, 'margin' | 'previousMonthSales' | 'primaryLotNumber' | 'primaryLotExpiryDate' | 'activeLotCount' | 'activeLotNumbers'>;
  lots: ProductInventoryLot[];
  movements: ProductInventoryMovement[];
}

interface UsersResponse {
  users: LoginUserOption[];
}

interface PayrollRecordsResponse {
  records: PayrollDatabaseRecord[];
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
  lotNumber: string | null;
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

interface PettyCashManualRecord {
  id: number;
  date: string;
  initialAmount: number;
  finalAmount: number;
  turnBilling: number;
  cashToPetty: number;
  registerBalance: number;
  changeWallet: number;
  pettyCashTotal: number;
  cashOut: number;
  reason: string;
  realCashTotal: number;
  comments: string;
  dividendBenefit: number;
  fourteenthBonus: number;
  userId: number | null;
  userName: string;
  createdAt: string | null;
}

interface PettyCashRecordsResponse {
  records: PettyCashManualRecord[];
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
  updatedProducts?: Array<{
    productId: number;
    stock: number;
  }>;
}

interface QuoteRow {
  id: number;
  number: string;
  customerId: number | null;
  customerName: string;
  paymentTypeId: number;
  subtotal: number;
  estimatedUtility: number;
  status: string;
  invoiceId: number | null;
  userName: string;
  userId: number | null;
  note: string;
  createdAt: string | null;
  updatedAt: string | null;
  linesCount: number;
}

interface QuoteLine {
  id: number;
  quoteId: number;
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  salePrice: number;
  utility: number;
  total: number;
}

interface QuotesResponse {
  quotes: QuoteRow[];
}

interface QuoteDetailsResponse {
  quote: QuoteRow;
  lines: QuoteLine[];
}

interface PurchaseDraftLine {
  productId: number;
  quantity: number;
  unitCost: number;
  lotNumber?: string;
  expiryDate?: string | null;
}

interface PurchaseWorkspaceDraft {
  expectedDate?: string;
  id: string;
  supplierId: number | null;
  invoice: string;
  date: string;
  paymentTypeId: number;
  transport: number;
  other: number;
  lines: PurchaseDraftLine[];
  stage: 'prepare' | 'receive' | 'review';
  updatedAt: string;
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

interface QuickInventoryPurchaseResponse extends PurchaseResponse {
  productId: number;
  productName: string;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
}

interface QuickInventoryReductionResponse {
  productId: number;
  productName: string;
  quantity: number;
  reason: string;
  previousStock: number;
  newStock: number;
  unitCost: number;
  savedAt: string;
}

interface AnnulPurchaseResponse {
  invoiceNumber: string;
  purchaseTable: string;
  annulledLines: number;
  discountedQuantity: number;
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
  sku: string;
  name: string;
  imageUrl: string | null;
  category: string;
  stock: number;
  minStock: number;
  maxStock: number | null;
  primaryLotExpiryDate: string | null;
  unitCost: number;
  salePrice: number;
  unitMeasure: string;
  allowsDecimalQuantity: boolean;
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
type PayrollScheduleMatrix = Record<number, Record<PayrollDayId, PayrollScheduleDay>>;

interface PayrollScheduleDay {
  enabled: boolean;
  entryTime: string;
  exitTime: string;
}

interface PayrollGeneratedLine {
  user: AttendanceUser;
  scheduledHours: number;
  attendanceHours: number;
  differenceHours: number;
  pay: number;
}

interface PayrollGeneratedDayLine {
  day: PayrollDay;
  date: Date;
  scheduledHours: number;
  attendanceHours: number;
  pay: number;
}

interface PayrollWeekMatrixLine {
  user: AttendanceUser | null;
  employeeName: string;
  days: Array<{
    day: PayrollDay;
    date: Date;
    normalHours: number;
    extra1Hours: number;
    extra2Hours: number;
    extra3Hours: number;
  }>;
  normalHours: number;
  extra1Hours: number;
  extra2Hours: number;
  extra3Hours: number;
  normalPay: number;
  extra1Pay: number;
  extra2Pay: number;
  extra3Pay: number;
  totalHours: number;
  salary: number;
  bonus: number;
  total: number;
}

interface ImagePayrollSourceRow {
  name: string;
  aliases?: string[];
  bonus: number;
  days: Record<PayrollDayId, { normal: number; extra1: number; extra2: number; extra3: number }>;
}

type ImagePayrollEditableRows = Record<string, ImagePayrollSourceRow['days']>;

interface ImagePayrollSourceWeek {
  year: number;
  weekNumber: number;
  label: string;
  rows: ImagePayrollSourceRow[];
}

interface ImagePayrollWeekCard extends ImagePayrollSourceWeek {
  matrixRows: PayrollWeekMatrixLine[];
  total: number;
}

const sessionStorageKey = 'yahweh-rohi-session-user';
const activePageStorageKey = 'yahweh-rohi-active-page';
const defaultThemeMigrationStorageKey = 'yahweh-rohi-black-green-default-applied';
const payrollBonusesStoragePrefix = 'yahweh-rohi-payroll-bonuses';
const payrollHoursStoragePrefix = 'yahweh-rohi-payroll-hours';
const payrollScheduleStorageKey = 'yahweh-rohi-payroll-schedules';
const imagePayrollWeeks = [
  {
    year: 2026,
    weekNumber: 20,
    label: '10/05/2026 - 16/05/2026',
    rows: [
      {
        name: 'Seydi Pena',
        bonus: 78.5,
        days: {
          sunday: { normal: 9, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 8, extra1: 4, extra2: 0.5, extra3: 0 },
          tuesday: { normal: 8, extra1: 1.5, extra2: 0, extra3: 0 },
          wednesday: { normal: 8, extra1: 4, extra2: 2, extra3: 0 },
          thursday: { normal: 8, extra1: 4, extra2: 2, extra3: 0 },
          friday: { normal: 8, extra1: 4, extra2: 1, extra3: 0 },
          saturday: { normal: 4, extra1: 1, extra2: 0, extra3: 0 },
        },
      },
      {
        name: 'Melvin E. Pena',
        bonus: 20,
        days: {
          sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 2, extra2: 1, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 4, extra2: 0, extra3: 0 },
        },
      },
      {
        name: 'Melvin R. Pena',
        aliases: ['Melvin Rolando Pena'],
        bonus: 30,
        days: {
          sunday: { normal: 6, extra1: 8, extra2: 2, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 1, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 4, extra3: 1 },
        },
      },
      {
        name: 'Marleny Pena',
        bonus: 0,
        days: {
          sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
        },
      },
    ],
  },
  {
    year: 2026,
    weekNumber: 21,
    label: '17/05/2026 - 23/05/2026',
    rows: [
      {
        name: 'Seydi Pena',
        bonus: 90.5,
        days: {
          sunday: { normal: 10, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 8, extra1: 4, extra2: 2, extra3: 0 },
          tuesday: { normal: 8, extra1: 4, extra2: 1.5, extra3: 0 },
          wednesday: { normal: 8, extra1: 4, extra2: 1, extra3: 0 },
          thursday: { normal: 8, extra1: 1.5, extra2: 0, extra3: 0 },
          friday: { normal: 8.5, extra1: 4, extra2: 2, extra3: 0 },
          saturday: { normal: 4, extra1: 2, extra2: 0.5, extra3: 3 },
        },
      },
      {
        name: 'Melvin E. Pena',
        bonus: 30,
        days: {
          sunday: { normal: 6, extra1: 8, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 3, extra2: 4, extra3: 1 },
        },
      },
      {
        name: 'Melvin R. Pena',
        aliases: ['Melvin Rolando Pena'],
        bonus: 20,
        days: {
          sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 2.5, extra2: 1, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
        },
      },
      {
        name: 'Marleny Pena',
        bonus: 0,
        days: {
          sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
        },
      },
    ],
  },
  {
    year: 2026,
    weekNumber: 23,
    label: '31/05/2026 - 06/06/2026',
    rows: [
      {
        name: 'Seydi Pena',
        bonus: 75.5,
        days: {
          sunday: { normal: 9, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 8, extra1: 4, extra2: 0, extra3: 0 },
          tuesday: { normal: 8, extra1: 2, extra2: 0, extra3: 0 },
          wednesday: { normal: 8.5, extra1: 4, extra2: 1, extra3: 0 },
          thursday: { normal: 8, extra1: 1.5, extra2: 0, extra3: 0 },
          friday: { normal: 9, extra1: 4, extra2: 2, extra3: 0 },
          saturday: { normal: 5, extra1: 0, extra2: 0, extra3: 1 },
        },
      },
      {
        name: 'Melvin E. Pena',
        bonus: 30.5,
        days: {
          sunday: { normal: 10, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 1.5, extra2: 1.5, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 4, extra2: 4, extra3: 1 },
        },
      },
      {
        name: 'Melvin R. Pena',
        aliases: ['Melvin Rolando Pena'],
        bonus: 20,
        days: {
          sunday: { normal: 2, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 2.5, extra2: 1, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
        },
      },
      {
        name: 'Marleny Pena',
        bonus: 0,
        days: {
          sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
          saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
        },
      },
    ],
  },
] satisfies ImagePayrollSourceWeek[];
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
  'financial-movements',
  'sales-profitability',
  'system-health',
  'history',
  'inventory-sheet',
  'inventory-out-of-stock',
  'attendance',
  'payroll',
  'payroll-generate',
];

@Component({
  selector: 'app-root',
  imports: [NgTemplateOutlet, CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, ProductImageComponent, DatePickerComponent, LucideBan, LucideDownload, LucideEye, LucideFileText, LucideRotateCcw, LucideSearch, LucideSettings],
  templateUrl: './app.html',
  styleUrls: ['./app.css', './yr-ui.css']
})
export class App implements OnDestroy {
  private customerDisplayWindow: Window | null = null;
  private customerDisplayPreviousItems = new Map<number, number>();
  private customerDisplaySession = '';
  private customerDisplayHighlightId: number | null = null;
  private customerDisplayHighlightUntil = 0;
  private billingSearchInput?: ElementRef<HTMLInputElement>;
  private billingSearchFocusTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastEditablePointerDownAt = 0;
  private readonly trackEditablePointerDown = (event: Event): void => {
    if (this.isEditableElement(event.target)) {
      this.lastEditablePointerDownAt = Date.now();
    }
  };
  private salesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private profitabilitySalesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private invoicesSalesTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private creditsTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private creditHistoryTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private attendanceTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private payrollTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private pettyCashTrendCanvas?: ElementRef<HTMLCanvasElement>;
  private financialMovementsTrendCanvas?: ElementRef<HTMLCanvasElement>;
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
  private profitabilitySalesTrendChart: Chart<'line', number[], string> | null = null;
  private invoicesSalesTrendChart: Chart<'line', number[], string> | null = null;
  private creditsTrendChart: Chart<'line', number[], string> | null = null;
  private creditHistoryTrendChart: Chart<'line', number[], string> | null = null;
  private attendanceTrendChart: Chart<'line', number[], string> | null = null;
  private payrollTrendChart: Chart<'line', number[], string> | null = null;
  private pettyCashTrendChart: Chart<'line', number[], string> | null = null;
  private financialMovementsTrendChart: Chart<'line', number[], string> | null = null;
  private purchasesTrendChart: Chart<'line', number[], string> | null = null;
  private costsDistributionChart: Chart<'pie', number[], string> | null = null;
  private costsEvolutionChart: Chart<'line', number[], string> | null = null;
  private costsCategoryChart: Chart<'bar' | 'line', number[], string> | null = null;
  private auditUserTrendChart: Chart<'line', number[], string> | null = null;
  private dashboardPayrollChart: Chart<'line', number[], string> | null = null;
  private dashboardAttendanceChart: Chart<'pie', number[], string> | null = null;
  private dashboardInventoryChart: Chart<'line', number[], string> | null = null;
  private dashboardCostsChart: Chart<'bar', number[], string> | null = null;
  private dashboardHistoryChart: Chart<'line', number[], string> | null = null;
  private payrollAuditTimer: number | null = null;
  private payrollDataLoaded = false;
  private payrollDataLoadPromise: Promise<void> | null = null;
  private salesProfitabilityCache = new Map<string, SalesProfitabilityAnalytics>();
  private salesProfitabilityLoadPromises = new Map<string, Promise<void>>();

  @ViewChild('billingSearchInput')
  protected set billingSearchInputRef(input: ElementRef<HTMLInputElement> | undefined) {
    this.billingSearchInput = input;
    this.scheduleBillingSearchFocus();
  }

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

  @ViewChild('profitabilitySalesTrendCanvas')
  protected set profitabilitySalesTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.profitabilitySalesTrendChart && this.profitabilitySalesTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.profitabilitySalesTrendChart.destroy();
      this.profitabilitySalesTrendChart = null;
    }

    this.profitabilitySalesTrendCanvas = canvas;

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

  @ViewChild('creditHistoryTrendCanvas')
  protected set creditHistoryTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.creditHistoryTrendChart && this.creditHistoryTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.creditHistoryTrendChart.destroy();
      this.creditHistoryTrendChart = null;
    }

    this.creditHistoryTrendCanvas = canvas;

    if (canvas) {
      queueMicrotask(() => this.updateCreditHistoryTrendChart());
    }
  }

  @ViewChild('creditsTrendCanvas')
  protected set creditsTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.creditsTrendChart && this.creditsTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.creditsTrendChart.destroy();
      this.creditsTrendChart = null;
    }

    this.creditsTrendCanvas = canvas;

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

  @ViewChild('attendanceTrendCanvas')
  protected set attendanceTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.attendanceTrendChart && this.attendanceTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.attendanceTrendChart.destroy();
      this.attendanceTrendChart = null;
    }

    this.attendanceTrendCanvas = canvas;

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

  @ViewChild('pettyCashTrendCanvas')
  protected set pettyCashTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.pettyCashTrendChart && this.pettyCashTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.pettyCashTrendChart.destroy();
      this.pettyCashTrendChart = null;
    }

    this.pettyCashTrendCanvas = canvas;

    if (canvas) {
      this.scheduleVisibleChartsRefresh();
    }
  }

  @ViewChild('financialMovementsTrendCanvas')
  protected set financialMovementsTrendCanvasRef(canvas: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.financialMovementsTrendChart && this.financialMovementsTrendCanvas?.nativeElement !== canvas?.nativeElement) {
      this.financialMovementsTrendChart.destroy();
      this.financialMovementsTrendChart = null;
    }

    this.financialMovementsTrendCanvas = canvas;

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
  protected readonly loginPasswordVisible = signal(false);
  protected readonly loginUsers = signal<LoginUserOption[]>([]);
  protected readonly loginError = signal('');
  protected readonly loginLoading = signal(false);
  protected readonly checkoutError = signal('');
  protected readonly checkoutLoading = signal(false);
  protected readonly sidebarCollapsed = signal(true);
  protected readonly pageZoomPercent = signal(100);
  protected readonly sidebarTooltip = signal<{ label: string; top: number; left: number } | null>(null);
  protected readonly expandedChartPreview = signal<{ title: string; imageUrl: string; fileName: string; background: string } | null>(null);
  protected readonly quickReceivedAmounts = [50, 100, 200, 500];
  protected readonly saleReceivedAmount = signal('');
  protected readonly saleSuccessMessage = signal('');
  protected readonly saleToastVariant = signal<'success' | 'error'>('success');
  protected readonly orderCsvImporting = signal(false);
  protected readonly orderCsvFileName = signal('');
  protected readonly orderInvoiceModalOpen = signal(false);
  protected readonly orderInvoiceSessions = signal<OrderInvoiceSession[]>([]);
  protected readonly activeOrderInvoiceId = signal('');
  protected readonly inventorySuccessMessage = signal('');
  protected readonly inventoryToastVariant = signal<'success' | 'error'>('success');
  protected readonly pettyCashToastMessage = signal('');
  protected readonly pettyCashToastVariant = signal<'success' | 'error'>('success');
  protected readonly selectedPaymentMethod = signal<PaymentMethod>('efectivo');
  protected readonly selectedCustomer = signal('Cliente final');
  protected readonly selectedCustomerId = signal<number | null>(null);
  protected readonly customerModalOpen = signal(false);
  protected readonly customerOptions = signal<CustomerOption[]>([]);
  protected readonly customerLoading = signal(false);
  protected readonly customerError = signal('');
  protected readonly productsLoading = signal(false);
  protected readonly productsError = signal('');
  protected readonly inactiveProducts = signal<InactiveProduct[]>([]);
  protected readonly inactiveProductsPanelOpen = signal(false);
  protected readonly inactiveProductsLoading = signal(false);
  protected readonly inactiveProductsError = signal('');
  protected readonly inactiveProductSearch = signal('');
  protected readonly inactiveProductsPage = signal(1);
  protected readonly productReactivationModalOpen = signal(false);
  protected readonly productReactivationConfirmOpen = signal(false);
  protected readonly productReactivationSaving = signal(false);
  protected readonly productReactivationError = signal('');
  protected readonly selectedInactiveProduct = signal<InactiveProduct | null>(null);
  protected readonly productReactivationDraft = signal<ProductReactivationDraft>({
    nuevoCosto: '',
    nuevoPrecioVenta: '',
    stockReingreso: '',
  });
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
  protected readonly quickInventoryPurchaseModalOpen = signal(false);
  protected readonly quickInventoryPurchaseQuantity = signal('');
  protected readonly quickInventoryPurchaseUnitCost = signal('');
  protected readonly quickInventoryPurchaseExpiryDate = signal('');
  protected readonly quickInventoryPurchaseSaving = signal(false);
  protected readonly quickInventoryPurchaseError = signal('');
  protected readonly quickInventoryReductionModalOpen = signal(false);
  protected readonly quickInventoryReductionQuantity = signal('');
  protected readonly quickInventoryReductionReason = signal('Producto vencido');
  protected readonly quickInventoryReductionSaving = signal(false);
  protected readonly quickInventoryReductionError = signal('');
  protected readonly salesDropAlertModalOpen = signal(false);
  protected readonly salesDropAlertLoading = signal(false);
  protected readonly salesDropAlertError = signal('');
  protected readonly systemUpdateLoading = signal(false);
  protected readonly systemUpdateMessage = signal('');
  protected readonly purchaseRows = signal<PurchaseHistoryRow[]>([]);
  protected readonly purchaseLoading = signal(false);
  protected readonly purchaseError = signal('');
  protected readonly creditLines = signal<CreditLine[]>([]);
  protected readonly creditLoading = signal(false);
  protected readonly creditError = signal('');
  protected readonly creditSearchTerm = signal('');
  protected readonly selectedCreditCustomerId = signal<number | null>(null);
  protected readonly creditDossierId = signal<number | null>(null);
  protected readonly creditPeopleSearch = signal('');
  protected readonly creditSummaryCollapsed = signal(false);
  protected readonly creditPeopleFilter = signal<'all' | 'inactive'>('all');
  protected readonly creditPeopleSort = signal('balance');
  protected readonly creditDossierTab = signal<'invoices' | 'payments'>('invoices');
  protected readonly creditPeopleHistories = signal<Record<number, CreditPayment[] | null>>({});
  protected readonly creditPeopleHistoryLoading = signal(false);
  protected readonly creditPeopleAsOf = signal(new Date());
  private creditPeopleRequest = 0;

  protected creditDateDays(value: string | null): number | null {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const now = this.creditPeopleAsOf();
    return Math.max(0, Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000));
  }

  protected creditCustomerActivity(group: CreditCustomerGroup): { date: string | null; days: number | null; inactive: boolean; label: string } {
    const payments = this.creditPeopleHistories()[group.customerId];
    if (!payments) return { date: null, days: null, inactive: false, label: 'Historial no disponible' };
    const latest = payments.filter(p => p.amount > 0).map(p => p.createdAt).filter(d => Number.isFinite(new Date(d).getTime())).sort((a,b) => new Date(b).getTime() - new Date(a).getTime())[0];
    // Paid balances without a dated receipt must never be classified as never paid.
    if (!latest && group.invoices.some(i => i.paidAmount > 0)) return { date: null, days: null, inactive: false, label: 'Fecha de abono no disponible' };
    const oldest = group.invoices.filter(i => i.pendingAmount > 0.005).map(i => i.createdAt).filter((d): d is string => !!d && Number.isFinite(new Date(d).getTime())).sort((a,b) => new Date(a).getTime() - new Date(b).getTime())[0];
    const date = latest || oldest || null;
    const days = this.creditDateDays(date);
    const now = this.creditPeopleAsOf();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    cutoff.setDate(Math.min(now.getDate(), new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate()));
    const activityDate = date ? new Date(date) : null;
    if (activityDate) activityDate.setHours(0,0,0,0);
    return { date, days, inactive: !!activityDate && activityDate < cutoff, label: latest ? 'Último abono' : 'Sin abonos · Desde emisión' };
  }

  protected readonly creditPeopleAll = computed(() => this.creditCustomerGroups().filter(g => g.total > 0.005));
  protected readonly creditPeopleUnknown = computed(() => this.creditPeopleAll().filter(g => this.creditCustomerActivity(g).days === null).length);
  protected readonly creditPeopleBalance = computed(() => this.creditPeopleAll().reduce((n,g) => n + g.total, 0));
  protected readonly creditPeopleInactive = computed(() => this.creditPeopleAll().filter(g => this.creditCustomerActivity(g).inactive));
  protected readonly creditPeople = computed(() => {
    const query = this.creditPeopleSearch().trim().toLocaleLowerCase('es');
    return this.creditPeopleAll().filter(g => (!query || `${g.customerName} ${g.customerPhone || ''} ${g.customerId}`.toLocaleLowerCase('es').includes(query)) && (this.creditPeopleFilter() === 'all' || this.creditCustomerActivity(g).inactive)).sort((a,b) => this.creditPeopleSort() === 'name' ? a.customerName.localeCompare(b.customerName, 'es') : this.creditPeopleSort() === 'inactive' ? (this.creditCustomerActivity(b).days ?? -1) - (this.creditCustomerActivity(a).days ?? -1) || b.total - a.total : b.total - a.total);
  });
  protected readonly creditDossier = computed<CreditCustomerGroup | null>(() => this.creditPeople().find(g => g.customerId === this.creditDossierId()) || this.creditPeople()[0] || null);
  protected readonly creditDossierInvoices = computed(() => (this.creditDossier()?.invoices || []).filter(i => i.pendingAmount > 0.005).sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
  protected readonly creditDossierPayments = computed(() => (this.creditPeopleHistories()[this.creditDossier()?.customerId || 0] || []).slice().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  protected creditInitials(name: string): string { return name.trim().split(/\s+/).slice(0,2).map(n => n[0]).join('').toUpperCase(); }

  private async loadCreditPeopleHistories(): Promise<void> {
    const token = ++this.creditPeopleRequest;
    this.creditPeopleAsOf.set(new Date());
    this.creditPeopleHistories.set({});
    this.creditPeopleHistoryLoading.set(true);
    const ids = this.creditPeopleAll().map(g => g.customerId);
    let cursor = 0;
    await Promise.all(Array.from({length: Math.min(4, ids.length)}, async () => {
      while (cursor < ids.length && token === this.creditPeopleRequest) {
        const id = ids[cursor++];
        try {
          const response = this.desktopApi ? await this.desktopApi.getCreditPaymentHistory(id) : await firstValueFrom(this.http.get<CreditPaymentsResponse>(`/api/credit-payments/customer/${id}`));
          if (token === this.creditPeopleRequest) this.creditPeopleHistories.update(v => ({...v, [id]: response.payments}));
        } catch {
          if (token === this.creditPeopleRequest) this.creditPeopleHistories.update(v => ({...v, [id]: null}));
        }
      }
    }));
    if (token === this.creditPeopleRequest) this.creditPeopleHistoryLoading.set(false);
  }

  protected readonly creditViewMode = signal<CreditViewMode>('customer');
  protected readonly creditTrendPeriod = signal<CreditTrendPeriod>('month');
  protected readonly creditPaymentModalOpen = signal(false);
  protected readonly creditPaymentCustomer = signal<CreditCustomerGroup | null>(null);
  protected readonly creditPaymentAmount = signal('');
  protected readonly creditPaymentMethod = signal<CreditPaymentMethod>('transferencia');
  protected readonly creditPaymentDescription = signal('Abono a credito');
  protected readonly creditPaymentSaving = signal(false);
  protected readonly creditPaymentError = signal('');
  protected readonly creditPaymentSuccess = signal('');
  protected readonly creditPaymentVoucherModalOpen = signal(false);
  protected readonly lastCreditPaymentVoucher = signal<CreditPaymentVoucher | null>(null);
  protected readonly creditHistoryModalOpen = signal(false);
  protected readonly creditHistoryCustomer = signal<CreditCustomerGroup | null>(null);
  protected readonly creditHistoryPayments = signal<CreditPayment[]>([]);
  protected readonly creditHistoryLoading = signal(false);
  protected readonly creditHistoryError = signal('');
  protected readonly generalCreditHistoryModalOpen = signal(false);
  protected readonly generalCreditHistoryPayments = signal<CreditPayment[]>([]);
  protected readonly generalCreditHistoryLoading = signal(false);
  protected readonly generalCreditHistoryError = signal('');
  protected readonly expandedGeneralCreditHistoryDays = signal<string[]>([]);
  protected readonly expandedGeneralCreditHistoryCustomers = signal<string[]>([]);
  protected readonly expandedCreditHistoryYears = signal<string[]>([]);
  protected readonly expandedCreditHistoryMonths = signal<string[]>([]);
  protected readonly expandedCreditHistoryWeeks = signal<string[]>([]);
  protected readonly creditHistoryTrendPeriod = signal<CreditHistoryTrendPeriod>('month');
  protected readonly selectedCreditHistoryYear = signal('');
  protected readonly expandedPurchaseDayKeys = signal<string[]>([]);
  protected readonly expandedPurchasePaymentKeys = signal<string[]>([]);
  protected readonly invoiceRows = signal<InvoiceRow[]>([]);
  protected readonly todayInvoiceRows = signal<InvoiceRow[]>([]);
  protected readonly expandedInvoiceDayKeys = signal<string[]>([]);
  protected readonly expandedInvoicePaymentKeys = signal<string[]>([]);
  protected readonly invoiceMonthlySalesExpanded = signal(false);
  protected readonly invoiceMasterExpanded = signal(true);
  protected readonly invoiceSummaryCollapsed = signal(false);
  protected readonly invoiceTableDensity = signal<'compact' | 'normal' | 'spacious'>('normal');
  protected readonly invoiceSearch = signal('');
  protected readonly invoicePaymentFilter = signal('');
  protected readonly invoiceStatusFilter = signal('');
  protected readonly invoiceCustomerFilter = signal('');
  protected readonly invoiceSort = signal({ key: 'createdAt', direction: 'desc' as 'asc' | 'desc' });
  protected readonly invoiceMonthlySort = signal({ key: 'key', direction: 'desc' as 'asc' | 'desc' });
  protected invoiceCustomerKey(invoice: InvoiceRow): string {
    return invoice.customerId == null ? `name:${invoice.customerName}` : `id:${invoice.customerId}`;
  }
  protected readonly invoiceCustomerOptions = computed(() => [...new Map(this.invoiceRows().map(row =>
    [this.invoiceCustomerKey(row), { id: this.invoiceCustomerKey(row), label: row.customerName }])).values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'es')));
  protected sortInvoiceTable(table: 'invoices' | 'monthly', key: string): void {
    const state = table === 'invoices' ? this.invoiceSort : this.invoiceMonthlySort;
    state.update(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    (table === 'invoices' ? this.invoicePage : this.invoiceMonthlyPage).set(1);
  }
  protected invoiceAriaSort(table: 'invoices' | 'monthly', key: string): 'none' | 'ascending' | 'descending' {
    const state = (table === 'invoices' ? this.invoiceSort : this.invoiceMonthlySort)();
    return state.key !== key ? 'none' : state.direction === 'asc' ? 'ascending' : 'descending';
  }
  protected invoiceSortLabel(table: 'invoices' | 'monthly', key: string): string {
    const state = this.invoiceAriaSort(table, key);
    return state === 'none' ? '↕' : state === 'ascending' ? '↑' : '↓';
  }
  private compareInvoiceValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
    if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b
      : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
    return direction === 'asc' ? comparison : -comparison;
  }
  protected updateInvoiceCustomerFilter(event: Event): void {
    this.invoiceCustomerFilter.set((event.target as HTMLSelectElement).value);
    this.invoicePage.set(1); this.closeInvoicePreview();
  }

  protected readonly invoicePeriod = signal<'day' | 'week' | 'month' | 'all'>('day');
  protected readonly invoiceDate = signal(this.formatDateKey(new Date()));
  protected readonly invoiceGrouping = signal<'none' | 'payment'>('none');
  protected readonly invoicePreviewId = signal<number | null>(null);
  protected readonly invoicePreviewLines = signal<InvoiceLine[]>([]);
  protected readonly invoicePreviewLoading = signal(false);
  protected readonly invoicePreviewError = signal('');
  private invoicePreviewRequest = 0;
  protected readonly invoicePreview = computed(() =>
    this.filteredInvoiceRows().find(row => row.invoiceId === this.invoicePreviewId()) ?? null,
  );
  protected readonly invoiceMonthlyMonthsToShow = signal(12);
  protected readonly invoiceMonthlyPage = signal(1);
  protected readonly invoiceMonthlyPageSize = signal(10);
  protected readonly invoiceMonthlyDensity = signal<'compact' | 'normal' | 'spacious'>('normal');
  protected readonly invoiceMonthlyPageCount = computed(() => Math.max(1,
    Math.ceil(this.invoiceMonthlySalesRows().length / this.invoiceMonthlyPageSize())));
  protected readonly paginatedInvoiceMonths = computed(() => {
    const start = (Math.min(this.invoiceMonthlyPage(), this.invoiceMonthlyPageCount()) - 1) * this.invoiceMonthlyPageSize();
    const sort = this.invoiceMonthlySort();
    const value = (row: InvoiceMonthlySalesRow) => sort.key === 'variation' ? this.invoiceMonthlyVariation(row)
      : row[sort.key as keyof InvoiceMonthlySalesRow];
    return [...this.invoiceMonthlySalesRows()].sort((a, b) => this.compareInvoiceValues(value(a), value(b), sort.direction)
      || b.key.localeCompare(a.key)).slice(start, start + this.invoiceMonthlyPageSize());
  });
  protected readonly invoiceDetailModalOpen = signal(false);
  protected readonly invoiceDetailInvoice = signal<InvoiceRow | null>(null);
  protected readonly detailSearch = signal('');
  protected readonly detailStatus = signal('');
  protected readonly detailPage = signal(1);
  protected readonly detailSize = signal(10);
  protected readonly detailNotice = signal(false);
  private detailNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly detailSelected = signal<Set<number>>(new Set());
  protected readonly detailSort = signal<{key: keyof InvoiceLine; direction: 1 | -1}>({key:'productName', direction:1});
  protected readonly detailColumns: {key: keyof InvoiceLine; label:string}[] = [{key:'sku',label:'Código'}, {key:'productName',label:'Producto'}, {key:'quantity',label:'Cantidad'}, {key:'salePrice',label:'Precio'}, {key:'total',label:'Total'}, {key:'statusName',label:'Estado'}];
  protected readonly detailStatuses = computed(() => [...new Set(this.invoiceDetailLines().map(l => l.statusName || this.invoiceDetailInvoice()?.statusName || ''))].filter(Boolean));
  protected readonly detailFiltered = computed(() => {
    const query = this.normalizeText(this.detailSearch().trim());
    const {key,direction} = this.detailSort();
    return this.invoiceDetailLines().filter(l => (!this.detailStatus() || (l.statusName || this.invoiceDetailInvoice()?.statusName) === this.detailStatus()) && (!query || this.normalizeText([l.sku,l.productId,l.productName,l.paymentTypeName].join(' ')).includes(query)))
      .sort((a,b) => { const av=a[key], bv=b[key]; return (typeof av === 'number' && typeof bv === 'number' ? av-bv : String(av ?? '').localeCompare(String(bv ?? ''),'es',{numeric:true,sensitivity:'base'}))*direction || a.id-b.id; });
  });
  protected readonly detailPages = computed(() => Math.max(1,Math.ceil(this.detailFiltered().length / this.detailSize())));
  protected readonly detailCurrentPage = computed(() => Math.min(this.detailPage(),this.detailPages()));
  protected readonly detailRows = computed(() => this.detailFiltered().slice((this.detailCurrentPage()-1)*this.detailSize(),this.detailCurrentPage()*this.detailSize()));
  protected readonly detailAllSelected = computed(() => this.detailRows().length > 0 && this.detailRows().every(l => this.detailSelected().has(l.id)));
  protected readonly detailSomeSelected = computed(() => !this.detailAllSelected() && this.detailRows().some(l => this.detailSelected().has(l.id)));
  protected setDetailFilter(kind:'search'|'status'|'size',event:Event):void {
    const value=(event.target as HTMLInputElement).value;
    if(kind==='search') this.detailSearch.set(value);
    if(kind==='status') this.detailStatus.set(value);
    if(kind==='size' && this.dailySalesSizeOptions.includes(Number(value))) this.detailSize.set(Number(value));
    this.detailPage.set(1);
    if(this.detailNoticeTimer) clearTimeout(this.detailNoticeTimer);
    this.detailNotice.set(true);
    this.detailNoticeTimer=setTimeout(()=>{this.detailNotice.set(false);this.detailNoticeTimer=null;},3500);
  }
  protected sortDetail(key:keyof InvoiceLine):void {
    this.detailSort.update(s=>({key,direction:s.key===key && s.direction===1 ? -1 : 1}));
    this.detailPage.set(1);
  }
  protected selectDetail(id:number):void { this.detailSelected.update(ids=>{const next=new Set(ids);next.has(id)?next.delete(id):next.add(id);return next;}); }
  protected selectDetailPage():void {
    const remove=this.detailAllSelected();
    this.detailSelected.update(ids=>{const next=new Set(ids);for(const l of this.detailRows()) remove?next.delete(l.id):next.add(l.id);return next;});
  }
  protected exportDetailSelection(): void {
    const rows = this.invoiceDetailLines().filter(line => this.detailSelected().has(line.id));
    if (!rows.length) return;
    const cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const csv = [this.detailColumns.map(c => cell(c.label)).join(','), ...rows.map(row => this.detailColumns.map(c => cell(row[c.key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href = url; link.download = 'detalle-factura-seleccion.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  protected clearDetailSelection():void {this.detailSelected.set(new Set());}
  protected readonly invoiceDetailLines = signal<InvoiceLine[]>([]);
  protected readonly invoiceDetailLoading = signal(false);
  protected readonly invoiceDetailError = signal('');
  protected readonly quoteRows = signal<QuoteRow[]>([]);
  protected readonly expandedQuoteIds = signal<number[]>([]);
  protected readonly quoteDetailRows = signal<Record<number, QuoteLine[]>>({});
  protected readonly quoteDetailLoadingIds = signal<number[]>([]);
  protected readonly invoiceLoading = signal(false);
  protected readonly todayInvoiceLoading = signal(false);
  protected readonly quoteLoading = signal(false);
  protected readonly quoteSaving = signal(false);
  protected readonly quoteModalOpen = signal(false);
  protected readonly todayInvoiceError = signal('');
  protected readonly invoiceError = signal('');
  protected readonly quoteError = signal('');
  protected readonly activeQuoteId = signal<number | null>(null);
  protected readonly activeQuoteNumber = signal('');
  protected readonly dailySalesResultsVisible = signal(false);
  private dailySalesResultsTimeout: ReturnType<typeof setTimeout> | null = null;
  protected readonly dailySalesSearch = signal('');
  protected readonly dailySalesPayment = signal('');
  protected readonly dailySalesStatus = signal('');
  protected readonly dailySalesPage = signal(1);
  protected readonly dailySalesPageSize = signal(10);
  protected readonly dailySalesSizeOptions = [10, 25, 50, 100];
  protected readonly dailySalesSort = signal<{ key: keyof InvoiceRow; direction: 1 | -1 }>({ key: 'createdAt', direction: -1 });
  protected readonly dailySalesColumns: { key: keyof InvoiceRow; label: string }[] = [
    {key:'invoiceId',label:'Factura'}, {key:'customerName',label:'Cliente'}, {key:'createdAt',label:'Fecha'},
    {key:'paymentTypeName',label:'Tipo de pago'}, {key:'itemCount',label:'Artículos'}, {key:'total',label:'Total'},
    {key:'statusName',label:'Estado'}, {key:'userName',label:'Usuario'}
  ];
  protected readonly dailySalesSelected = signal<Set<number>>(new Set());
  protected readonly dailySalesPayments = computed(() => [...new Set(this.todayInvoiceRows().map(r => r.paymentTypeName))].sort());
  protected readonly dailySalesStatuses = computed(() => [...new Set(this.todayInvoiceRows().map(r => r.statusName))].sort());
  protected readonly dailySalesFiltered = computed(() => {
    const query = this.normalizeText(this.dailySalesSearch().trim());
    const {key, direction} = this.dailySalesSort();
    return this.todayInvoiceRows().filter(r =>
      (!this.dailySalesPayment() || r.paymentTypeName === this.dailySalesPayment()) &&
      (!this.dailySalesStatus() || r.statusName === this.dailySalesStatus()) &&
      (!query || this.normalizeText([r.invoiceId, r.customerName, this.formatTableDateTime(r.createdAt), r.paymentTypeName, r.statusName, r.userName, r.total].join(' ')).includes(query))
    ).sort((a,b) => {
      const av = a[key], bv = b[key];
      const value = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'es', {numeric:true, sensitivity:'base'});
      return value * direction || a.invoiceId - b.invoiceId;
    });
  });
  protected readonly dailySalesPageCount = computed(() => Math.max(1, Math.ceil(this.dailySalesFiltered().length / this.dailySalesPageSize())));
  protected readonly dailySalesVisiblePage = computed(() => Math.min(this.dailySalesPage(), this.dailySalesPageCount()));
  protected readonly dailySalesPageRows = computed(() => {
    const start = (this.dailySalesVisiblePage() - 1) * this.dailySalesPageSize();
    return this.dailySalesFiltered().slice(start, start + this.dailySalesPageSize());
  });
  protected readonly dailySalesSelectedRows = computed(() => this.todayInvoiceRows().filter(r => this.dailySalesSelected().has(r.invoiceId)));
  protected readonly dailySalesPageSelected = computed(() => this.dailySalesPageRows().length > 0 && this.dailySalesPageRows().every(r => this.dailySalesSelected().has(r.invoiceId)));
  protected readonly dailySalesPagePartSelected = computed(() => !this.dailySalesPageSelected() && this.dailySalesPageRows().some(r => this.dailySalesSelected().has(r.invoiceId)));

  protected setDailySalesFilter(kind: 'search' | 'payment' | 'status' | 'size', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (kind === 'search') this.dailySalesSearch.set(value);
    if (kind === 'payment') this.dailySalesPayment.set(value);
    if (kind === 'status') this.dailySalesStatus.set(value);
    if (kind === 'size' && this.dailySalesSizeOptions.includes(Number(value))) this.dailySalesPageSize.set(Number(value));
    this.dailySalesPage.set(1);
    if (this.dailySalesResultsTimeout) clearTimeout(this.dailySalesResultsTimeout);
    this.dailySalesResultsVisible.set(true);
    this.dailySalesResultsTimeout = setTimeout(() => {
      this.dailySalesResultsVisible.set(false);
      this.dailySalesResultsTimeout = null;
    }, 3500);
  }

  protected sortDailySales(key: keyof InvoiceRow): void {
    this.dailySalesSort.update(sort => ({key, direction: sort.key === key && sort.direction === 1 ? -1 : 1}));
    this.dailySalesPage.set(1);
  }

  protected clearDailySalesSelection(): void { this.dailySalesSelected.set(new Set()); }

  protected toggleDailySalesSelection(id: number): void {
    this.dailySalesSelected.update(ids => { const next = new Set(ids); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  protected toggleDailySalesPageSelection(): void {
    const remove = this.dailySalesPageSelected();
    this.dailySalesSelected.update(ids => { const next = new Set(ids); for (const row of this.dailySalesPageRows()) remove ? next.delete(row.invoiceId) : next.add(row.invoiceId); return next; });
  }

  protected exportDailySalesSelection(): void {
    const rows = this.dailySalesSelectedRows();
    if (!rows.length) return;
    const cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const csv = [this.dailySalesColumns.map(c => cell(c.label)).join(','), ...rows.map(row => this.dailySalesColumns.map(c => cell(row[c.key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href = url; link.download = 'ventas-seleccionadas.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  protected readonly invoiceAnnulTarget = signal<InvoiceRow | null>(null);
  protected readonly invoiceAnnulBusy = signal(false);
  protected readonly invoiceAnnulError = signal('');

  protected requestInvoiceAnnul(invoice: InvoiceRow): void {
    if (this.invoiceAnnulBusy()) return;
    this.invoiceAnnulTarget.set(invoice);
    this.invoiceAnnulError.set('');
    const dialog = document.querySelector<HTMLDialogElement>('#yr-invoice-annul-dialog');
    dialog?.showModal();
    requestAnimationFrame(() => dialog?.querySelector<HTMLButtonElement>('.yr-annul-cancel')?.focus());
  }

  protected closeInvoiceAnnul(): void {
    if (this.invoiceAnnulBusy()) return;
    document.querySelector<HTMLDialogElement>('#yr-invoice-annul-dialog')?.close();
    this.invoiceAnnulTarget.set(null);
    this.invoiceAnnulError.set('');
  }

  protected async confirmInvoiceAnnul(): Promise<void> {
    const invoice = this.invoiceAnnulTarget();
    if (!invoice || this.invoiceAnnulBusy()) return;
    this.invoiceAnnulBusy.set(true);
    this.invoiceAnnulError.set('');
    try {
      await this.annulInvoice(invoice);
      if (!this.invoiceAnnulError()) {
        this.invoiceAnnulBusy.set(false);
        this.closeInvoiceAnnul();
      }
    } finally {
      this.invoiceAnnulBusy.set(false);
    }
  }

  protected readonly dailySalesModalOpen = signal(false);
  protected readonly productCatalogModalOpen = signal(false);
  protected readonly cutModalOpen = signal(false);
  protected readonly cutRows = signal<DailyCut[]>([]);
  protected readonly cutPreview = signal<DailyCut | null>(null);
  protected readonly cutLoading = signal(false);
  protected readonly cutSaving = signal(false);
  protected readonly cutError = signal('');
  protected readonly cutFilterFromDate = signal(this.todayDateKey());
  protected readonly cutFilterToDate = signal(this.todayDateKey());
  protected readonly selectedCutId = signal<number | null>(null);
  protected readonly creditPaymentRows = signal<CreditPayment[]>([]);
  protected readonly pettyCashCuts = signal<DailyCut[]>([]);
  protected readonly pettyCashManualRecords = signal<PettyCashManualRecord[]>([]);
  protected readonly pettyCashLoading = signal(false);
  protected readonly pettyCashSaving = signal(false);
  protected readonly pettyCashError = signal('');
  protected readonly pettyCashTrendPeriod = signal<PettyCashTrendPeriod>('day');
  protected readonly pettyCashPage = signal(1);
  protected readonly pettyCashModalOpen = signal(false);
  protected readonly pettyCashEditingId = signal<number | null>(null);
  protected readonly pettyCashEditingCutId = signal<number | null>(null);
  protected readonly pettyCashDeleteTarget = signal<PettyCashRow | null>(null);
  protected readonly pettyCashEditMode = signal<'new' | 'edit' | 'adjust'>('new');
  protected readonly pettyCashDraft = signal<PettyCashDraft>({
    date: this.todayDateKey(),
    initialAmount: 1500,
    finalAmount: 0,
    turnBilling: 0,
    cashToPetty: 0,
    registerBalance: 1500,
    changeWallet: 0,
    pettyCashTotal: 0,
    cashOut: 0,
    reason: '',
    realCashTotal: 0,
    comments: '',
    dividendBenefit: 0,
    fourteenthBonus: 0,
  });
  protected readonly logoutCutModalOpen = signal(false);
  protected readonly logoutCutPreview = signal<DailyCut | null>(null);
  protected readonly logoutPhysicalCashCount = signal('');
  protected readonly logoutCutFromHistory = signal(false);
  protected readonly logoutCutTargetDate = signal<string | null>(null);
  protected readonly logoutCutTargetUserId = signal<number | null>(null);
  protected readonly logoutCutLoading = signal(false);
  protected readonly logoutCutSaving = signal(false);
  protected readonly logoutCutError = signal('');
  protected readonly openingCutModalOpen = signal(false);
  protected readonly openingCashAmount = signal('');
  protected readonly openingCutSaving = signal(false);
  protected readonly openingCutError = signal('');
  protected readonly invoicePage = signal(1);
  protected readonly invoicePageSize = signal(10);
  protected readonly purchasePage = signal(1);
  protected readonly purchasePageSize = 10;
  protected readonly selectedCostYear = signal(new Date().getFullYear());
  protected readonly selectedCostMonth = signal(new Date().getMonth() + 1);
  protected readonly selectedCostPeriod = signal<CostAnalysisPeriod>('month');
  protected readonly selectedCostWeek = signal(this.formatDateKey(this.startOfWeek(new Date())));
  protected readonly selectedCostCategory = signal('Todas');
  protected readonly costInvoiceLineRows = signal<Record<number, InvoiceLine[]>>({});
  protected readonly costAnalysisLoading = signal(false);
  protected readonly costAnalysisError = signal('');
  protected readonly costIncreaseAlertRows = signal<CostIncreaseAlertRow[]>([]);
  protected readonly costIncreaseAlertPeriod = signal<{ year: number; month: number } | null>(null);
  protected readonly costIncreaseAlertLoading = signal(false);
  protected readonly costIncreaseAlertError = signal('');
  protected readonly operationalCostRows = signal<OperationalCostRow[]>([]);
  protected readonly operationalCostLoading = signal(false);
  protected readonly operationalCostError = signal('');
  protected readonly operationalCostSaving = signal(false);
  protected readonly operationalCostModalOpen = signal(false);
  protected readonly salesProfitabilityAnalytics = signal<SalesProfitabilityAnalytics | null>(null);
  protected readonly salesProfitabilityLoading = signal(false);
  protected readonly salesProfitabilityError = signal('');
  protected readonly selectedSalesProfitabilityPeriod = signal(new Date().toISOString().slice(0, 7));
  protected readonly salesProfitabilityKardexProductFilter = signal('');
  protected readonly salesProfitabilityKardexCategoryFilter = signal('Todas');
  protected readonly salesProfitabilityKardexWarehouseFilter = signal('Todas');
  protected readonly salesProfitabilityKardexDateFilter = signal('');
  protected readonly profitabilityTopSoldPage = signal(1);
  protected readonly profitabilityTopProfitablePage = signal(1);
  protected readonly profitabilityCustomersPage = signal(1);
  protected readonly profitabilityKardexPage = signal(1);
  protected readonly systemHealth = signal<SystemHealthResponse | null>(null);
  protected readonly systemHealthLoading = signal(false);
  protected readonly systemHealthError = signal('');
  protected readonly operationalCostDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly operationalCostType = signal('Energia electrica');
  protected readonly operationalCostDescription = signal('');
  protected readonly operationalCostAmount = signal(0);
  protected readonly operationalCostPurchaseInvoiceKey = signal('');
  protected readonly operationalCostAppliesTo = signal('MES');
  protected readonly operationalCostReference = signal('');
  protected readonly purchaseWorkspaceView = signal<'receipt' | 'board' | 'history'>('receipt');
  protected readonly purchaseWorkspaceDrafts = signal<PurchaseWorkspaceDraft[]>([]);
  protected readonly purchaseWorkspaceId = signal<string | null>(null);
  protected readonly purchaseWorkspaceStage = signal<'prepare' | 'receive' | 'review'>('prepare');
  protected readonly purchaseWorkspaceSearch = signal('');
  protected readonly purchaseWorkspaceNotice = signal('');
  protected readonly purchaseReviewOpen = signal(false);
  protected readonly purchaseSummaryCollapsed = signal(false);
  protected readonly purchaseExpectedDate = signal('');
  protected readonly purchaseDetailKey = signal<string | null>(null);
  protected readonly purchaseDetail = computed(() => this.purchaseInvoiceGroups().find(i => i.key === this.purchaseDetailKey()) || null);
  protected readonly purchaseRegisteredSearch = signal('');
  protected readonly purchaseRegisteredState = signal('all');
  protected readonly purchaseRegistered = computed(() => {
    const q = this.purchaseRegisteredSearch().trim().toLocaleLowerCase('es');
    return this.purchaseInvoiceGroups().filter(i => (!q || `${i.supplierName} ${i.invoiceNumber} ${i.userName}`.toLocaleLowerCase('es').includes(q)) && (this.purchaseRegisteredState() === 'all' || this.purchaseRegisteredState() === this.purchaseRecordStatus(i)));
  });
  protected purchaseRecordStatus(i: PurchaseInvoiceGroup): string { return i.statusId === 3 || /anulad/i.test(i.statusName || '') ? 'Anulada' : 'Ingresada'; }
  protected purchasePaymentLabel(id: number): string { return id === 2 ? 'Crédito' : id === 3 ? 'Transferencia' : 'Efectivo'; }
  protected purchaseStageLabel(stage: string): string { return stage === 'receive' ? 'Programado · Por recibir' : stage === 'review' ? 'Recibido · Por validar' : 'Borrador · Por preparar'; }
  protected selectPurchaseExpectedDate(event: Event): void {
    this.purchaseExpectedDate.set((event.target as HTMLInputElement).value);
    if (this.purchaseExpectedDate() && this.purchaseSupplierId() && this.purchaseDraftLines().length) this.schedulePurchaseWorkspace();
  }
  protected schedulePurchaseWorkspace(): void {
    if (!this.purchaseSupplierId() || !this.purchaseDraftLines().length || !this.purchaseExpectedDate()) { this.purchaseModalError.set('Selecciona proveedor, productos y fecha prevista para programar.'); return; }
    this.purchaseModalError.set('');
    this.purchaseWorkspaceStage.set('receive');
    if (this.savePurchaseWorkspace()) this.purchaseWorkspaceNotice.set('Pedido programado localmente. No ha ingresado al inventario.');
  }

  protected readonly purchaseReceiptSummary = computed(() => {
    const invoices = this.purchaseInvoiceGroups().filter(i => i.statusId !== 3 && !/anulad/i.test(i.statusName || ''));
    const today = this.dateKey(new Date().toISOString());
    const sorted = invoices.filter(i => i.createdAt && Number.isFinite(new Date(i.createdAt).getTime())).slice().sort((a,b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
    return {today: sorted.filter(i => this.dateKey(i.createdAt) === today).length, latest: (sorted[0] || null) as PurchaseInvoiceGroup | null, recent: sorted.slice(0,3)};
  });
  protected async refreshPurchaseReceipt(): Promise<void> { await Promise.all([this.loadPurchases(), this.loadSuppliers(), this.fetchProducts()]); }

  private purchaseWorkspaceOwner: number | null = null;
  protected readonly purchaseStages = [ {id: 'prepare', name: 'Por preparar'}, {id: 'receive', name: 'Por recibir'}, {id: 'review', name: 'Por revisar'} ] as const;
  protected purchaseDraftSupplier(id: number | null): string { return this.supplierOptions().find(s => s.id === id)?.nombre || 'Proveedor por seleccionar'; }
  protected purchaseWorkspaceTotal(d: PurchaseWorkspaceDraft): number { return d.lines.reduce((sum,l) => sum + l.quantity * l.unitCost, 0) + d.transport + d.other; }
  protected purchaseWorkspaceItems(stage?: string): PurchaseWorkspaceDraft[] {
    const query = this.purchaseWorkspaceSearch().trim().toLocaleLowerCase('es');
    return this.purchaseWorkspaceDrafts().filter(d => (!stage || d.stage === stage) && (!query || `${this.purchaseDraftSupplier(d.supplierId)} ${d.invoice}`.toLocaleLowerCase('es').includes(query)));
  }
  private purchaseWorkspaceKey(): string { return `yr-purchase-drafts-v1-${this.currentUser()?.id || 0}`; }
  private loadPurchaseWorkspace(): void {
    const owner = this.currentUser()?.id || 0;
    if (this.purchaseWorkspaceOwner !== owner) { this.resetPurchaseDraft(); this.purchaseSupplierId.set(null); this.purchaseWorkspaceId.set(null); this.purchaseExpectedDate.set(''); this.purchaseWorkspaceStage.set('prepare'); this.purchaseReviewOpen.set(false); this.purchaseWorkspaceOwner = owner; this.purchaseDate.set(this.dateKey(new Date().toISOString())); }
    this.purchaseWorkspaceView.set('receipt');
    this.purchaseWorkspaceNotice.set('');
    try {
      const raw = JSON.parse(localStorage.getItem(this.purchaseWorkspaceKey()) || '[]');
      if (!Array.isArray(raw) || raw.some(d => !d || typeof d.id !== 'string' || !Array.isArray(d.lines) || !['prepare','receive','review'].includes(d.stage) || d.lines.some((l: PurchaseDraftLine) => !Number.isFinite(l.productId) || !Number.isFinite(l.quantity) || !Number.isFinite(l.unitCost)))) throw new Error('Invalid drafts');
      this.purchaseWorkspaceDrafts.set(raw);
    } catch { this.purchaseWorkspaceDrafts.set([]); this.purchaseWorkspaceNotice.set('No se pudieron leer los borradores locales. No se sobrescribirán hasta que recargues la página.'); }
  }
  protected savePurchaseWorkspace(): boolean {
    if (this.purchaseModalSaving()) return false;
    if (this.purchaseWorkspaceNotice().startsWith('No se pudieron leer')) return false;
    const id = this.purchaseWorkspaceId() || crypto.randomUUID();
    const draft: PurchaseWorkspaceDraft = {id, expectedDate: this.purchaseExpectedDate(), supplierId: this.purchaseSupplierId(), invoice: this.purchaseInvoiceNumber(), date: this.purchaseDate(), paymentTypeId: this.purchasePaymentTypeId(), transport: this.purchaseTransportCost(), other: this.purchaseOtherDirectCost(), lines: this.purchaseDraftLines().map(l => ({...l})), stage: this.purchaseWorkspaceStage(), updatedAt: new Date().toISOString()};
    const drafts = [draft, ...this.purchaseWorkspaceDrafts().filter(d => d.id !== id)];
    try { localStorage.setItem(this.purchaseWorkspaceKey(), JSON.stringify(drafts)); }
    catch { this.purchaseWorkspaceNotice.set('No se pudo guardar el borrador. Mantén esta ventana abierta e intenta de nuevo.'); return false; }
    this.purchaseWorkspaceDrafts.set(drafts); this.purchaseWorkspaceId.set(id);
    this.purchaseWorkspaceNotice.set('Borrador guardado en este navegador. La foto OCR no se conserva; sus productos sí.');
    return true;
  }
  protected resumePurchaseWorkspace(draft: PurchaseWorkspaceDraft): void {
    if (this.purchaseModalSaving()) return;
    if ((this.purchaseDraftLines().length || this.purchaseInvoiceNumber()) && !this.savePurchaseWorkspace()) return;
    this.resetPurchaseDraft();
    this.purchaseWorkspaceId.set(draft.id); this.purchaseWorkspaceStage.set(draft.stage); this.purchaseExpectedDate.set(draft.expectedDate || '');
    this.purchaseSupplierId.set(draft.supplierId); this.purchaseInvoiceNumber.set(draft.invoice); this.purchaseDate.set(draft.date); this.purchasePaymentTypeId.set(draft.paymentTypeId);
    this.purchaseTransportCost.set(draft.transport); this.purchaseOtherDirectCost.set(draft.other); this.purchaseDraftLines.set(draft.lines.map(l => ({...l})));
    this.purchaseWorkspaceView.set('receipt'); this.purchaseReviewOpen.set(false);
  }
  protected newPurchaseWorkspace(): void {
    if (this.purchaseModalSaving()) return;
    if ((this.purchaseDraftLines().length || this.purchaseInvoiceNumber()) && !this.savePurchaseWorkspace()) return;
    this.resetPurchaseDraft(); this.purchaseSupplierId.set(null); this.purchasePaymentTypeId.set(1); this.purchaseWorkspaceId.set(null); this.purchaseExpectedDate.set(''); this.purchaseWorkspaceStage.set('prepare'); this.purchaseWorkspaceView.set('receipt'); this.purchaseReviewOpen.set(false);
    this.purchaseDate.set(this.dateKey(new Date().toISOString()));
  }
  protected changePurchaseWorkspace(view: 'receipt' | 'board' | 'history'): void {
    if (this.purchaseModalSaving()) return;
    if ((this.purchaseDraftLines().length || this.purchaseInvoiceNumber()) && !this.savePurchaseWorkspace()) return;
    this.purchaseWorkspaceView.set(view);
    this.purchaseMainModalOpen.set(false);
  }
  protected reviewPurchaseWorkspace(): void {
    this.purchaseModalError.set('');
    if (!this.purchaseSupplierId() || !this.purchaseInvoiceNumber().trim() || !this.purchaseDate() || !this.purchaseDraftLines().length || this.purchaseDraftLines().some(l => !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isFinite(l.unitCost) || l.unitCost < 0)) {
      this.purchaseModalError.set('Completa proveedor, factura, fecha y productos con cantidades y costos válidos.'); return;
    }
    this.purchaseWorkspaceStage.set('review');
    if (this.savePurchaseWorkspace()) this.purchaseReviewOpen.set(true);
  }

  protected readonly purchaseMainModalOpen = signal(false);
  protected readonly purchaseModalOpen = signal(false);
  protected readonly purchaseProductPickerOpen = signal(false);
  protected readonly purchaseMainViewMode = signal<PurchaseMainViewMode>('supplier');
  protected readonly purchaseProductSearch = signal('');
  protected readonly purchaseProductCategory = signal('Todas');
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
  protected readonly attendanceTrendPeriod = signal<PayrollTrendPeriod>('week');
  protected readonly payrollTrendPeriod = signal<PayrollTrendPeriod>('week');
  protected readonly salesTrendData = signal<SalesTrendPoint[]>([]);
  protected readonly invoiceMonthlySalesTrendData = signal<SalesTrendPoint[]>([]);
  protected readonly expandedCreditCustomerIds = signal<Set<number>>(new Set());
  protected readonly expandedCreditInvoiceIds = signal<Set<number>>(new Set());
  protected readonly expandedCreditDayKeys = signal<string[]>([]);
  protected readonly expandedCreditDayCustomerKeys = signal<string[]>([]);
  protected readonly currentUser = signal<LoginResponse['user'] | null>(null);
  protected readonly currentUserDisplayName = computed(() => this.currentUser()?.nombre || this.currentUser()?.usuario || 'Usuario');
  protected readonly selectedSelfAttendanceUserId = signal<number | null>(null);
  protected readonly selectedSelfAttendanceUserName = computed(() => {
    const selectedUserId = this.selectedSelfAttendanceUserId();
    const selectedUser = selectedUserId ? this.attendanceUsers().find((user) => user.id === selectedUserId) : null;
    return selectedUser?.name || this.currentUserDisplayName();
  });
  protected readonly selfAttendanceUserOptions = computed(() => {
    const currentUserId = this.currentUser()?.id || 0;
    const users = [...this.attendanceUsers()];

    return users.sort((left, right) => {
      if (left.id === currentUserId) {
        return -1;
      }

      if (right.id === currentUserId) {
        return 1;
      }

      return left.name.localeCompare(right.name, 'es');
    });
  });
  protected readonly payrollNavCollapsed = signal(true);
  protected readonly financeNavCollapsed = signal(true);
  protected readonly userMenuOpen = signal(false);
  protected readonly selfAttendanceMarkModalOpen = signal(false);
  protected readonly selfAttendanceMarkSaving = signal(false);
  protected readonly selfAttendanceMarkError = signal('');
  protected readonly selfAttendanceMarkSuccess = signal('');
  protected readonly selfAttendanceToastMessage = signal('');
  protected readonly selfAttendanceToastVariant = signal<'success' | 'error'>('success');
  protected readonly activePage = signal<Page>('billing');
  protected readonly activeMode = signal<Mode>('sale');
  protected readonly searchTerm = signal('');
  protected readonly selectedCategory = signal('Todas');
  protected readonly inventoryStatusFilter = signal<InventoryOperationalStatus>('Todos');
  protected readonly inventoryExpiryFilter = signal<InventoryExpiryFilter>('Todos');
  protected readonly quickInventoryReductionReasons = [
    'Producto vencido',
    'Producto dañado',
    'Merma',
    'Uso interno',
    'Muestra o degustacion',
    'Diferencia de inventario',
    'Robo o perdida',
    'Devolucion a proveedor',
  ];
  protected readonly inventoryDetailModalOpen = signal(false);
  protected readonly inventoryDetailLoading = signal(false);
  protected readonly inventoryDetailError = signal('');
  protected readonly selectedInventoryDetail = signal<ProductInventoryDetail | null>(null);
  protected readonly activeInventoryDetailTab = signal<InventoryDetailTab>('photo');
  protected readonly inventoryDetailExpandedSections = signal<Record<InventoryMovementSection, boolean>>({
    entries: true,
    exits: true,
  });
  protected readonly inventoryDetailSummaryModes = signal<Record<InventoryMovementSection, InventoryMovementSummaryMode>>({
    entries: 'daily',
    exits: 'daily',
  });
  protected readonly inventoryModalOpen = signal(false);
  protected readonly assembledOfferModalOpen = signal(false);
  protected readonly assembledOffersListModalOpen = signal(false);
  protected readonly assembledOfferDetailModalOpen = signal(false);
  protected readonly assembledOfferProductPickerOpen = signal(false);
  protected readonly assembledOfferLoading = signal(false);
  protected readonly assembledOfferSaving = signal(false);
  protected readonly assembledOfferError = signal('');
  protected readonly assembledOfferMessage = signal('');
  protected readonly assembledOffers = signal<AssembledOffer[]>([]);
  protected readonly assembledOfferSearch = signal('');
  protected readonly assembledOfferEditingId = signal<number | null>(null);
  protected readonly selectedAssembledOffer = signal<AssembledOffer | null>(null);
  protected readonly assembledOfferDraft = signal<AssembledOfferDraft>(this.createEmptyAssembledOfferDraft());
  protected readonly settingsModalOpen = signal(false);
  protected readonly activeSettingsTab = signal<SettingsTabId>('appearance');
  protected readonly themeMenuOpen = signal(false);
  protected readonly activeThemeId = signal<ThemeId>('black-green');
  protected readonly systemFont = signal<SystemFontId>('inter');
  protected readonly interfaceDensity = signal<InterfaceDensity>('normal');
  protected readonly defaultTableRows = signal(10);
  protected readonly dashboardDefaultRange = signal('month');
  protected readonly billingConfirmSale = signal(true);
  protected readonly billingPrintAfterSale = signal(false);
  protected readonly inventoryShowInactive = signal(false);
  protected readonly inventoryExpiryAlertDays = signal(30);
  protected readonly profitabilityDefaultRange = signal('month');
  protected readonly notificationsVisual = signal(true);
  protected readonly notificationsSound = signal(false);
  protected readonly systemAutoRefresh = signal(false);
  protected readonly databaseBackupConfig = signal<DatabaseBackupConfig>({
    enabled: false,
    frequency: 'daily',
    time: '23:00',
    maxBackups: 15,
    backupDir: '',
  });
  protected readonly databaseBackups = signal<DatabaseBackupRow[]>([]);
  protected readonly databaseBackupLatest = signal<DatabaseBackupRow | null>(null);
  protected readonly databaseBackupLoading = signal(false);
  protected readonly databaseBackupSaving = signal(false);
  protected readonly databaseBackupRunning = signal(false);
  protected readonly databaseBackupRestoring = signal(false);
  protected readonly databaseBackupMessage = signal('');
  protected readonly databaseBackupError = signal('');
  protected readonly modalTables = new ModalTableState();
  protected readonly catalogExporting = signal(false);
  protected readonly modalSummaries = signal<Record<string, boolean>>({});
  protected toggleModalSummary(key: string): void { this.modalSummaries.update(all => ({ ...all, [key]: !all[key] })); }
  protected readonly billingTableConfigs: Record<string, ModalTableConfig> = {"customers": {"columns": [{"key": "id", "label": "ID"}, {"key": "nombre", "label": "Nombre"}, {"key": "apellido", "label": "Apellido"}, {"key": "telefono", "label": "Teléfono"}, {"key": "direccion", "label": "Dirección"}, {"key": "creditosAbiertos", "label": "Créditos"}, {"key": "saldo", "label": "Saldo"}, {"key": "fechaHora", "label": "Fecha"}]}, "suppliers": {"columns": [{"key": "id", "label": "ID"}, {"key": "nombre", "label": "Nombre"}, {"key": "telefono", "label": "Teléfono"}, {"key": "direccion", "label": "Dirección"}, {"key": "creditoAbierto", "label": "Crédito abierto"}, {"key": "comprasRealizadas", "label": "Compras realizadas"}, {"key": "fechaHora", "label": "Fecha"}]}, "cuts": {"columns": [{"key": "id", "label": "N.º"}, {"key": "date", "label": "Fecha"}, {"key": "totalSales", "label": "Total"}, {"key": "userName", "label": "Usuario"}, {"key": "statusName", "label": "Estado"}], "filterKey": "statusName", "filterLabel": "Estado"}, "expiry": {"columns": [{"key": "sku", "label": "Código"}, {"key": "productName", "label": "Producto"}, {"key": "category", "label": "Categoría"}, {"key": "entryDate", "label": "Ingreso"}, {"key": "lotNumber", "label": "Lote"}, {"key": "stock", "label": "Stock"}, {"key": "expiryDate", "label": "Vence"}, {"key": "daysRemaining", "label": "Días"}], "filterKey": "category", "filterLabel": "Categoría"}, "lowstock": {"columns": [{"key": "sku", "label": "Código"}, {"key": "name", "label": "Producto"}, {"key": "stock", "label": "Stock"}, {"key": "minStock", "label": "Mínimo"}, {"key": "unitCost", "label": "Costo"}, {"key": "salePrice", "label": "Precio"}]}, "quoteLines": {"columns": [{"key": "productName", "label": "Producto"}, {"key": "quantity", "label": "Cantidad"}, {"key": "salePrice", "label": "Precio"}, {"key": "total", "label": "Total"}]}, "catalog": {"columns": [{"key": "sku", "label": "Código"}, {"key": "name", "label": "Producto"}, {"key": "category", "label": "Categoría"}, {"key": "salePrice", "label": "Precio"}], "filterKey": "category", "filterLabel": "Categoría"}, "quotes": {"columns": [{"key": "number", "label": "Cotización"}, {"key": "customerName", "label": "Cliente"}, {"key": "createdAt", "label": "Fecha"}, {"key": "subtotal", "label": "Total"}]}};
  protected readonly summaryCollapsed = signal(false);
  protected readonly inventorySummaryCollapsed = signal(false);
  protected readonly kardexSummaryCollapsed = signal(false);
  protected readonly componentSummaryCollapsed = signal(false);
  protected readonly kardexRowDensity = signal<'compact' | 'normal' | 'spacious'>('normal');
  protected readonly inventoryRowDensity = signal<'compact' | 'normal' | 'spacious'>('normal');
  protected readonly inventoryColumnOptions = signal<Record<string, InventoryColumnOption[]>>({
    main: [
      { key: 'sku', label: 'Código', visible: true }, { key: 'name', label: 'Producto', visible: true },
      { key: 'category', label: 'Categoría', visible: true }, { key: 'stock', label: 'Cantidad', visible: true },
      { key: 'minStock', label: 'Mínimo', visible: true }, { key: 'unitCost', label: 'Costo', visible: true },
      { key: 'salePrice', label: 'Precio final', visible: true }, { key: 'expiry', label: 'Vencimiento', visible: true },
      { key: 'status', label: 'Estado', visible: true }, { key: 'actions', label: 'Acción', visible: true },
    ],
    barcodes: [{ key: 'code', label: 'Código', visible: true }, { key: 'status', label: 'Estado', visible: true }, { key: 'primary', label: 'Principal', visible: true }, { key: 'actions', label: 'Acción', visible: true }],
    offers: [{ key: 'sku', label: 'Código', visible: true }, { key: 'image', label: 'Imagen', visible: true }, { key: 'name', label: 'Nombre', visible: true }, { key: 'price', label: 'Precio oferta', visible: true }, { key: 'start', label: 'Inicio', visible: true }, { key: 'end', label: 'Fin', visible: true }, { key: 'status', label: 'Estado', visible: true }, { key: 'products', label: 'Productos incluidos', visible: true }, { key: 'stock', label: 'Stock disponible', visible: true }, { key: 'reason', label: 'Motivo', visible: true }, { key: 'actions', label: 'Acciones', visible: true }],
    components: [{ key: 'sku', label: 'Código', visible: true }, { key: 'name', label: 'Producto', visible: true }, { key: 'quantity', label: 'Cantidad', visible: true }, { key: 'gift', label: 'Regalía', visible: true }, { key: 'stock', label: 'Stock producto', visible: true }, { key: 'max', label: 'Máximo por componente', visible: true }],
    picker: [{ key: 'sku', label: 'Código', visible: true }, { key: 'name', label: 'Nombre', visible: true }, { key: 'stock', label: 'Stock disponible', visible: true }, { key: 'price', label: 'Precio', visible: true }, { key: 'select', label: 'Selección', visible: true }],
    inactive: [{ key: 'sku', label: 'Código', visible: true }, { key: 'name', label: 'Producto', visible: true }, { key: 'category', label: 'Categoría', visible: true }, { key: 'cost', label: 'Último costo', visible: true }, { key: 'price', label: 'Último precio', visible: true }, { key: 'stock', label: 'Stock', visible: true }, { key: 'status', label: 'Estado', visible: true }, { key: 'date', label: 'Fecha de inactivación', visible: true }, { key: 'actions', label: 'Acciones', visible: true }],
    kardex: [{ key: 'sku', label: 'Código', visible: true }, { key: 'name', label: 'Producto', visible: true }, { key: 'category', label: 'Categoría', visible: true }, { key: 'stock', label: 'Stock', visible: true }, { key: 'minStock', label: 'Mínimo', visible: true }, { key: 'cost', label: 'Costo', visible: true }, { key: 'price', label: 'Precio final', visible: true }, { key: 'supplier', label: 'Proveedor', visible: true }, { key: 'actions', label: 'Acciones', visible: true }],
  });
  protected inventoryColumns(kind: string): InventoryColumnOption[] { return this.inventoryColumnOptions()[kind] ?? []; }
  protected inventoryColumnVisible(kind: string, column: string): boolean { return this.inventoryColumns(kind).find(item => item.key === column)?.visible ?? true; }
  protected toggleInventoryColumn(kind: string, column: string): void {
    const items = this.inventoryColumns(kind);
    const current = items.find(item => item.key === column);
    if (!current || (current.visible && items.filter(item => item.visible).length === 1)) return;
    this.inventoryColumnOptions.update(all => ({ ...all, [kind]: items.map(item => item.key === column ? { ...item, visible: !item.visible } : item) }));
    this.saveInventoryColumns();
    this.applyInventoryColumnOrder(kind);
  }
  protected moveInventoryColumn(kind: string, column: string, direction: -1 | 1): void {
    const items = [...this.inventoryColumns(kind)], index = items.findIndex(item => item.key === column), target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    this.inventoryColumnOptions.update(all => ({ ...all, [kind]: items }));
    this.saveInventoryColumns();
    this.applyInventoryColumnOrder(kind);
  }
  protected resetInventoryColumns(kind: string): void {
    const defaults = this.inventoryColumnOptions()[kind]?.map(item => ({ ...item, visible: true })) ?? [];
    this.inventoryColumnOptions.update(all => ({ ...all, [kind]: defaults.sort((a, b) => ['sku','name','category','stock','minStock','unitCost','salePrice','expiry','status','actions'].indexOf(a.key) - ['sku','name','category','stock','minStock','unitCost','salePrice','expiry','status','actions'].indexOf(b.key)) }));
    this.saveInventoryColumns();
    this.applyInventoryColumnOrder(kind);
  }
  protected applyInventoryColumnOrder(kind: string): void {
    queueMicrotask(() => {
      const table = document.querySelector<HTMLTableElement>(`table[data-inventory-columns="${kind}"]`);
      if (!table) return;
      const order = this.inventoryColumns(kind).map(item => item.key);
      table.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
        const direct = Array.from(row.children) as HTMLElement[];
        direct.slice(1).forEach((cell, index) => { if (!cell.dataset['inventoryColumn'] && order[index]) cell.dataset['inventoryColumn'] = order[index]; });
        const cells = new Map(Array.from(row.querySelectorAll<HTMLElement>(':scope > [data-inventory-column]')).map(cell => [cell.dataset['inventoryColumn'], cell]));
        order.forEach(key => { const cell = cells.get(key); if (cell) { cell.hidden = !this.inventoryColumnVisible(kind, key); row.appendChild(cell); } });
      });
    });
  }
  private saveInventoryColumns(): void { localStorage.setItem('yr.inventory.columns', JSON.stringify(this.inventoryColumnOptions())); }
  private restoreInventoryColumns(): void {
    try {
      const saved = JSON.parse(localStorage.getItem('yr.inventory.columns') ?? '{}') as Record<string, InventoryColumnOption[]>;
      const current = this.inventoryColumnOptions();
      if (Array.isArray(saved['main']) && saved['main'].length === current['main'].length && saved['main'].every(item => current['main'].some(column => column.key === item.key))) {
        this.inventoryColumnOptions.set({ ...current, main: saved['main'].map(item => ({ key: item.key, label: current['main'].find(column => column.key === item.key)?.label ?? item.label, visible: item.visible !== false })) });
        this.applyInventoryColumnOrder('main');
      }
    } catch { /* Invalid local preference falls back to the default layout. */ }
  }
  protected readonly checkoutCollapsed = signal(false);
  protected readonly categoryListPage = signal(1);
  protected readonly categoryListPageCount = computed(() => Math.max(1, Math.ceil(this.categories().length / 10)));
  protected readonly visibleCategoryListPage = computed(() => Math.min(this.categoryListPage(), this.categoryListPageCount()));
  protected readonly paginatedCategories = computed(() => this.categories().slice((this.visibleCategoryListPage() - 1) * 10, this.visibleCategoryListPage() * 10));

  protected selectBillingCategory(category: string): void {
    this.selectedCategory.set(category);
    this.billingPage.set(1);
    this.inventoryPage.set(1);
  }


  protected closeBillingActionsOutside(event: Event, menu: HTMLDetailsElement): void {
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) {
      menu.open = false;
    }
  }

  protected readonly billingPage = signal(1);
  protected readonly billingPageSize = signal(15);
  protected readonly billingPageSizeOptions = [15, 30, 45, 60, 100];
  protected readonly costsPage = signal(1);
  protected readonly costsPageSize = 12;
  protected readonly inventoryPage = signal(1);
  protected readonly inventoryTableDensities = signal<Record<string, 'compact' | 'normal' | 'spacious'>>({});
  protected inventoryTableDensity(kind: InventoryTableKind): 'compact' | 'normal' | 'spacious' { return this.inventoryTableDensities()[kind] ?? 'normal'; }
  protected setInventoryTableDensity(kind: InventoryTableKind, density: 'compact' | 'normal' | 'spacious'): void { this.inventoryTableDensities.update(all => ({ ...all, [kind]: density })); }
  protected readonly inventoryAuxSearch = signal<Record<string, string>>({});
  private readonly inventoryAuxPages = signal<Record<string, number>>({});
  private readonly inventoryAuxSizes = signal<Record<string, number>>({});
  private isInventoryAuxTable(kind: InventoryTableKind): boolean { return kind === 'barcodes' || kind === 'components' || kind === 'picker'; }
  protected updateInventoryAuxSearch(kind: InventoryTableKind, event: Event): void {
    this.inventoryAuxSearch.update(all => ({ ...all, [kind]: (event.target as HTMLInputElement).value }));
    this.setInventoryUiPage(kind, 1);
    this.showInventoryUiResults(kind);
  }
  private filterInventoryAuxRows<T extends object>(rows: T[], kind: InventoryTableKind): T[] {
    const query = this.normalizeText((this.inventoryAuxSearch()[kind] ?? '').trim());
    return rows.filter(row => !query || this.normalizeText(Object.values(row).filter(value => typeof value === 'string' || typeof value === 'number').join(' ')).includes(query));
  }
  protected inventoryAuxPageRows<T extends object>(rows: T[], kind: InventoryTableKind): T[] {
    const sorted = this.sortInventoryUiRows(this.filterInventoryAuxRows(rows, kind), kind);
    const start = (this.inventoryUiPage(kind) - 1) * this.inventoryUiSize(kind);
    return sorted.slice(start, start + this.inventoryUiSize(kind));
  }
  private resetInventoryAuxTable(kind: InventoryTableKind): void {
    this.inventoryAuxSearch.update(all => ({ ...all, [kind]: '' }));
    this.inventoryAuxPages.update(all => ({ ...all, [kind]: 1 }));
    this.clearInventoryUiSelection(kind);
  }
  protected readonly inventoryUiSelection = signal<Record<string,Set<number>>>({});
  protected inventoryUiSelected(kind:InventoryTableKind,id:number):boolean {return this.inventoryUiSelection()[kind]?.has(id) ?? false;}
  protected toggleInventoryUiSelected(kind:InventoryTableKind,id:number):void {this.inventoryUiSelection.update(all=>{const ids=new Set(all[kind]);ids.has(id)?ids.delete(id):ids.add(id);return {...all,[kind]:ids};});}
  protected inventoryUiSelectionCount(kind:InventoryTableKind):number {return this.inventoryUiSelection()[kind]?.size ?? 0;}
  protected clearInventoryUiSelection(kind:InventoryTableKind):void {this.inventoryUiSelection.update(all=>({...all,[kind]:new Set()}));}
  protected exportInventoryUiSelection(kind:InventoryTableKind):void {
    let headers = ['Código', 'Producto', 'Stock', 'Precio'];
    let values: unknown[][];
    if (kind === 'barcodes') {
      headers = ['Código', 'Estado', 'Principal'];
      values = (this.productBarcodeTarget()?.barcodes ?? []).filter(row => this.inventoryUiSelected(kind, row.id)).map(row => [row.code, row.active ? 'Activo' : 'Inactivo', row.isPrimary ? 'Sí' : 'No']);
    } else if (kind === 'components') {
      headers = ['Código', 'Producto', 'Cantidad', 'Regalía', 'Stock'];
      values = (this.selectedAssembledOffer()?.components ?? []).filter(row => this.inventoryUiSelected(kind, row.productId)).map(row => [row.sku, row.name, row.quantity, row.isGift ? 'Sí' : 'No', row.stock]);
    } else {
      const rows = kind === 'main' ? this.products() : kind === 'inactive' ? this.inactiveProducts() : kind === 'kardex' ? this.outOfStockProducts() : kind === 'picker' ? this.assembledOfferPickerProducts() : this.assembledOffers();
      values = rows.filter(row => this.inventoryUiSelected(kind, row.id)).map(row => [row.sku, row.name, row.stock, row.salePrice]);
    }
    if (!values.length) return;
    const cell = (value: unknown) => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const csv = [headers, ...values].map(row => row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='inventario-'+kind+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  protected readonly inventoryConfirmText = signal('');
  private inventoryConfirmResolve: ((value:boolean)=>void) | null = null;
  private confirmInventoryUi(text:string):Promise<boolean> {
    if(this.inventoryConfirmResolve)return Promise.resolve(false);
    this.inventoryConfirmText.set(text);
    return new Promise(resolve=>{this.inventoryConfirmResolve=resolve;document.querySelector<HTMLDialogElement>('#yr-inventory-confirm')?.showModal();requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('#yr-inventory-confirm .yr-annul-cancel')?.focus());});
  }
  protected resolveInventoryUiConfirm(confirmed:boolean):void {document.querySelector<HTMLDialogElement>('#yr-inventory-confirm')?.close();this.inventoryConfirmResolve?.(confirmed);this.inventoryConfirmResolve=null;}
  protected readonly inventoryUiSizes = [10,25,50,100];
  protected readonly inventoryUiSort = signal<Record<string,{key:string;direction:1|-1}>>({});
  protected readonly inventoryUiNotice = signal<InventoryTableKind | null>(null);
  private inventoryUiNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly kardexSearch = signal('');
  protected readonly offersUiPage = signal(1);
  protected readonly offersUiSize = signal(10);
  protected readonly filteredKardexProducts = computed(() => {
    const query=this.normalizeText(this.kardexSearch().trim());
    return this.outOfStockProducts().filter(p=>!query || this.normalizeText([p.sku,p.name,p.category].join(' ')).includes(query));
  });
  protected readonly offersUiPages = computed(()=>Math.max(1,Math.ceil(this.filteredAssembledOffers().length/this.offersUiSize())));
  protected readonly paginatedUiOffers = computed(()=>this.sortInventoryUiRows(this.filteredAssembledOffers(),'offers').slice((this.inventoryUiPage('offers')-1)*this.offersUiSize(),this.inventoryUiPage('offers')*this.offersUiSize()));
  private sortInventoryUiRows<T>(rows:T[],kind:InventoryTableKind):T[] {
    const sort=this.inventoryUiSort()[kind]; if(!sort) return rows;
    return [...rows].sort((a,b)=>{const av=(a as Record<string,unknown>)[sort.key],bv=(b as Record<string,unknown>)[sort.key];return (typeof av==='number' && typeof bv==='number' ? av-bv : String(av??'').localeCompare(String(bv??''),'es',{numeric:true,sensitivity:'base'}))*sort.direction;});
  }
  protected sortInventoryUi(kind:InventoryTableKind,key:string):void {
    this.inventoryUiSort.update(all=>({...all,[kind]:{key,direction:all[kind]?.key===key && all[kind].direction===1 ? -1 : 1}}));this.setInventoryUiPage(kind,1);
  }
  protected inventoryUiSortLabel(kind:InventoryTableKind,key:string):string { const s=this.inventoryUiSort()[kind];return s?.key===key ? (s.direction===1?'↑':'↓'):'↕'; }
  protected inventoryUiAriaSort(kind:InventoryTableKind,key:string):string {const s=this.inventoryUiSort()[kind];return s?.key===key ? (s.direction===1?'ascending':'descending'):'none';}
  protected inventoryUiCount(kind:InventoryTableKind):number {
    if (kind === 'barcodes') return this.filterInventoryAuxRows(this.productBarcodeTarget()?.barcodes ?? [], kind).length;
    if (kind === 'components') return this.filterInventoryAuxRows(this.selectedAssembledOffer()?.components ?? [], kind).length;
    if (kind === 'picker') return this.filterInventoryAuxRows(this.assembledOfferPickerProducts(), kind).length;
    return kind==='main'?this.filteredProducts().length:kind==='inactive'?this.filteredInactiveProducts().length:kind==='kardex'?this.filteredKardexProducts().length:this.filteredAssembledOffers().length;}
  protected inventoryUiSize(kind:InventoryTableKind):number {if(this.isInventoryAuxTable(kind)) return this.inventoryAuxSizes()[kind] ?? 10; return kind==='main'?this.inventoryPageSize():kind==='inactive'?this.inactiveProductsPageSize():kind==='kardex'?this.kardexPageSize():this.offersUiSize();}
  protected inventoryUiPages(kind:InventoryTableKind):number {return Math.max(1,Math.ceil(this.inventoryUiCount(kind)/this.inventoryUiSize(kind)));}
  protected inventoryUiPage(kind:InventoryTableKind):number {if(this.isInventoryAuxTable(kind)) return Math.min(this.inventoryAuxPages()[kind] ?? 1, this.inventoryUiPages(kind)); return Math.min(kind==='main'?this.inventoryPage():kind==='inactive'?this.inactiveProductsPage():kind==='kardex'?this.kardexPage():this.offersUiPage(),this.inventoryUiPages(kind));}
  protected setInventoryUiPage(kind:InventoryTableKind,page:number):void {const value=Math.max(1,Math.min(page,this.inventoryUiPages(kind)));if(this.isInventoryAuxTable(kind)){this.inventoryAuxPages.update(all=>({...all,[kind]:value}));return;}(kind==='main'?this.inventoryPage:kind==='inactive'?this.inactiveProductsPage:kind==='kardex'?this.kardexPage:this.offersUiPage).set(value);}
  protected setInventoryUiSize(kind:InventoryTableKind,event:Event):void {const size=Number((event.target as HTMLSelectElement).value);if(!this.inventoryUiSizes.includes(size))return;if(this.isInventoryAuxTable(kind)){this.inventoryAuxSizes.update(all=>({...all,[kind]:size}));this.setInventoryUiPage(kind,1);this.showInventoryUiResults(kind);return;}(kind==='main'?this.inventoryPageSize:kind==='inactive'?this.inactiveProductsPageSize:kind==='kardex'?this.kardexPageSize:this.offersUiSize).set(size);this.setInventoryUiPage(kind,1);this.showInventoryUiResults(kind);}
  protected showInventoryUiResults(kind:InventoryTableKind):void {if(this.inventoryUiNoticeTimer)clearTimeout(this.inventoryUiNoticeTimer);this.inventoryUiNotice.set(kind);this.inventoryUiNoticeTimer=setTimeout(()=>this.inventoryUiNotice.set(null),3500);}
  protected updateKardexSearch(event:Event):void {this.kardexSearch.set((event.target as HTMLInputElement).value);this.kardexPage.set(1);this.showInventoryUiResults('kardex');}
  protected readonly inventoryPageSize = signal(10);
  protected readonly inactiveProductsPageSize = signal(10);
  protected readonly kardexPage = signal(1);
  protected readonly kardexPageSize = signal(10);
  protected readonly themes: ThemeOption[] = [
    { id: 'black-green', name: 'Black green', tone: 'Oscuro' },
    { id: 'forest-light', name: 'Bosque claro', tone: 'Claro' },
    { id: 'steel-light', name: 'Acero claro', tone: 'Claro' },
    { id: 'ember-dark', name: 'Carbon gradiente', tone: 'Oscuro' },
    { id: 'emerald-dark', name: 'Esmeralda gradiente', tone: 'Oscuro' },
    { id: 'analytics-dark', name: 'Analytics noche', tone: 'Oscuro' },
    { id: 'crm-dark', name: 'CRM neon', tone: 'Oscuro' },
    { id: 'combo-mono', name: 'Combo mono', tone: '#2F2F33 / #F5F6F7' },
    { id: 'soft-blue', name: 'Soft blue', tone: '#ADDFF1 / #003152' },
    { id: 'deep-onyx', name: 'Deep onyx', tone: '#07191E / #02F5A1' },
    { id: 'monaco-orange', name: 'Monaco orange', tone: '#000000 / #EE7900' },
    { id: 'uniform-yellow', name: 'Uniform yellow', tone: '#122837 / #FBFC09' },
    { id: 'red-combo', name: 'Red combo', tone: '#000F08 / #FB3640' },
    { id: 'coral-black', name: 'Coral black', tone: '#171616 / #F95C4B' },
  ];
  protected readonly settingsTabs: SettingsTab[] = [
    { id: 'appearance', label: 'Apariencia' },
    { id: 'menu', label: 'Menu' },
    { id: 'tables', label: 'Tablas' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'billing', label: 'Facturacion' },
    { id: 'inventory', label: 'Inventario' },
    { id: 'profitability', label: 'Rentabilidad' },
    { id: 'notifications', label: 'Avisos' },
    { id: 'backup', label: 'Respaldo' },
    { id: 'system', label: 'Sistema' },
  ];
  protected readonly systemFontOptions: SystemFontOption[] = [
    { id: 'inter', label: 'Inter', value: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    { id: 'segoe', label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
    { id: 'aptos', label: 'Aptos', value: 'Aptos, Calibri, "Segoe UI", sans-serif' },
    { id: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { id: 'calibri', label: 'Calibri', value: 'Calibri, Aptos, "Segoe UI", sans-serif' },
    { id: 'verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { id: 'trebuchet', label: 'Trebuchet MS', value: '"Trebuchet MS", "Segoe UI", sans-serif' },
    { id: 'tahoma', label: 'Tahoma', value: 'Tahoma, Geneva, Verdana, sans-serif' },
    { id: 'georgia', label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
    { id: 'times', label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { id: 'cambria', label: 'Cambria', value: 'Cambria, Georgia, serif' },
    { id: 'consolas', label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
    { id: 'courier', label: 'Courier New', value: '"Courier New", Courier, monospace' },
  ];

  protected readonly inventoryStatusOptions: InventoryOperationalStatus[] = ['Todos', 'Disponible', 'Stock bajo', 'Agotado'];
  protected readonly inventoryExpiryOptions: InventoryExpiryFilter[] = ['Todos', 'Vigente', 'Vence pronto', 'Vencido', 'Sin fecha'];

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE ARREGLO DEFINE LAS FORMAS DE PAGO DISPONIBLES EN EL FORMULARIO DE VENTA.
  protected readonly paymentMethodOptions: Array<{ id: PaymentMethod; paymentTypeId: number; label: string; shortLabel: string }> = [
    { id: 'efectivo', paymentTypeId: 1, label: 'Efectivo', shortLabel: 'EF' },
    { id: 'credito', paymentTypeId: 2, label: 'Credito', shortLabel: 'CR' },
    { id: 'transferencia', paymentTypeId: 3, label: 'Transferencia', shortLabel: 'TR' },
  ];
  protected readonly creditPaymentMethodOptions: Array<{ id: CreditPaymentMethod; label: string }> = [
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'efectivo', label: 'Efectivo' },
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

  protected auditDataParts(value: string): AuditDataPart[] {
    return this.parseAuditDataParts(value, 6);
  }

  protected auditLogDetailParts(value: string): AuditDataPart[] {
    return this.parseAuditDataParts(value);
  }

  protected auditStockDataPart(value: string): AuditDataPart | null {
    return this.parseAuditDataParts(value).find((part) => {
      const normalizedKey = this.normalizeText(part.key);
      return normalizedKey.includes('stock') || normalizedKey.includes('existencia');
    }) || null;
  }

  protected openAuditLogDetail(record: AuditHistoryRecord): void {
    this.selectedAuditHistoryRecord.set(record);
  }

  protected closeAuditLogDetail(): void {
    this.selectedAuditHistoryRecord.set(null);
  }

  protected setAuditHistorySort(key: AuditHistorySortKey): void {
    if (this.auditHistorySortKey() === key) {
      this.auditHistorySortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      this.auditHistoryPageIndex.set(0);
      return;
    }

    this.auditHistorySortKey.set(key);
    this.auditHistorySortDirection.set(key === 'date' ? 'desc' : 'asc');
    this.auditHistoryPageIndex.set(0);
  }

  protected auditHistorySortLabel(key: AuditHistorySortKey): string {
    if (this.auditHistorySortKey() !== key) {
      return '';
    }

    return this.auditHistorySortDirection() === 'asc' ? 'Asc' : 'Desc';
  }

  protected updateAuditHistoryActionFilter(event: Event): void {
    this.auditHistoryActionFilter.set((event.target as HTMLSelectElement).value);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistoryDateFilter(event: Event): void {
    this.auditHistoryDateFilter.set((event.target as HTMLInputElement).value);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistoryUserFilter(event: Event): void {
    this.auditHistoryUserFilter.set((event.target as HTMLSelectElement).value);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistoryTableFilter(event: Event): void {
    this.auditHistoryTableFilter.set((event.target as HTMLSelectElement).value);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistorySearchFilter(event: Event): void {
    this.auditHistorySearchFilter.set((event.target as HTMLInputElement).value);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistoryPageSize(event: Event): void {
    this.auditHistoryPageSize.set(Number((event.target as HTMLSelectElement).value) || 8);
    this.auditHistoryPageIndex.set(0);
  }

  protected updateAuditHistoryAlignment(event: Event): void {
    this.auditHistoryAlignment.set((event.target as HTMLSelectElement).value as AuditHistoryAlignment);
  }

  protected clearAuditHistoryFilters(): void {
    this.auditHistoryActionFilter.set('all');
    this.auditHistoryDateFilter.set('');
    this.auditHistoryUserFilter.set('all');
    this.auditHistoryTableFilter.set('all');
    this.auditHistorySearchFilter.set('');
    this.auditHistoryPageIndex.set(0);
  }

  protected setAuditHistoryPage(index: number): void {
    const lastPage = this.auditHistoryPageCount() - 1;
    this.auditHistoryPageIndex.set(Math.max(0, Math.min(index, lastPage)));
  }

  protected previousAuditHistoryPage(): void {
    this.setAuditHistoryPage(this.auditHistoryPageIndex() - 1);
  }

  protected nextAuditHistoryPage(): void {
    this.setAuditHistoryPage(this.auditHistoryPageIndex() + 1);
  }

  private parseAuditDataParts(value: string, limit?: number): AuditDataPart[] {
    const parts = String(value || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const visibleParts = typeof limit === 'number' ? parts.slice(0, limit) : parts;

    return visibleParts.map((part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex <= 0) {
        return {
          key: 'Detalle',
          value: part,
          raw: part,
        };
      }

      const key = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();

      return {
        key: this.formatAuditDataKey(key),
        value: rawValue || 'Sin valor',
        raw: part,
      };
    });
  }

  private formatAuditDataKey(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private auditHistorySortValue(record: AuditHistoryRecord, key: AuditHistorySortKey): string | number {
    if (key === 'date') {
      return this.parseAuditDate(record.date)?.getTime() || 0;
    }

    if (key === 'action') {
      return record.action || '';
    }

    if (key === 'table') {
      return record.tableName || '';
    }

    if (key === 'record') {
      return record.recordKey || '';
    }

    if (key === 'user') {
      return record.user || 'Sistema';
    }

    const stockPart = this.auditStockDataPart(key === 'previousStock' ? record.previousData : record.newData);
    const stockValue = Number(stockPart?.value);
    return Number.isFinite(stockValue) ? stockValue : -1;
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

  protected readonly creditsTrendChartSeries = computed<PayrollTrendSeries>(() => {
    const period = this.creditTrendPeriod();
    const groups = new Map<string, { label: string; sortValue: number; totals: Map<number, number> }>();
    const customers = new Map<number, { name: string; total: number }>();

    for (const credit of this.filteredCreditLines()) {
      const date = this.parseDate(credit.createdAt);
      const grouping = this.creditTrendGrouping(date, period);
      const currentGroup = groups.get(grouping.key) || {
        label: grouping.label,
        sortValue: grouping.sortValue,
        totals: new Map<number, number>(),
      };
      const pendingAmount = this.roundMoney(credit.pendingAmount);

      currentGroup.totals.set(credit.customerId, this.roundMoney((currentGroup.totals.get(credit.customerId) || 0) + pendingAmount));
      groups.set(grouping.key, currentGroup);

      const currentCustomer = customers.get(credit.customerId) || { name: credit.customerName, total: 0 };
      currentCustomer.total = this.roundMoney(currentCustomer.total + pendingAmount);
      customers.set(credit.customerId, currentCustomer);
    }

    const orderedGroups = [...groups.values()].sort((a, b) => a.sortValue - b.sortValue);
    const orderedCustomers = [...customers.entries()].sort((a, b) => b[1].total - a[1].total);

    return {
      labels: orderedGroups.map((group) => group.label),
      datasets: orderedCustomers.map(([customerId, customer]) => ({
        label: customer.name,
        data: orderedGroups.map((group) => this.roundMoney(group.totals.get(customerId) || 0)),
      })),
    };
  });

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO AGRUPA LOS CREDITOS ABIERTOS POR NUMERO DE FACTURA PARA LA TABLA MASTER COLAPSABLE.
  // USA LOS DATOS DE filteredCreditLines(), QUE VIENEN DE loadCredits() Y LA CONSULTA listCredits() EN server/data-access.js.
  protected readonly creditInvoiceGroups = computed<CreditInvoiceGroup[]>(() => {
    const groups = new Map<number, CreditInvoiceGroup>();

    for (const credit of this.filteredCreditLines()) {
      const existingGroup = groups.get(credit.invoiceId);

      if (existingGroup) {
        existingGroup.total += credit.pendingAmount;
        existingGroup.originalTotal += credit.total;
        existingGroup.paidAmount += credit.paidAmount;
        existingGroup.pendingAmount += credit.pendingAmount;
        existingGroup.utility += credit.utility;
        existingGroup.lines.push(credit);
        existingGroup.saleStatusName = existingGroup.pendingAmount > 0 ? 'Activo' : 'Cerrado';
        existingGroup.invoicePaymentMethod = this.mergeCreditPaymentMethodLabels(
          existingGroup.invoicePaymentMethod,
          credit.invoicePaymentMethod,
        );
        continue;
      }

      const pendingAmount = Number(credit.pendingAmount || 0);
      groups.set(credit.invoiceId, {
        invoiceId: credit.invoiceId,
        customerId: credit.customerId,
        customerName: credit.customerName,
        customerPhone: credit.customerPhone,
        openCredits: credit.openCredits,
        customerBalance: credit.customerBalance,
        saleStatusName: pendingAmount > 0 ? 'Activo' : 'Cerrado',
        invoicePaymentMethod: credit.invoicePaymentMethod || 'Sin abono',
        total: pendingAmount,
        originalTotal: Number(credit.total || 0),
        paidAmount: Number(credit.paidAmount || 0),
        pendingAmount,
        utility: credit.utility,
        createdAt: credit.createdAt,
        lines: [credit],
      });
    }

    return [...groups.values()].sort((a, b) => {
      const openA = a.pendingAmount > 0 ? 0 : 1;
      const openB = b.pendingAmount > 0 ? 0 : 1;

      if (openA !== openB) {
        return openA - openB;
      }

      return b.invoiceId - a.invoiceId;
    });
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
        existingGroup.invoices.sort((a, b) => {
          const openA = a.pendingAmount > 0 ? 0 : 1;
          const openB = b.pendingAmount > 0 ? 0 : 1;

          if (openA !== openB) {
            return openA - openB;
          }

          return b.invoiceId - a.invoiceId;
        });
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

  protected readonly creditDayGroups = computed<CreditDayGroup[]>(() => {
    const dayMap = new Map<string, CreditInvoiceGroup[]>();

    for (const invoice of this.creditInvoiceGroups()) {
      const dayKey = this.dateKey(invoice.createdAt);
      dayMap.set(dayKey, [...(dayMap.get(dayKey) || []), invoice]);
    }

    return [...dayMap.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, invoices]) => {
        const customerMap = new Map<number, CreditCustomerGroup>();

        for (const invoice of invoices) {
          const existingGroup = customerMap.get(invoice.customerId);

          if (existingGroup) {
            existingGroup.total += invoice.total;
            existingGroup.utility += invoice.utility;
            existingGroup.articleCount += invoice.lines.length;
            existingGroup.invoices.push(invoice);
            existingGroup.invoices.sort((a, b) => b.invoiceId - a.invoiceId);
            continue;
          }

          customerMap.set(invoice.customerId, {
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

        const customers = [...customerMap.values()].sort((a, b) => b.total - a.total);

        return {
          key,
          label: this.formatInvoiceDayLabel(key),
          customerCount: customers.length,
          articleCount: invoices.reduce((total, invoice) => total + invoice.lines.length, 0),
          total: invoices.reduce((total, invoice) => total + invoice.total, 0),
          utility: invoices.reduce((total, invoice) => total + invoice.utility, 0),
          invoices,
          customers,
        };
      });
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
  protected readonly payrollExpandedMonthKeys = signal<string[]>([]);
  protected readonly payrollExpandedWeekKeys = signal<string[]>([]);
  protected readonly attendanceMarkModalOpen = signal(false);
  protected readonly attendanceMarkSaving = signal(false);
  protected readonly attendanceMarkError = signal('');
  protected readonly attendanceMarkUserId = signal<number | null>(null);
  protected readonly attendanceMarkDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly attendanceMarkEntryTime = signal('08:00');
  protected readonly attendanceMarkExitTime = signal('17:00');
  protected readonly selectedAttendanceWeek = signal<number | null>(null);
  protected readonly selectedPayrollMonth = signal('');
  protected readonly payrollBonuses = signal<PayrollBonusMatrix>({});
  protected readonly payrollSaving = signal(false);
  protected readonly payrollSaveMessage = signal('');
  protected readonly payrollSaveError = signal('');
  protected readonly payrollToastMessage = signal('');
  protected readonly payrollToastVariant = signal<'success' | 'error'>('success');
  protected readonly payrollDatabaseRecords = signal<PayrollDatabaseRecord[]>([]);
  protected readonly payrollImageModalOpen = signal(false);
  protected readonly payrollImageExpandedRowKeys = signal<string[]>([]);
  protected readonly payrollImageExpandedWeekKeys = signal<string[]>([]);
  protected readonly editableImagePayrollRows = signal<ImagePayrollEditableRows>({});
  protected readonly editableImagePayrollBonuses = signal<Record<string, number>>({});
  protected readonly payrollWeekEditModalOpen = signal(false);
  protected readonly payrollWeekEditDraft = signal<PayrollWeekEditDraft | null>(null);
  protected readonly payrollWeekEditSaving = signal(false);
  protected readonly payrollWeekEditError = signal('');
  protected readonly payrollPlanWeekSelectorModalOpen = signal(false);
  protected readonly selectedPayrollPlanEditWeek = signal<number | null>(null);
  protected readonly payrollPlanEditModalOpen = signal(false);
  protected readonly payrollPlanEditDraft = signal<PayrollPlanEditDraft | null>(null);
  protected readonly payrollPlanEditSaving = signal(false);
  protected readonly payrollPlanEditError = signal('');
  protected readonly payrollScheduleModalOpen = signal(false);
  protected readonly payrollHoursModalOpen = signal(false);
  protected readonly payrollSchedules = signal<PayrollScheduleMatrix>({});
  protected readonly payrollDays: PayrollDay[] = [
    { id: 'sunday', name: 'Domingo' },
    { id: 'monday', name: 'Lunes' },
    { id: 'tuesday', name: 'Martes' },
    { id: 'wednesday', name: 'Miercoles' },
    { id: 'thursday', name: 'Jueves' },
    { id: 'friday', name: 'Viernes' },
    { id: 'saturday', name: 'Sabado' },
  ];
  protected readonly payrollShifts: PayrollShift[] = [
    { id: 'morning', name: 'Diurna', schedule: '8:00 AM - 3:00 PM', rate: 85 },
    { id: 'afternoon', name: 'Mixta', schedule: '3:00 PM - 7:00 PM', rate: 105 },
    { id: 'night', name: 'Nocturna', schedule: '7:00 PM - 11:00 PM', rate: 130 },
  ];
  protected readonly payrollHours = signal<PayrollHoursMatrix>({});
  protected readonly payrollWeekEditTotals = computed<PayrollWeekEditTotals>(() => {
    const draft = this.payrollWeekEditDraft();
    const days = draft?.days || [];
    const normalHours = Number(days.reduce((total, day) => total + day.normalHours, 0).toFixed(2));
    const extra1Hours = Number(days.reduce((total, day) => total + day.extra1Hours, 0).toFixed(2));
    const extra2Hours = Number(days.reduce((total, day) => total + day.extra2Hours, 0).toFixed(2));
    const extra3Hours = Number(days.reduce((total, day) => total + day.extra3Hours, 0).toFixed(2));
    const normalPay = Number((normalHours * payrollNormalRate).toFixed(2));
    const extra1Pay = Number((extra1Hours * payrollExtra1Rate).toFixed(2));
    const extra2Pay = Number((extra2Hours * payrollExtra3WeekdayRate).toFixed(2));
    const extra3Pay = Number((extra3Hours * payrollExtra3WeekendRate).toFixed(2));
    const salary = Number((normalPay + extra1Pay + extra2Pay + extra3Pay).toFixed(2));
    const bonus = Number((draft?.bonus || 0).toFixed(2));

    return {
      normalHours,
      extra1Hours,
      extra2Hours,
      extra3Hours,
      totalHours: Number((normalHours + extra1Hours + extra2Hours + extra3Hours).toFixed(2)),
      normalPay,
      extra1Pay,
      extra2Pay,
      extra3Pay,
      salary,
      bonus,
      total: Number((salary + bonus).toFixed(2)),
    };
  });
  protected readonly payrollPlanEditTotals = computed<PayrollWeekEditTotals>(() => {
    const draft = this.payrollPlanEditDraft();

    return this.calculatePayrollEditTotals(
      draft?.employees.flatMap((employee) => employee.days) || [],
      draft?.employees.reduce((total, employee) => total + employee.bonus, 0) || 0,
    );
  });
  protected readonly categoryTrendLayers = [24, 20, 16, 12, 8, 4];

  protected readonly products = signal<Product[]>([]);
  protected readonly inventoryEditingProductId = signal<number | null>(null);
  protected readonly productBarcodeModalOpen = signal(false);
  protected readonly productBarcodeTarget = signal<Product | null>(null);
  protected readonly productBarcodeDraft = signal('');
  protected readonly productBarcodeLoading = signal(false);
  protected readonly productBarcodeSaving = signal(false);
  protected readonly productBarcodeError = signal('');
  protected readonly inventoryDraft = signal<InventoryDraft>({
    sku: 'NVO-001',
    name: '',
    imageUrl: '',
    category: 'Camisas',
    primaryLotExpiryDate: '',
    stock: 0,
    minStock: 5,
    maxStock: 0,
    unitCost: 0,
    profitPercentage: 0,
    salePrice: 0,
    unitMeasure: 'Unidad',
    allowsDecimalQuantity: false,
  });

  protected readonly cart = signal<CartLine[]>([]);
  protected readonly purchaseCosts = signal<Record<number, number>>({});
  protected readonly salePrices = signal<Record<number, number>>({});
  protected readonly billingInvoiceSessions = signal<BillingInvoiceSession[]>([]);
  protected readonly activeBillingInvoiceId = signal('');

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
  protected readonly selectedAuditHistoryRecord = signal<AuditHistoryRecord | null>(null);
  protected readonly auditHistoryActionFilter = signal('all');
  protected readonly auditHistoryDateFilter = signal('');
  protected readonly auditHistoryUserFilter = signal('all');
  protected readonly auditHistoryTableFilter = signal('all');
  protected readonly auditHistorySearchFilter = signal('');
  protected readonly auditHistoryPageSize = signal(8);
  protected readonly auditHistoryPageIndex = signal(0);
  protected readonly auditHistorySortKey = signal<AuditHistorySortKey>('date');
  protected readonly auditHistorySortDirection = signal<AuditHistorySortDirection>('desc');
  protected readonly auditHistoryAlignment = signal<AuditHistoryAlignment>('left');
  protected readonly activityNotificationsOpen = signal(false);
  protected readonly priceChangeAlertModalOpen = signal(false);
  protected readonly priceChangeAlertMode = signal<'auto' | 'manual'>('manual');
  protected readonly priceChangeAlertPeriod = signal<'week' | 'month'>('week');
  protected readonly priceChangeLastCheckedAt = signal<string | null>(null);
  protected readonly auditHistoryTablesCount = computed(() =>
    new Set(this.auditHistory().map((item) => item.tableName)).size,
  );
  protected readonly auditHistoryLastRecord = computed(() => this.auditHistory()[0] || null);
  protected readonly auditHistoryUsers = computed(() =>
    Array.from(new Set(this.auditHistory().map((item) => item.user || 'Sistema'))).sort((left, right) =>
      left.localeCompare(right, 'es'),
    ),
  );
  protected readonly auditHistoryTables = computed(() =>
    Array.from(new Set(this.auditHistory().map((item) => item.tableName || 'Sin tabla'))).sort((left, right) =>
      left.localeCompare(right, 'es'),
    ),
  );
  protected readonly filteredAuditHistory = computed(() => {
    const actionFilter = this.auditHistoryActionFilter();
    const dateFilter = this.auditHistoryDateFilter();
    const userFilter = this.auditHistoryUserFilter();
    const tableFilter = this.auditHistoryTableFilter();
    const searchFilter = this.normalizeText(this.auditHistorySearchFilter());
    const sortKey = this.auditHistorySortKey();
    const sortDirection = this.auditHistorySortDirection();

    return this.auditHistory()
      .filter((item) => {
        const matchesAction = actionFilter === 'all' || this.auditActionClass(item.action) === actionFilter;
        const parsedDate = this.parseAuditDate(item.date);
        const matchesDate = !dateFilter || (parsedDate ? this.formatDateKey(parsedDate) === dateFilter : false);
        const itemUser = item.user || 'Sistema';
        const matchesUser = userFilter === 'all' || itemUser === userFilter;
        const itemTable = item.tableName || 'Sin tabla';
        const matchesTable = tableFilter === 'all' || itemTable === tableFilter;
        const searchableText = this.normalizeText(
          `${item.user || ''} ${item.tableName || ''} ${item.recordKey || ''} ${item.action || ''}`,
        );
        const matchesSearch = !searchFilter || searchableText.includes(searchFilter);
        return matchesAction && matchesDate && matchesUser && matchesTable && matchesSearch;
      })
      .sort((left, right) => {
        const leftValue = this.auditHistorySortValue(left, sortKey);
        const rightValue = this.auditHistorySortValue(right, sortKey);
        const comparison =
          typeof leftValue === 'number' && typeof rightValue === 'number'
            ? leftValue - rightValue
            : String(leftValue).localeCompare(String(rightValue), 'es', { numeric: true, sensitivity: 'base' });

        return sortDirection === 'asc' ? comparison : -comparison;
      });
  });
  protected readonly auditHistoryPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredAuditHistory().length / this.auditHistoryPageSize())),
  );
  protected readonly auditHistoryPageNumbers = computed(() =>
    Array.from({ length: this.auditHistoryPageCount() }, (_, index) => index),
  );
  protected readonly visibleAuditHistory = computed(() => {
    const pageSize = this.auditHistoryPageSize();
    const safePage = Math.min(this.auditHistoryPageIndex(), this.auditHistoryPageCount() - 1);
    return this.filteredAuditHistory().slice(safePage * pageSize, safePage * pageSize + pageSize);
  });
  protected readonly auditHistoryPaginationLabel = computed(() => {
    const total = this.filteredAuditHistory().length;
    if (total === 0) {
      return 'Mostrando 0 registros';
    }

    const pageSize = this.auditHistoryPageSize();
    const safePage = Math.min(this.auditHistoryPageIndex(), this.auditHistoryPageCount() - 1);
    const start = safePage * pageSize + 1;
    const end = Math.min(start + pageSize - 1, total);
    return `Mostrando ${start} al ${end} de ${total} registros`;
  });
  protected readonly priceChangeAlerts = computed<PriceChangeAlert[]>(() =>
    this.auditHistory()
      .map((record) => this.mapPriceChangeAlert(record))
      .filter((alert): alert is PriceChangeAlert => Boolean(alert))
      .sort((left, right) => new Date(right.changedAt).getTime() - new Date(left.changedAt).getTime()),
  );
  protected readonly todayPriceChangeAlerts = computed(() => {
    const todayKey = this.todayDateKey();
    return this.priceChangeAlerts().filter((alert) => String(alert.changedAt).slice(0, 10) === todayKey);
  });
  protected readonly visiblePriceChangeAlerts = computed(() => {
    const now = new Date();
    const startDate = this.priceChangeAlertPeriod() === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : this.startOfWeek(now);
    const startTime = this.startOfDay(startDate).getTime();

    return this.priceChangeAlerts().filter((alert) => new Date(alert.changedAt).getTime() >= startTime);
  });
  protected readonly priceChangeAlertCount = computed(() => this.todayPriceChangeAlerts().length);
  protected readonly activityNotifications = computed<ActivityNotification[]>(() =>
    this.auditHistory()
      .map((record) => this.mapActivityNotification(record))
      .filter((activity): activity is ActivityNotification => Boolean(activity))
      .sort((left, right) => {
        const leftTime = this.parseAuditDate(left.createdAt)?.getTime() || 0;
        const rightTime = this.parseAuditDate(right.createdAt)?.getTime() || 0;
        return rightTime - leftTime;
      })
      .slice(0, 80),
  );
  protected readonly activityNotificationsCount = computed(() => this.activityNotifications().length);
  protected readonly auditUserTrendSeries = computed<AuditUserTrendSeries>(() => {
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

  protected readonly filteredInactiveProducts = computed(() => {
    const search = this.inactiveProductSearch().trim().toLowerCase();

    return this.inactiveProducts()
      .filter((product) => {
        if (!search) {
          return true;
        }

        return (
          product.sku.toLowerCase().includes(search) ||
          product.name.toLowerCase().includes(search) ||
          product.category.toLowerCase().includes(search)
        );
      })
      .sort((left, right) => {
        const leftDate = left.deactivatedAt ? new Date(left.deactivatedAt).getTime() : 0;
        const rightDate = right.deactivatedAt ? new Date(right.deactivatedAt).getTime() : 0;

        if (leftDate !== rightDate) {
          return rightDate - leftDate;
        }

        return left.name.localeCompare(right.name);
      });
  });

  protected readonly filteredProducts = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const category = this.selectedCategory();
    const statusFilter = this.inventoryStatusFilter();
    const expiryFilter = this.inventoryExpiryFilter();
    const favoriteIds = new Set(this.favoriteProductIds());

    return this.products().filter((product) => {
      const matchesCategory = category === 'Todas' || product.category === category;
      const productStatus = this.stockStatus(product);
      const productExpiryStatus = this.productExpiryStatus(product);
      const matchesStatus = statusFilter === 'Todos' || productStatus === statusFilter;
      const matchesExpiry = expiryFilter === 'Todos' || productExpiryStatus === expiryFilter;
      const matchesSearch =
        this.productMatchesSearch(product, search) ||
        (product.offerComponents || []).some((component) =>
          `${component.sku || ''} ${component.name || ''}`.toLowerCase().includes(search),
        ) ||
        (product.primaryLotNumber || '').toLowerCase().includes(search);

      return matchesCategory && matchesStatus && matchesExpiry && matchesSearch;
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

  protected readonly filteredAssembledOffers = computed(() => {
    const search = this.assembledOfferSearch().trim().toLowerCase();

    return this.assembledOffers().filter((offer) => {
      if (!search) {
        return true;
      }

      return (
        offer.sku.toLowerCase().includes(search) ||
        offer.name.toLowerCase().includes(search) ||
        offer.components.some((component) =>
          `${component.sku || ''} ${component.name || ''}`.toLowerCase().includes(search),
        )
      );
    });
  });

  protected readonly assembledOfferSelectedProducts = computed(() =>
    this.assembledOfferDraft().components
      .map((component) => ({
        ...component,
        product: component.productId
          ? this.products().find((product) => product.id === component.productId) || null
          : null,
      }))
      .filter((component) => component.product),
  );

  protected readonly assembledOfferPickerProducts = computed(() => {
    const selectedIds = new Set(
      this.assembledOfferDraft().components
        .map((component) => Number(component.productId || 0))
        .filter((productId) => productId > 0),
    );

    return this.products()
      .filter((product) => !product.isAssembledOffer)
      .filter((product) => !selectedIds.has(product.id))
      .sort((productA, productB) => productA.name.localeCompare(productB.name));
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
            : this.salePrices()[product.id] ?? product.salePrice;
        return {
          ...line,
          product,
          unitPrice,
          subtotal: unitPrice * line.quantity,
        };
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line)),
  );

  protected readonly cartPageSize = signal(5);
  protected readonly cartPageSizeOptions = [5, 10, 15, 30, 45, 60, 100];
  private readonly cartPages = signal<Record<string, number>>({});
  private readonly cartPageKey = computed(() => this.activeMode() + ':' + this.activeBillingInvoiceId());
  protected readonly cartPageCount = computed(() => Math.max(1, Math.ceil(this.cartDetails().length / this.cartPageSize())));
  protected readonly cartVisiblePage = computed(() => Math.min(this.cartPages()[this.cartPageKey()] ?? 1, this.cartPageCount()));
  protected readonly cartPageOffset = computed(() => (this.cartVisiblePage() - 1) * this.cartPageSize());
  protected readonly paginatedCartDetails = computed(() => this.cartDetails().slice(this.cartPageOffset(), this.cartPageOffset() + this.cartPageSize()));

  protected setCartPage(page: number): void {
    this.cartPages.update(pages => ({ ...pages, [this.cartPageKey()]: Math.max(1, Math.min(page, this.cartPageCount())) }));
  }

  protected updateCartPageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!this.cartPageSizeOptions.includes(size)) return;
    this.cartPageSize.set(size);
    this.cartPages.set({});
  }

  protected readonly cartTotal = computed(() =>
    this.cartDetails().reduce((total, line) => total + line.subtotal, 0),
  );

  protected readonly activeOrderInvoice = computed(() =>
    this.orderInvoiceSessions().find((session) => session.id === this.activeOrderInvoiceId()) || null,
  );

  protected readonly activeBillingInvoice = computed(() =>
    this.billingInvoiceSessions().find((session) => session.id === this.activeBillingInvoiceId()) || null,
  );

  protected readonly openBillingInvoiceCount = computed(() => this.billingInvoiceSessions().length);

  protected readonly activeOrderInvoiceReadyLines = computed(() =>
    (this.activeOrderInvoice()?.lines || []).filter((line) => line.status === 'ready' && line.product),
  );

  protected readonly activeOrderInvoiceBlockedLines = computed(() =>
    (this.activeOrderInvoice()?.lines || []).filter((line) => line.status !== 'ready'),
  );

  protected readonly activeOrderInvoiceTotal = computed(() =>
    this.activeOrderInvoiceReadyLines().reduce((total, line) => total + line.subtotal, 0),
  );

  protected readonly activeOrderInvoiceChangeDue = computed(() => {
    const received = Number(this.activeOrderInvoice()?.receivedAmount || 0);
    return Math.max((Number.isFinite(received) ? received : 0) - this.activeOrderInvoiceTotal(), 0);
  });

  protected readonly saleReceivedValue = computed(() => {
    const value = Number(this.saleReceivedAmount());
    return Number.isFinite(value) ? Math.max(value, 0) : 0;
  });

  protected readonly saleChangeDue = computed(() =>
    Math.max(this.saleReceivedValue() - this.cartTotal(), 0),
  );

  protected readonly saleProfit = computed(() =>
    this.cartDetails().reduce(
      (total, line) => total + (line.unitPrice - line.product.unitCost) * line.quantity,
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

  protected readonly productsWithActiveLotsCount = computed(
    () => this.products().filter((product) => Number(product.activeLotCount || 0) > 0).length,
  );

  protected readonly productsWithoutLotsCount = computed(
    () => this.products().filter((product) => Number(product.activeLotCount || 0) <= 0).length,
  );

  protected readonly productsExpiringSoonCount = computed(
    () => this.products().filter((product) => this.productExpiryStatus(product) === 'Vence pronto').length,
  );

  protected readonly productsExpiredCount = computed(
    () => this.products().filter((product) => this.productExpiryStatus(product) === 'Vencido').length,
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
    Math.max(1, Math.ceil(this.filteredProducts().length / this.inventoryPageSize())),
  );

  protected readonly inactiveProductsPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredInactiveProducts().length / this.inactiveProductsPageSize())),
  );

  protected readonly kardexPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredKardexProducts().length / this.kardexPageSize())),
  );

  protected readonly billingPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredProducts().length / this.billingPageSize())),
  );

  protected readonly filteredCostProducts = computed(() => {
    const category = this.selectedCostCategory();

    return this.products().filter((product) => category === 'Todas' || product.category === category);
  });

  protected readonly selectedCostPeriodLabel = computed(() => {
    const period = this.selectedCostPeriod();

    if (period === 'week') {
      return `Semana ${this.selectedCostWeek()}`;
    }

    if (period === 'year') {
      return String(this.selectedCostYear());
    }

    const month = this.costMonthOptions.find((item) => item.value === this.selectedCostMonth());
    return `${month?.label || 'Mes'} ${this.selectedCostYear()}`;
  });

  protected readonly costWeekOptions = computed(() => {
    const weeks = new Set<string>([this.formatDateKey(this.startOfWeek(new Date()))]);
    const collect = (value: string | null | undefined) => {
      const date = new Date(value || '');
      if (!Number.isNaN(date.getTime())) {
        weeks.add(this.formatDateKey(this.startOfWeek(date)));
      }
    };

    this.invoiceRows().forEach((invoice) => collect(invoice.createdAt));
    this.purchaseRows().forEach((purchase) => collect(purchase.createdAt));
    this.operationalCostRows().forEach((row) => collect(row.date || row.createdAt));

    return [...weeks].sort((a, b) => b.localeCompare(a));
  });

  protected readonly costPeriodRange = computed(() => {
    const period = this.selectedCostPeriod();

    if (period === 'week') {
      const [year, month, day] = this.selectedCostWeek().split('-').map(Number);
      const start = this.startOfDay(new Date(year, (month || 1) - 1, day || 1));
      return { start, end: this.addDays(start, 7) };
    }

    if (period === 'year') {
      const start = new Date(this.selectedCostYear(), 0, 1);
      return { start, end: new Date(this.selectedCostYear() + 1, 0, 1) };
    }

    const start = new Date(this.selectedCostYear(), this.selectedCostMonth() - 1, 1);
    return { start, end: this.addMonths(start, 1) };
  });

  protected readonly costPeriodInvoices = computed(() => {
    const { start, end } = this.costPeriodRange();

    return this.invoiceRows().filter((invoice) => {
      if (this.isInvoiceAnnulled(invoice)) {
        return false;
      }

      const date = new Date(invoice.createdAt || '');
      return !Number.isNaN(date.getTime()) && date >= start && date < end;
    });
  });

  protected readonly costPeriodInvoiceLines = computed(() => {
    const invoiceIds = new Set(this.costPeriodInvoices().map((invoice) => invoice.invoiceId));

    return Object.entries(this.costInvoiceLineRows())
      .filter(([invoiceId]) => invoiceIds.has(Number(invoiceId)))
      .flatMap(([, lines]) => lines)
      .filter((line) => !this.normalizeText(line.statusName).startsWith('anulad'));
  });

  protected readonly costProductMovementRows = computed<CostProductMovementRow[]>(() => {
    const productMap = new Map(this.products().map((product) => [product.id, product]));
    const rows = new Map<number, CostProductMovementRow>();
    const period = this.selectedCostPeriod();
    const monthsFactor = period === 'week' ? 0.25 : period === 'year' ? 12 : 1;

    for (const line of this.costPeriodInvoiceLines()) {
      const product = productMap.get(line.productId);
      const existing = rows.get(line.productId) || {
        productId: line.productId,
        productName: line.productName,
        sku: line.sku,
        category: product?.category || 'Sin categoria',
        quantity: 0,
        sales: 0,
        cost: 0,
        utility: 0,
        margin: 0,
        monthlyRotation: 0,
        stock: product?.stock || 0,
      };

      existing.quantity += Number(line.quantity || 0);
      existing.sales += Number(line.total || 0);
      existing.cost += Number(line.unitCost || 0) * Number(line.quantity || 0);
      existing.utility += Number(line.utility || 0);
      existing.margin = existing.sales > 0 ? existing.utility / existing.sales : 0;
      existing.monthlyRotation = monthsFactor > 0 ? existing.quantity / monthsFactor : existing.quantity;
      rows.set(line.productId, existing);
    }

    return [...rows.values()]
      .map((row) => ({
        ...row,
        quantity: Number(row.quantity.toFixed(2)),
        sales: Number(row.sales.toFixed(2)),
        cost: Number(row.cost.toFixed(2)),
        utility: Number(row.utility.toFixed(2)),
        margin: Number(row.margin.toFixed(4)),
        monthlyRotation: Number(row.monthlyRotation.toFixed(2)),
      }))
      .sort((a, b) => b.margin - a.margin || b.quantity - a.quantity || b.utility - a.utility)
      .slice(0, 20);
  });

  protected readonly filteredCostProductMovementRows = computed(() => {
    const category = this.selectedCostCategory();
    return this.costProductMovementRows().filter((row) => category === 'Todas' || row.category === category);
  });

  protected readonly costChangedProducts = computed<CostChangedProductRow[]>(() => {
    const grouped = new Map<number, PurchaseHistoryRow[]>();

    for (const purchase of this.purchaseHistoryRows()) {
      grouped.set(purchase.productId, [...(grouped.get(purchase.productId) || []), purchase]);
    }

    return [...grouped.entries()]
      .map(([productId, purchases]) => {
        const ordered = purchases
          .filter((purchase) => Number(purchase.unitCost || 0) > 0)
          .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
        const current = ordered[0];
        const previous = ordered.find((purchase) => Math.abs(Number(purchase.unitCost || 0) - Number(current?.unitCost || 0)) > 0.009);
        const product = this.products().find((item) => item.id === productId);

        if (!current || !previous) {
          return null;
        }

        const previousCost = Number(previous.unitCost || 0);
        const currentCost = Number(current.unitCost || 0);
        const difference = currentCost - previousCost;

        return {
          productId,
          productName: product?.name || current.productName,
          category: product?.category || 'Sin categoria',
          previousCost,
          currentCost,
          difference,
          variation: previousCost > 0 ? difference / previousCost : 0,
          lastDate: current.createdAt,
        };
      })
      .filter((row): row is CostChangedProductRow => Boolean(row))
      .sort((a, b) => Math.abs(b.variation) - Math.abs(a.variation))
      .slice(0, 12);
  });

  protected readonly costsPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredCostProducts().length / this.costsPageSize)),
  );

  protected readonly paginatedBillingProducts = computed(() => {
    const page = Math.min(this.billingPage(), this.billingPageCount());
    const start = (page - 1) * this.billingPageSize();
    return this.filteredProducts().slice(start, start + this.billingPageSize());
  });

  protected readonly catalogProducts = computed(() =>
    [...this.products()]
      .filter((product) => Number(product.salePrice || 0) > 0)
      .sort((left, right) => {
        const categoryComparison = left.category.localeCompare(right.category, 'es');

        if (categoryComparison !== 0) {
          return categoryComparison;
        }

        return left.name.localeCompare(right.name, 'es');
      }),
  );
  protected readonly catalogProductsWithImageCount = computed(() =>
    this.catalogProducts().filter((product) => Boolean(product.imageUrl)).length,
  );

  protected readonly paginatedCostProducts = computed(() => {
    const page = Math.min(this.costsPage(), this.costsPageCount());
    const start = (page - 1) * this.costsPageSize;
    return this.filteredCostProducts().slice(start, start + this.costsPageSize);
  });

  protected readonly billingPageStart = computed(() =>
    this.filteredProducts().length === 0 ? 0 : (Math.min(this.billingPage(), this.billingPageCount()) - 1) * this.billingPageSize() + 1,
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
    const start = (page - 1) * this.inventoryPageSize();
    return this.sortInventoryUiRows(this.filteredProducts(),'main').slice(start, start + this.inventoryPageSize());
  });

  protected readonly paginatedInactiveProducts = computed(() => {
    const page = Math.min(this.inactiveProductsPage(), this.inactiveProductsPageCount());
    const start = (page - 1) * this.inactiveProductsPageSize();
    return this.sortInventoryUiRows(this.filteredInactiveProducts(),'inactive').slice(start, start + this.inactiveProductsPageSize());
  });

  protected readonly paginatedOutOfStockProducts = computed(() => {
    const page = Math.min(this.kardexPage(), this.kardexPageCount());
    const start = (page - 1) * this.kardexPageSize();
    return this.sortInventoryUiRows(this.filteredKardexProducts(),'kardex').slice(start, start + this.kardexPageSize());
  });

  protected readonly inventoryPageStart = computed(() =>
    this.filteredProducts().length === 0 ? 0 : (Math.min(this.inventoryPage(), this.inventoryPageCount()) - 1) * this.inventoryPageSize() + 1,
  );

  protected readonly inventoryPageEnd = computed(() =>
    Math.min(this.inventoryPageStart() + this.paginatedInventoryProducts().length - 1, this.filteredProducts().length),
  );

  protected readonly inactiveProductsPageStart = computed(() =>
    this.filteredInactiveProducts().length === 0 ? 0 : (Math.min(this.inactiveProductsPage(), this.inactiveProductsPageCount()) - 1) * this.inactiveProductsPageSize() + 1,
  );

  protected readonly inactiveProductsPageEnd = computed(() =>
    Math.min(this.inactiveProductsPageStart() + this.paginatedInactiveProducts().length - 1, this.filteredInactiveProducts().length),
  );

  protected readonly canReactivateInventoryProducts = computed(() => {
    const role = String(this.currentUser()?.rol || '').toLowerCase();
    return role.includes('admin') || role.includes('administrador') || role.includes('inventario');
  });

  protected readonly canManageDatabaseBackups = computed(() => {
    const role = String(this.currentUser()?.rol || '').toLowerCase();
    return role.includes('admin') || role.includes('administrador');
  });

  protected readonly invoicePaymentOptions = computed(() =>
    [...new Map(this.invoiceRows().map((invoice) => [String(invoice.paymentTypeId), invoice.paymentTypeName || 'Sin forma de pago'])).entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'es')),
  );

  protected readonly invoiceStatusOptions = computed(() =>
    [...new Set(this.invoiceRows().map((invoice) => invoice.statusName).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es')),
  );

  protected readonly filteredInvoiceRows = computed(() => {
    const query = this.normalizeText(this.invoiceSearch().trim());
    const payment = this.invoicePaymentFilter();
    const status = this.invoiceStatusFilter();
    const period = this.invoicePeriod();
    const [year, month, day] = this.invoiceDate().split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(start);
    if (period === 'week') {
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      end.setTime(start.getTime()); end.setDate(end.getDate() + 7);
    } else if (period === 'month') {
      start.setDate(1); end.setMonth(end.getMonth() + 1, 1);
    } else { end.setDate(end.getDate() + 1); }

    return this.invoiceRows().filter((invoice) => {
      if (period !== 'all') {
        const date = new Date(invoice.createdAt || '');
        if (Number.isNaN(date.getTime()) || date < start || date >= end) return false;
      }
      if (payment && String(invoice.paymentTypeId) !== payment) return false;
      if (status && invoice.statusName !== status) return false;
      if (this.invoiceCustomerFilter() && this.invoiceCustomerKey(invoice) !== this.invoiceCustomerFilter()) return false;
      return !query || this.normalizeText([
        invoice.invoiceId,
        invoice.customerName,
        invoice.customerPhone,
        invoice.userName,
        invoice.paymentTypeName,
        invoice.statusName,
      ].join(' ')).includes(query);
    }).sort((a, b) => {
      const sort = this.invoiceSort();
      const value = (row: InvoiceRow) => sort.key === 'createdAt'
        ? (row.createdAt ? new Date(row.createdAt).getTime() : null) : row[sort.key as keyof InvoiceRow];
      return this.compareInvoiceValues(value(a), value(b), sort.direction) || b.invoiceId - a.invoiceId;
    });
  });

  protected readonly invoiceAnalysis = computed(() => {
    const rows = this.filteredInvoiceRows();
    const active = rows.filter(row => !this.isInvoiceAnnulled(row));
    return {
      invoiceCount: rows.length,
      activeTotal: active.reduce((sum, row) => sum + row.total, 0),
      annulledCount: rows.length - active.length,
      creditTotal: active.filter(row => row.paymentTypeId === 2).reduce((sum, row) => sum + row.total, 0),
    };
  });
  protected readonly invoicePaymentBreakdown = computed(() => {
    const groups = new Map<number, { id: number; label: string; total: number }>();
    for (const row of this.filteredInvoiceRows()) {
      if (this.isInvoiceAnnulled(row)) continue;
      const group = groups.get(row.paymentTypeId) || { id: row.paymentTypeId, label: row.paymentTypeName, total: 0 };
      group.total += row.total; groups.set(group.id, group);
    }
    const total = this.invoiceAnalysis().activeTotal;
    return [...groups.values()].sort((a, b) => b.total - a.total)
      .map(group => ({ ...group, percent: total > 0 ? group.total / total * 100 : 0 }));
  });
  protected readonly invoiceTrendPoints = computed(() => {
    const groups = new Map<string, number>();
    for (const row of this.filteredInvoiceRows()) {
      if (this.isInvoiceAnnulled(row)) continue;
      const date = new Date(row.createdAt || '');
      if (Number.isNaN(date.getTime())) continue;
      const key = this.invoicePeriod() === 'day' ? `${String(date.getHours()).padStart(2, '0')}:00`
        : this.invoicePeriod() === 'all' ? this.formatDateKey(date).slice(0, 7) : this.formatDateKey(date);
      groups.set(key, (groups.get(key) || 0) + row.total);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  protected readonly invoiceDayGroups = computed<InvoiceDayGroup[]>(() => {
    const dayMap = new Map<string, InvoiceRow[]>();

    for (const invoice of this.filteredInvoiceRows()) {
      const key = this.dateKey(invoice.createdAt);
      dayMap.set(key, [...(dayMap.get(key) || []), invoice]);
    }

    return [...dayMap.entries()]
      .sort(([left], [right]) => this.invoiceSort().key === 'createdAt' && this.invoiceSort().direction === 'asc' ? left.localeCompare(right) : right.localeCompare(left))
      .map(([key, invoices]) => {
        const paymentMap = new Map<string, InvoiceRow[]>();

        for (const invoice of invoices) {
          const paymentKey = `${key}-${invoice.paymentTypeId}-${this.normalizeText(invoice.paymentTypeName)}`;
          paymentMap.set(paymentKey, [...(paymentMap.get(paymentKey) || []), invoice]);
        }

        const paymentGroups = [...paymentMap.entries()]
          .map(([paymentKey, paymentInvoices]) => ({
            key: paymentKey,
            label: paymentInvoices[0]?.paymentTypeName || 'Sin forma de pago',
            paymentTypeId: paymentInvoices[0]?.paymentTypeId ?? 0,
            invoices: paymentInvoices,
            total: paymentInvoices.reduce((total, invoice) => total + invoice.total, 0),
            itemCount: paymentInvoices.reduce((total, invoice) => total + invoice.itemCount, 0),
          }))
          .sort((left, right) => left.label.localeCompare(right.label));

        return {
          key,
          label: this.formatInvoiceDayLabel(key),
          invoices,
          paymentGroups,
          total: invoices.reduce((total, invoice) => total + invoice.total, 0),
          itemCount: invoices.reduce((total, invoice) => total + invoice.itemCount, 0),
        };
      });
  });

  protected readonly invoiceMonthlySalesRows = computed<InvoiceMonthlySalesRow[]>(() => {
    const monthsToShow = Math.max(1, Math.min(12, Number(this.invoiceMonthlyMonthsToShow()) || 12));
    const months = new Map<string, InvoiceMonthlySalesRow>();
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    for (let index = 0; index < monthsToShow; index += 1) {
      const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - index, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      months.set(key, {
        key,
        label: this.formatSalesProfitabilityPeriodLabel(key),
        invoiceCount: 0,
        itemCount: 0,
        cashTotal: 0,
        creditTotal: 0,
        transferTotal: 0,
        total: 0,
      });
    }

    for (const trend of this.invoiceMonthlySalesTrendData()) {
      const date = new Date(trend.periodStart);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const current = months.get(key);

      if (!current) {
        continue;
      }

      current.cashTotal = Number((trend.efectivo || 0).toFixed(2));
      current.creditTotal = Number((trend.credito || 0).toFixed(2));
      current.transferTotal = Number((trend.transferencia || 0).toFixed(2));
      current.total = Number((current.cashTotal + current.creditTotal + current.transferTotal).toFixed(2));
      months.set(key, current);
    }

    for (const invoice of this.invoiceRows()) {
      if (this.isInvoiceAnnulled(invoice)) {
        continue;
      }

      const date = this.parseDate(invoice.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = months.get(key);

      if (!current) {
        continue;
      }

      current.invoiceCount += 1;
      current.itemCount += Number(invoice.itemCount || 0);
      months.set(key, current);
    }

    return [...months.values()].sort((left, right) => right.key.localeCompare(left.key));
  });

  protected readonly invoicePaginationTotal = computed(() => this.invoiceGrouping() === 'none'
    ? this.filteredInvoiceRows().length : this.invoiceDayGroups().length);
  protected readonly invoicePageCount = computed(() =>
    Math.max(1, Math.ceil(this.invoicePaginationTotal() / this.invoicePageSize())),
  );
  protected readonly paginatedInvoices = computed(() => {
    const start = (Math.min(this.invoicePage(), this.invoicePageCount()) - 1) * this.invoicePageSize();
    return this.filteredInvoiceRows().slice(start, start + this.invoicePageSize());
  });
  protected readonly paginatedInvoiceGroups = computed<InvoiceDayGroup[]>(() => {
    const start = (Math.min(this.invoicePage(), this.invoicePageCount()) - 1) * this.invoicePageSize();
    return this.invoiceDayGroups().slice(start, start + this.invoicePageSize());
  });
  protected readonly invoicePageStart = computed(() => this.invoicePaginationTotal() === 0 ? 0
    : (Math.min(this.invoicePage(), this.invoicePageCount()) - 1) * this.invoicePageSize() + 1);
  protected readonly invoicePageEnd = computed(() =>
    Math.min(this.invoicePageStart() + this.invoicePageSize() - 1, this.invoicePaginationTotal()),
  );

  protected readonly todayInvoiceTotal = computed(() =>
    this.todayInvoiceRows().reduce((total, invoice) => total + invoice.total, 0),
  );

  protected readonly billingTodayCashSales = computed(() =>
    this.todayInvoiceRows()
      .filter((invoice) => !this.isInvoiceAnnulled(invoice) && invoice.paymentTypeId === 1)
      .reduce((total, invoice) => total + invoice.total, 0),
  );

  protected readonly billingTodayCreditSales = computed(() =>
    this.todayInvoiceRows()
      .filter((invoice) => !this.isInvoiceAnnulled(invoice) && invoice.paymentTypeId === 2)
      .reduce((total, invoice) => total + invoice.total, 0),
  );

  protected readonly billingTodayPurchases = computed(() =>
    this.purchaseRows()
      .filter((purchase) => this.isCurrentLocalDate(purchase.createdAt))
      .reduce((total, purchase) => total + purchase.total, 0),
  );

  protected readonly logoutCashDifference = computed(() => {
    const cut = this.logoutCutPreview();
    const physicalCashCount = Number(this.logoutPhysicalCashCount());

    if (!cut || !Number.isFinite(physicalCashCount)) {
      return 0;
    }

    return physicalCashCount - cut.cashTotal;
  });

  protected readonly logoutCashDifferenceAbs = computed(() => Math.abs(this.logoutCashDifference()));

  protected readonly logoutCashDifferenceLabel = computed(() => {
    const difference = this.logoutCashDifference();

    if (difference === 0) {
      return 'Caja cuadrada';
    }

    return difference > 0 ? 'Sobrante en caja' : 'Faltante en caja';
  });

  protected readonly logoutCashDifferenceClass = computed(() => {
    const difference = this.logoutCashDifference();

    if (difference === 0) {
      return 'balanced';
    }

    return difference > 0 ? 'surplus' : 'shortage';
  });

  protected readonly creditPaymentTransferTotal = computed(() =>
    this.creditPaymentRows()
      .filter((payment) => payment.paymentMethod === 'transferencia')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly creditPaymentCashTotal = computed(() =>
    this.creditPaymentRows()
      .filter((payment) => payment.paymentMethod === 'efectivo')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly generalCreditHistoryTotal = computed(() =>
    this.generalCreditHistoryPayments().reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly generalCreditHistoryAverage = computed(() => {
    const payments = this.generalCreditHistoryPayments();
    return payments.length === 0 ? 0 : this.generalCreditHistoryTotal() / payments.length;
  });

  protected readonly generalCreditHistoryTransferTotal = computed(() =>
    this.generalCreditHistoryPayments()
      .filter((payment) => payment.paymentMethod === 'transferencia')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly generalCreditHistoryCashTotal = computed(() =>
    this.generalCreditHistoryPayments()
      .filter((payment) => payment.paymentMethod === 'efectivo')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly generalCreditHistoryDayGroups = computed<GeneralCreditPaymentDayGroup[]>(() => {
    const days = new Map<string, CreditPayment[]>();

    for (const payment of this.generalCreditHistoryPayments()) {
      const dayKey = this.dateKey(payment.createdAt);
      days.set(dayKey, [...(days.get(dayKey) || []), payment]);
    }

    return [...days.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, payments]) => {
        const customers = new Map<number, CreditPayment[]>();

        for (const payment of payments) {
          customers.set(payment.customerId, [...(customers.get(payment.customerId) || []), payment]);
        }

        const customerGroups = [...customers.entries()]
          .map(([customerId, customerPayments]) => ({
            key: `${key}-${customerId}`,
            customerId,
            customerName: customerPayments[0]?.customerName || 'Cliente sin nombre',
            total: customerPayments.reduce((total, payment) => total + payment.amount, 0),
            count: customerPayments.length,
            payments: customerPayments.sort((a, b) =>
              this.parseDate(b.createdAt).getTime() - this.parseDate(a.createdAt).getTime(),
            ),
          }))
          .sort((left, right) => right.total - left.total);

        return {
          key,
          label: this.formatInvoiceDayLabel(key),
          total: payments.reduce((total, payment) => total + payment.amount, 0),
          count: payments.length,
          customerCount: customerGroups.length,
          payments,
          customers: customerGroups,
        };
      });
  });

  protected readonly creditHistoryTotal = computed(() =>
    this.creditHistoryPayments().reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly creditHistoryAverage = computed(() => {
    const payments = this.creditHistoryPayments();
    return payments.length === 0 ? 0 : this.creditHistoryTotal() / payments.length;
  });

  protected readonly creditHistoryLastPayment = computed(() => this.creditHistoryPayments()[0] || null);

  protected readonly creditHistoryTransferTotal = computed(() =>
    this.creditHistoryPayments()
      .filter((payment) => payment.paymentMethod === 'transferencia')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly creditHistoryCashTotal = computed(() =>
    this.creditHistoryPayments()
      .filter((payment) => payment.paymentMethod === 'efectivo')
      .reduce((total, payment) => total + payment.amount, 0),
  );

  protected readonly creditHistoryTrend = computed(() => {
    const period = this.creditHistoryTrendPeriod();
    const totals = new Map<string, { label: string; total: number }>();

    for (const payment of this.creditHistoryPayments()) {
      const date = this.parseDate(payment.createdAt);
      const grouping = this.creditHistoryTrendGrouping(date, period);
      const current = totals.get(grouping.key) || { label: grouping.label, total: 0 };
      totals.set(grouping.key, {
        label: grouping.label,
        total: current.total + payment.amount,
      });
    }

    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => ({ key, label: item.label, total: item.total }));
  });

  protected readonly creditHistoryTrendPath = computed(() => {
    const trend = this.creditHistoryTrend();

    if (trend.length === 0) {
      return '';
    }

    const maxTotal = Math.max(...trend.map((item) => item.total), 1);
    const width = 620;
    const height = 170;
    const step = trend.length === 1 ? 0 : width / (trend.length - 1);

    return trend
      .map((item, index) => {
        const x = trend.length === 1 ? width / 2 : index * step;
        const y = height - (item.total / maxTotal) * (height - 20) - 10;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  });

  protected readonly creditHistoryYearGroups = computed<CreditPaymentYearGroup[]>(() => {
    const years = new Map<string, CreditPayment[]>();

    for (const payment of this.creditHistoryPayments()) {
      const date = this.parseDate(payment.createdAt);
      const yearKey = String(date.getFullYear());
      years.set(yearKey, [...(years.get(yearKey) || []), payment]);
    }

    return [...years.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([yearKey, payments]) => {
        const months = this.groupCreditPaymentsByPeriod(payments, 'month');
        return {
          key: yearKey,
          label: yearKey,
          total: payments.reduce((total, payment) => total + payment.amount, 0),
          count: payments.length,
          payments,
          months,
        };
      });
  });

  protected readonly creditHistorySelectedYearGroup = computed<CreditPaymentYearGroup | null>(() => {
    const groups = this.creditHistoryYearGroups();
    const selectedKey = this.selectedCreditHistoryYear();
    return groups.find((group) => group.key === selectedKey) || groups[0] || null;
  });

  protected readonly selectedCut = computed(() =>
    this.selectedCutId() === null
      ? this.cutPreview()
      : this.cutRows().find((cut) => cut.id === this.selectedCutId()) || this.cutPreview(),
  );

  protected readonly pettyCashRows = computed(() =>
    {
      const manualRows = this.pettyCashManualRecords().map((record) => this.mapPettyCashManualRow(record));
      const correctedDates = new Set(manualRows.map((row) => row.date).filter(Boolean));
      const baselineRow = this.pettyCashBaselineRow();
      const baselineRows = correctedDates.has(baselineRow.date) ? [] : [baselineRow];
      const cutRows = this.pettyCashCuts()
        .map((cut) => this.mapPettyCashRow(cut))
        .filter((row) => !correctedDates.has(row.date));

      return [
        ...baselineRows,
        ...manualRows,
        ...cutRows,
      ]
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        return dateDiff || String(b.id).localeCompare(String(a.id));
      });
    },
  );

  protected readonly pettyCashTotals = computed(() =>
    this.pettyCashRows().reduce(
      (totals, row) => ({
        initialCash: totals.initialCash + row.initialAmount,
        physicalCash: totals.physicalCash + row.finalAmount,
        turnBilling: totals.turnBilling + row.turnBilling,
        cashToPetty: totals.cashToPetty + row.cashToPetty,
        fourteenthReserve: totals.fourteenthReserve + row.fourteenthReserve,
        dividendReserve: totals.dividendReserve + row.dividendReserve,
        totalReserve: totals.totalReserve + row.totalReserve,
        cashOut: totals.cashOut + row.cashOut,
        cuts: totals.cuts + 1,
      }),
      {
        initialCash: 0,
        physicalCash: 0,
        turnBilling: 0,
        cashToPetty: 0,
        fourteenthReserve: 0,
        dividendReserve: 0,
        totalReserve: 0,
        cashOut: 0,
        cuts: 0,
      },
    ),
  );

  protected readonly pettyCashAvailableBalance = computed(() => {
    const rows = this.pettyCashRows()
      .filter((row) => row.source !== 'cut' && (row.realCashTotal > 0 || row.pettyCashTotal > 0))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = rows[0];
    return latest ? this.roundMoney(latest.realCashTotal || latest.pettyCashTotal) : 7426;
  });

  protected readonly pettyCashPageCount = computed(() =>
    Math.max(1, Math.ceil(this.pettyCashRows().length / this.pettyCashPageSize)),
  );

  protected readonly paginatedPettyCashRows = computed(() => {
    const page = Math.min(this.pettyCashPage(), this.pettyCashPageCount());
    const start = (page - 1) * this.pettyCashPageSize;
    return this.pettyCashRows().slice(start, start + this.pettyCashPageSize);
  });

  protected readonly pettyCashPageStart = computed(() =>
    this.pettyCashRows().length === 0 ? 0 : (Math.min(this.pettyCashPage(), this.pettyCashPageCount()) - 1) * this.pettyCashPageSize + 1,
  );

  protected readonly pettyCashPageEnd = computed(() =>
    Math.min(this.pettyCashPageStart() + this.paginatedPettyCashRows().length - 1, this.pettyCashRows().length),
  );

  protected readonly pettyCashTrendData = computed<PettyCashTrendPoint[]>(() => {
    const grouped = new Map<string, PettyCashTrendPoint>();
    const period = this.pettyCashTrendPeriod();

    for (const row of [...this.pettyCashRows()].reverse()) {
      const date = this.parseLocalDate(row.date);
      const key = this.pettyCashTrendKey(date, period);
      const label = this.pettyCashTrendLabel(date, period);
      const current = grouped.get(key) || {
        key,
        label,
        cashToPetty: 0,
        reserves: 0,
        netPettyCash: 0,
      };

      current.cashToPetty += row.cashToPetty;
      current.reserves += row.totalReserve;
      current.netPettyCash += row.pettyCashTotal || row.realCashTotal;
      grouped.set(key, current);
    }

    return [...grouped.values()].slice(-18);
  });

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

  protected readonly costDistributionSeries = computed<CostDistributionPoint[]>(() => ([
    {
      label: 'Costo actual',
      value: this.monthlyFixedCostEstimate(),
      color: this.chartLinePalette()[0]?.border || '#f97316',
    },
    {
      label: 'Utilidad potencial',
      value: Math.max(this.monthlyOperatingCost(), 0),
      color: this.chartLinePalette()[1]?.border || '#14b8a6',
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

  protected readonly dashboardPayrollChartSeries = computed<PayrollTrendSeries>(() => {
    const period = this.payrollTrendPeriod() === 'day' ? 'week' : this.payrollTrendPeriod();
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
    const users = new Map<number, string>();

    for (const day of allDays) {
      const grouping = this.payrollTrendGrouping(day.date, period);
      const currentGroup = groups.get(grouping.key) || {
        label: grouping.label,
        sortValue: grouping.sortValue,
        totals: new Map<number, number>(),
      };

      currentGroup.totals.set(day.userId, Number(((currentGroup.totals.get(day.userId) || 0) + day.pay).toFixed(2)));
      groups.set(grouping.key, currentGroup);
      users.set(day.userId, day.userName);
    }

    const orderedGroups = [...groups.values()].sort((a, b) => a.sortValue - b.sortValue);
    const orderedUsers = [...users.entries()].sort((a, b) => a[1].localeCompare(b[1]));

    return {
      labels: orderedGroups.map((group) => group.label),
      datasets: orderedUsers.map(([userId, userName]) => ({
        label: userName,
        data: orderedGroups.map((group) => Number((group.totals.get(userId) || 0).toFixed(2))),
      })),
    };
  });

  protected readonly dashboardPayrollTotal = computed(() =>
    this.dashboardPayrollChartSeries().datasets.reduce(
      (total, dataset) => total + dataset.data.reduce((sum, value) => sum + value, 0),
      0,
    ),
  );

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
    const categoryMap = new Map<string, Required<CostCategoryComparisonPoint>>();

    for (const row of this.costProductMovementRows()) {
      const current = categoryMap.get(row.category) || {
        category: row.category,
        costTotal: 0,
        saleTotal: 0,
        utilityTotal: 0,
        quantity: 0,
      };

      current.costTotal += row.cost;
      current.saleTotal += row.sales;
      current.utilityTotal += row.utility;
      current.quantity += row.quantity;
      categoryMap.set(row.category, current);
    }

    const periodRows = [...categoryMap.values()]
      .map((item) => ({
        ...item,
        costTotal: Number(item.costTotal.toFixed(2)),
        saleTotal: Number(item.saleTotal.toFixed(2)),
        utilityTotal: Number(item.utilityTotal.toFixed(2)),
        quantity: Number(item.quantity.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity || b.utilityTotal - a.utilityTotal)
      .slice(0, 8);

    if (periodRows.length > 0) {
      return periodRows;
    }

    const costMap = new Map(this.costCategorySeries().map((item) => [item.category, item.total]));
    const saleMap = new Map(this.costCategorySaleValueSeries().map((item) => [item.category, item.saleTotal]));
    const categories = [...new Set([...costMap.keys(), ...saleMap.keys()])];

    return categories.map((category) => ({
      category,
      costTotal: Number((costMap.get(category) || 0).toFixed(2)),
      saleTotal: Number((saleMap.get(category) || 0).toFixed(2)),
      utilityTotal: Number(((saleMap.get(category) || 0) - (costMap.get(category) || 0)).toFixed(2)),
      quantity: 0,
    })).sort((a, b) => b.costTotal - a.costTotal || b.saleTotal - a.saleTotal).slice(0, 8);
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
          paymentTypeId: purchase.paymentTypeId,
          statusId: purchase.statusId,
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

  protected readonly purchaseInvoiceGroups = computed<PurchaseInvoiceGroup[]>(() =>
    this.purchaseSupplierGroups()
      .flatMap((supplier) => supplier.invoices)
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
  );

  protected readonly purchaseDayGroups = computed<PurchaseDayGroup[]>(() => {
    const dayMap = new Map<string, PurchaseInvoiceGroup[]>();

    for (const invoice of this.purchaseInvoiceGroups()) {
      const key = this.dateKey(invoice.createdAt);
      dayMap.set(key, [...(dayMap.get(key) || []), invoice]);
    }

    return [...dayMap.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, invoices]) => {
        const paymentMap = new Map<string, PurchaseInvoiceGroup[]>();

        for (const invoice of invoices) {
          const paymentKey = `${key}-${invoice.paymentTypeId}-${this.normalizeText(invoice.purchaseType)}`;
          paymentMap.set(paymentKey, [...(paymentMap.get(paymentKey) || []), invoice]);
        }

        const paymentGroups = [...paymentMap.entries()]
          .map(([paymentKey, paymentInvoices]) => ({
            key: paymentKey,
            label: paymentInvoices[0]?.purchaseType || 'Sin tipo de pago',
            paymentTypeId: paymentInvoices[0]?.paymentTypeId ?? 0,
            invoices: paymentInvoices,
            total: paymentInvoices.reduce((total, invoice) => total + invoice.total, 0),
            quantity: paymentInvoices.reduce((total, invoice) => total + invoice.quantity, 0),
          }))
          .sort((left, right) => left.label.localeCompare(right.label));

        return {
          key,
          label: this.formatInvoiceDayLabel(key),
          invoices,
          paymentGroups,
          total: invoices.reduce((total, invoice) => total + invoice.total, 0),
          quantity: invoices.reduce((total, invoice) => total + invoice.quantity, 0),
        };
      });
  });

  protected readonly purchasePageCount = computed(() =>
    Math.max(1, Math.ceil(this.purchaseDayGroups().length / this.purchasePageSize)),
  );

  protected readonly paginatedPurchaseDayGroups = computed<PurchaseDayGroup[]>(() => {
    const page = Math.min(this.purchasePage(), this.purchasePageCount());
    const start = (page - 1) * this.purchasePageSize;
    return this.purchaseDayGroups().slice(start, start + this.purchasePageSize);
  });

  protected readonly paginatedPurchases = computed(() => {
    const invoiceKeys = new Set(this.paginatedPurchaseDayGroups().flatMap((group) => group.invoices.map((invoice) => invoice.key)));
    return this.purchaseHistoryRows().filter((purchase) => {
      const invoiceNumber = purchase.invoiceNumber || `SIN-FACT-${purchase.id}`;
      return invoiceKeys.has(`${purchase.supplierId || 0}-${invoiceNumber}`);
    });
  });

  protected readonly purchasePageStart = computed(() =>
    this.purchaseDayGroups().length === 0 ? 0 : (Math.min(this.purchasePage(), this.purchasePageCount()) - 1) * this.purchasePageSize + 1,
  );

  protected readonly purchasePageEnd = computed(() =>
    Math.min(this.purchasePageStart() + this.paginatedPurchaseDayGroups().length - 1, this.purchaseDayGroups().length),
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

  protected readonly purchaseProductCategories = computed(() => [
    'Todas',
    ...new Set(this.products().map((product) => product.category)),
  ]);

  protected readonly filteredPurchaseProducts = computed(() => {
    const search = this.normalizeSearchText(this.purchaseProductSearch());
    const category = this.purchaseProductCategory();
    const selectedIds = new Set(this.purchaseDraftLines().map((line) => line.productId));

    return this.products()
      .filter((product) => {
        const matchesCategory = category === 'Todas' || product.category === category;
        const haystack = this.normalizeSearchText(`${product.sku} ${product.name} ${product.category}`);
        return matchesCategory && (!search || haystack.includes(search));
      })
      .sort((productA, productB) => {
        const selectedScoreA = selectedIds.has(productA.id) ? 1 : 0;
        const selectedScoreB = selectedIds.has(productB.id) ? 1 : 0;

        if (selectedScoreA !== selectedScoreB) {
          return selectedScoreB - selectedScoreA;
        }

        return productA.name.localeCompare(productB.name);
      })
      .slice(0, 80);
  });

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

  protected readonly operationalCostWeeklyTrend = computed<CostMonthlyPoint[]>(() => {
    const year = this.selectedCostYear();
    const month = this.selectedCostMonth();
    const weeks = new Map<string, number>();

    for (const row of this.operationalCostRows()) {
      const date = new Date(row.date || row.createdAt || '');

      if (Number.isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() + 1 !== month) {
        continue;
      }

      const key = this.formatDateKey(this.startOfWeek(date));
      weeks.set(key, (weeks.get(key) || 0) + row.amount);
    }

    return [...weeks.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, total], index) => ({
        label: `Sem ${index + 1} (${key.slice(5)})`,
        total: Number(total.toFixed(2)),
      }));
  });

  protected readonly estimatedNetPotentialProfit = computed(() =>
    this.monthlyOperatingCost() - this.operationalCostTotal(),
  );

  protected readonly kardexPageStart = computed(() =>
    this.outOfStockProducts().length === 0 ? 0 : (Math.min(this.kardexPage(), this.kardexPageCount()) - 1) * this.kardexPageSize() + 1,
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
    const currentPayrollWeek = this.currentPayrollWeekInfo().week;

    if (currentPayrollWeek > 0) {
      weeks.add(currentPayrollWeek);
    }

    for (const user of this.attendanceUsers()) {
      for (const record of user.history) {
        if (record.weekNumber > 0) {
          weeks.add(record.weekNumber);
        }
      }
    }

    for (const record of this.payrollDatabaseRecords()) {
      if (record.weekNumber > 0) {
        weeks.add(record.weekNumber);
      }
    }

    for (const sourceWeek of imagePayrollWeeks) {
      if (sourceWeek.weekNumber > 0) {
        weeks.add(sourceWeek.weekNumber);
      }
    }

    return [...weeks].sort((a, b) => b - a);
  });

  protected readonly attendanceUserGroups = computed<AttendanceUserGroup[]>(() =>
    this.attendanceUsers().map((user) => {
      const weeksByKey = new Map<string, AttendanceWeekGroup>();

      for (const record of user.history) {
        const weekNumber = this.getAttendanceWeekInfo(record.date).week;
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

  protected readonly payrollUserGroups = computed<PayrollUserLine[]>(() => {
    if (this.payrollDatabaseRecords().length > 0) {
      return this.buildPayrollUserGroupsFromDatabase();
    }

    return this.attendanceUserGroups().map((group) => {
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
    });
  });

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

  protected readonly payrollMonthOptions = computed(() => {
    const months = new Set<string>([this.todayDateKey().slice(0, 7)]);

    for (const group of this.payrollUserGroups()) {
      for (const week of group.weeks) {
        for (const day of week.days) {
          months.add(this.formatDateKey(day.date).slice(0, 7));
        }
      }
    }

    return [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        label: this.formatPayrollMonthLabel(key),
      }));
  });

  protected readonly payrollScopeLabel = computed(() => {
    const selectedWeek = this.selectedAttendanceWeek();
    const selectedMonth = this.selectedPayrollMonth();

    if (selectedWeek !== null) {
      return `Semana ${selectedWeek}`;
    }

    if (selectedMonth) {
      return this.formatPayrollMonthLabel(selectedMonth);
    }

    return 'Acumulado hasta hoy';
  });

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

  protected readonly scopedPayrollLines = computed<PayrollScopedLine[]>(() => {
    const selectedWeek = this.selectedAttendanceWeek();
    const selectedMonth = this.selectedPayrollMonth();
    const todayKey = this.todayDateKey();

    return this.payrollUserGroups()
      .flatMap((group) =>
        group.weeks.flatMap((week) => {
          const days = week.days.filter((day) => {
            const dayKey = this.formatDateKey(day.date);

            if (selectedWeek !== null) {
              return week.weekNumber === selectedWeek;
            }

            if (selectedMonth) {
              return dayKey.slice(0, 7) === selectedMonth && dayKey <= todayKey;
            }

            return dayKey <= todayKey;
          });

          if (days.length === 0) {
            return [];
          }

          const subtotalPay = Number(days.reduce((total, day) => total + day.totalPay, 0).toFixed(2));
          const totalHours = Number(days.reduce((total, day) => total + day.totalHours, 0).toFixed(2));
          const bonus = week.bonus;

          return [{
            user: group.user,
            week,
            days,
            subtotalPay,
            bonus,
            grandTotal: Number((subtotalPay + bonus).toFixed(2)),
            totalHours,
          }];
        }),
      )
      .sort((a, b) => b.week.weekNumber - a.week.weekNumber || a.user.name.localeCompare(b.user.name));
  });

  protected readonly accumulatedPayrollWeeks = computed(() => {
    const selectedWeek = this.selectedAttendanceWeek();

    return this.payrollUserGroups()
      .flatMap((group) =>
        group.weeks
          .filter((week) => selectedWeek === null || week.weekNumber <= selectedWeek)
          .map((week) => ({
            user: group.user,
            week,
          })),
      )
      .sort((a, b) => b.week.weekNumber - a.week.weekNumber || a.user.name.localeCompare(b.user.name));
  });

  protected readonly accumulatedPayrollHours = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.totalHours, 0).toFixed(2)),
  );

  protected readonly accumulatedBasePayroll = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.subtotalPay, 0).toFixed(2)),
  );

  protected readonly accumulatedBonusTotal = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.bonus, 0).toFixed(2)),
  );

  protected readonly accumulatedPayrollTotal = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.grandTotal, 0).toFixed(2)),
  );

  protected readonly weeklyPayrollHours = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.totalHours, 0).toFixed(2)),
  );

  protected readonly weeklyBasePayroll = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.subtotalPay, 0).toFixed(2)),
  );

  protected readonly weeklyBonusTotal = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.bonus, 0).toFixed(2)),
  );

  protected readonly weeklyPayrollTotal = computed(() =>
    Number(this.scopedPayrollLines().reduce((total, line) => total + line.grandTotal, 0).toFixed(2)),
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
    this.scopedPayrollLines().reduce(
      (totals, line) => {
        for (const day of line.days) {
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

  protected readonly generatedPayrollLines = computed<PayrollGeneratedLine[]>(() =>
    this.attendanceUsers().map((user) => {
      const scheduledHours = this.userWeeklyGeneratedHours(user.id);
      const attendanceHours = this.currentWeekHours(user.id);

      return {
        user,
        scheduledHours,
        attendanceHours,
        differenceHours: Number((scheduledHours - attendanceHours).toFixed(2)),
        pay: this.userWeeklyGeneratedPay(user.id),
      };
    }),
  );

  protected readonly generatedPayrollTotal = computed(() =>
    Number(this.generatedPayrollLines().reduce((total, line) => total + line.pay, 0).toFixed(2)),
  );

  protected readonly generatedPayrollWeekDays = computed<PayrollGeneratedDayLine[]>(() => {
    const week = this.selectedAttendanceWeek() || this.currentPayrollWeekInfo().week;
    const year = this.currentPayrollWeekInfo().year;
    const startDate = this.weekStartDate(year, week);

    return this.payrollDays.map((day, index) => {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + index);
      const scheduledHours = this.attendanceUsers().reduce(
        (total, user) =>
          total +
          this.payrollShifts.reduce(
            (shiftTotal, shift) => shiftTotal + (this.payrollHours()[user.id]?.[day.id]?.[shift.id] || 0),
            0,
          ),
        0,
      );
      const attendanceHours = this.attendanceUsers().reduce(
        (total, user) =>
          total +
          user.history
            .filter((record) => this.sameUtcDate(record.date, date))
            .reduce((dayTotal, record) => dayTotal + record.workedHours, 0),
        0,
      );
      const pay = this.attendanceUsers().reduce(
        (total, user) =>
          total +
          this.payrollShifts.reduce(
            (shiftTotal, shift) =>
              shiftTotal + (this.payrollHours()[user.id]?.[day.id]?.[shift.id] || 0) * shift.rate,
            0,
          ),
        0,
      );

      return {
        day,
        date,
        scheduledHours: Number(scheduledHours.toFixed(2)),
        attendanceHours: Number(attendanceHours.toFixed(2)),
        pay: Number(pay.toFixed(2)),
      };
    });
  });

  protected readonly imagePayrollWeekCards = computed<ImagePayrollWeekCard[]>(() =>
    imagePayrollWeeks.map((sourceWeek) => {
      const matrixRows = this.buildImagePayrollMatrixRows(sourceWeek);

      return {
        ...sourceWeek,
        matrixRows,
        total: Number(matrixRows.reduce((total, row) => total + row.total, 0).toFixed(2)),
      };
    }),
  );

  protected readonly nextPayrollWeekToGenerate = computed(() => {
    const databaseWeeks = this.payrollDatabaseRecords()
      .map((record) => record.weekNumber)
      .filter((weekNumber) => weekNumber > 0);

    if (databaseWeeks.length > 0) {
      return Math.max(...databaseWeeks) + 1;
    }

    return Math.max(...imagePayrollWeeks.map((sourceWeek) => sourceWeek.weekNumber)) + 1;
  });

  protected readonly selectedImagePayrollSourceWeek = computed<ImagePayrollSourceWeek | null>(() => {
    const selectedWeek = this.selectedAttendanceWeek();
    const targetWeek = selectedWeek || this.nextPayrollWeekToGenerate();
    const exactDatabaseWeek = this.buildDatabasePayrollSourceWeek(targetWeek, targetWeek);
    const latestDatabaseWeek = this.latestDatabasePayrollWeekBefore(targetWeek);
    const latestDatabaseSourceWeek = latestDatabaseWeek
      ? this.buildDatabasePayrollSourceWeek(latestDatabaseWeek, targetWeek)
      : null;
    const exactSourceWeek = imagePayrollWeeks.find((sourceWeek) => selectedWeek !== null && sourceWeek.weekNumber === selectedWeek);
    const templateWeek = imagePayrollWeeks.at(-1);

    if (exactDatabaseWeek) {
      return exactDatabaseWeek;
    }

    if (latestDatabaseSourceWeek) {
      return latestDatabaseSourceWeek;
    }

    if (exactSourceWeek) {
      return exactSourceWeek;
    }

    if (!templateWeek) {
      return null;
    }

    return (
      {
        ...templateWeek,
        weekNumber: targetWeek,
        label: this.payrollWeekRangeLabel(templateWeek.year, targetWeek),
      }
    );
  });

  protected readonly editableImagePayrollWeekCard = computed<ImagePayrollWeekCard | null>(() => {
    const sourceWeek = this.selectedImagePayrollSourceWeek();

    if (!sourceWeek) {
      return null;
    }

    const editableRows = this.editableImagePayrollRows();
    const editableBonuses = this.editableImagePayrollBonuses();
    const rows = sourceWeek.rows.map((row) => ({
      ...row,
      bonus: editableBonuses[row.name] ?? row.bonus,
      days: this.cloneImagePayrollDays(editableRows[row.name] || row.days),
    }));
    const matrixRows = this.buildImagePayrollMatrixRows({ ...sourceWeek, rows });

    return {
      ...sourceWeek,
      rows,
      matrixRows,
      total: Number(matrixRows.reduce((total, row) => total + row.total, 0).toFixed(2)),
    };
  });

  protected readonly imagePayrollMatrixRows = computed<PayrollWeekMatrixLine[]>(
    () => this.imagePayrollWeekCards().at(-1)?.matrixRows || [],
  );

  protected readonly imagePayrollTotal = computed(() =>
    this.imagePayrollWeekCards().at(-1)?.total || 0,
  );

  protected readonly payrollTopEarners = computed<PayrollTopEarnerLine[]>(() =>
    [...this.scopedPayrollLines().reduce((users, line) => {
      const current = users.get(line.user.id) || { user: line.user, hours: 0, pay: 0 };
      current.hours = Number((current.hours + line.totalHours).toFixed(2));
      current.pay = Number((current.pay + line.grandTotal).toFixed(2));
      users.set(line.user.id, current);
      return users;
    }, new Map<number, PayrollTopEarnerLine>()).values()]
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

  protected readonly attendanceTrendChartSeries = computed<PayrollTrendSeries>(() => {
    const period = this.attendanceTrendPeriod();
    const allDays = this.attendanceUserGroups().flatMap((group) =>
      group.weeks.flatMap((week) =>
        week.days.map((day) => ({
          userId: group.user.id,
          userName: group.user.name,
          date: day.date,
          hours: day.workedHours,
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

      currentGroup.totals.set(day.userId, Number(((currentGroup.totals.get(day.userId) || 0) + day.hours).toFixed(2)));
      groups.set(grouping.key, currentGroup);

      const currentUser = totalsByUser.get(day.userId) || { userName: day.userName, total: 0 };
      currentUser.total = Number((currentUser.total + day.hours).toFixed(2));
      totalsByUser.set(day.userId, currentUser);
    }

    const orderedGroups = [...groups.values()].sort((a, b) => a.sortValue - b.sortValue);
    const topUsers = [...totalsByUser.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 4);

    return {
      labels: orderedGroups.map((group) => group.label),
      datasets: topUsers.map(([userId, info]) => ({
        label: info.userName,
        data: orderedGroups.map((group) => Number((group.totals.get(userId) || 0).toFixed(2))),
      })),
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
  private billingInvoiceSequence = 0;
  private restoringBillingInvoice = false;
  private billingCatalogLoaded = false;
  private saleSuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private inventorySuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private creditPaymentSuccessTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pettyCashToastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private payrollToastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private selfAttendanceToastTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private priceChangeAlertIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly pettyCashPageSize = 10;
  protected readonly financialMovements = signal<FinancialMovement[]>([]);
  protected readonly financialMovementsLoading = signal(false);
  protected readonly financialMovementsSaving = signal(false);
  protected readonly financialMovementsError = signal('');
  protected readonly financialMovementModalOpen = signal(false);
  protected readonly expandedFinancialDayKeys = signal<string[]>([]);
  protected readonly expandedFinancialTypeKeys = signal<string[]>([]);
  protected readonly expandedFinancialPaymentKeys = signal<string[]>([]);
  protected readonly financialMovementDraft = signal<FinancialMovementDraft>(this.defaultFinancialMovementDraft());
  protected readonly selectedFinancialPeriod = signal(this.todayDateKey().slice(0, 7));
  protected readonly financialMovementTypes = [
    { id: 'entrada' as const, label: 'Entrada' },
    { id: 'salida' as const, label: 'Salida' },
  ];
  protected readonly financialPaymentMethods = [
    { id: 'efectivo' as const, label: 'Efectivo' },
    { id: 'transferencia' as const, label: 'Transferencia' },
    { id: 'tarjeta_credito' as const, label: 'Tarjeta de credito' },
  ];
  protected readonly financialMovementTargets = [
    { id: 'corte_dia' as const, label: 'Corte del dia' },
    { id: 'caja_chica' as const, label: 'Caja chica' },
    { id: 'cuenta_bancaria' as const, label: 'Cuenta bancaria' },
    { id: 'tarjeta_credito' as const, label: 'Tarjeta de credito' },
  ];
  protected readonly financialBankAccounts = [
    '24320153950 - Melvin Rolando Pena',
  ];
  protected readonly financialCreditCards = [
    'Tarjeta Atlantida - Seydi Maribel Pena',
    'Tarjeta Atlantida - Melvin Rolando Pena',
    'Tarjeta Atlantida - Melvin Edgardo Pena',
  ];
  protected readonly financialCategories = [
    'Operacion',
    'Compra menor',
    'Servicio',
    'Transporte',
    'Proveedor',
    'Banco',
    'Tarjeta',
    'Otro',
  ];
  protected readonly activeFinancialMovements = computed(() =>
    this.financialMovements().filter((movement) => movement.status !== 'anulado'),
  );
  protected readonly financialEntriesTotal = computed(() =>
    this.activeFinancialMovements()
      .filter((movement) => movement.movementType === 'entrada')
      .reduce((total, movement) => total + movement.amount, 0),
  );
  protected readonly financialOutputsTotal = computed(() =>
    this.activeFinancialMovements()
      .filter((movement) => movement.movementType === 'salida')
      .reduce((total, movement) => total + movement.amount, 0),
  );
  protected readonly financialCashImpact = computed(() =>
    this.activeFinancialMovements()
      .filter((movement) => movement.paymentMethod === 'efectivo')
      .reduce((total, movement) => total + (movement.movementType === 'entrada' ? movement.amount : -movement.amount), 0),
  );
  protected readonly financialBankPendingTotal = computed(() =>
    this.activeFinancialMovements()
      .filter((movement) => movement.paymentMethod === 'transferencia')
      .reduce((total, movement) => total + (movement.movementType === 'entrada' ? movement.amount : -movement.amount), 0),
  );
  protected readonly financialCreditCardDue = computed(() =>
    this.activeFinancialMovements()
      .filter((movement) => movement.paymentMethod === 'tarjeta_credito' && movement.movementType === 'salida')
      .reduce((total, movement) => total + movement.amount, 0),
  );
  protected readonly financialDayGroups = computed<FinancialDayGroup[]>(() => {
    const dayMap = new Map<string, FinancialMovement[]>();

    for (const movement of this.financialMovements()) {
      const key = this.financialMovementDayKey(movement.date);
      dayMap.set(key, [...(dayMap.get(key) || []), movement]);
    }

    return [...dayMap.entries()]
      .map(([key, movements]) => {
        const movementGroups = (['entrada', 'salida'] as FinancialMovementType[])
          .map((movementType) => {
            const typeMovements = movements.filter((movement) => movement.movementType === movementType);
            const typeKey = `${key}-${movementType}`;
            const paymentGroups = (['efectivo', 'transferencia', 'tarjeta_credito'] as FinancialPaymentMethod[])
              .map((paymentMethod) => {
                const paymentMovements = typeMovements.filter((movement) => movement.paymentMethod === paymentMethod);
                return {
                  key: `${typeKey}-${paymentMethod}`,
                  label: this.financialPaymentMethodLabel(paymentMethod),
                  paymentMethod,
                  movements: paymentMovements,
                  total: paymentMovements.reduce((total, movement) => total + movement.amount, 0),
                  count: paymentMovements.length,
                };
              })
              .filter((group) => group.count > 0);

            return {
              key: typeKey,
              label: this.financialMovementTypeLabel(movementType),
              movementType,
              movements: typeMovements,
              paymentGroups,
              total: typeMovements.reduce((total, movement) => total + movement.amount, 0),
              count: typeMovements.length,
            };
          })
          .filter((group) => group.count > 0);

        const entriesTotal = movements
          .filter((movement) => movement.movementType === 'entrada')
          .reduce((total, movement) => total + movement.amount, 0);
        const outputsTotal = movements
          .filter((movement) => movement.movementType === 'salida')
          .reduce((total, movement) => total + movement.amount, 0);

        return {
          key,
          label: this.formatInvoiceDayLabel(key),
          movements,
          movementGroups,
          entriesTotal,
          outputsTotal,
          netTotal: entriesTotal - outputsTotal,
          count: movements.length,
        };
      })
      .sort((left, right) => right.key.localeCompare(left.key));
  });
  protected readonly financialMovementsTrend = computed(() => {
    const days = new Map<string, { key: string; label: string; entradas: number; salidas: number; tarjeta: number }>();

    for (const movement of this.activeFinancialMovements()) {
      const key = this.financialMovementDayKey(movement.date);
      const existing = days.get(key) || {
        key,
        label: this.formatReferenceDate(key),
        entradas: 0,
        salidas: 0,
        tarjeta: 0,
      };

      if (movement.movementType === 'entrada') {
        existing.entradas += movement.amount;
      } else {
        existing.salidas += movement.amount;
      }

      if (movement.paymentMethod === 'tarjeta_credito') {
        existing.tarjeta += movement.amount;
      }

      days.set(key, existing);
    }

    return [...days.values()].sort((left, right) => left.key.localeCompare(right.key));
  });

  protected readonly salesProfitabilityKpiRows = computed(() => {
    const hiddenKpis = new Set(['invoice_count', 'products_sold', 'avg_ticket', 'customers_served']);
    return (this.salesProfitabilityAnalytics()?.kpis || []).filter((kpi) => !hiddenKpis.has(kpi.key));
  });
  protected readonly salesProfitabilityStatusClass = computed(() =>
    `profitability-status ${this.salesProfitabilityAnalytics()?.profitability.status.level || 'regular'}`,
  );
  protected readonly salesProfitabilityKardexCategories = computed(() => {
    const rows = this.salesProfitabilityAnalytics()?.kardex.rows || [];
    return ['Todas', ...[...new Set(rows.map((row) => row.category || 'Sin categoria'))].sort((a, b) => a.localeCompare(b))];
  });
  protected readonly salesProfitabilityKardexWarehouses = computed(() => {
    const rows = this.salesProfitabilityAnalytics()?.kardex.rows || [];
    return ['Todas', ...[...new Set(rows.map((row) => row.warehouse || 'Principal'))].sort((a, b) => a.localeCompare(b))];
  });
  protected readonly filteredSalesProfitabilityKardexRows = computed(() => {
    const rows = this.salesProfitabilityAnalytics()?.kardex.rows || [];
    const productFilter = this.normalizeText(this.salesProfitabilityKardexProductFilter());
    const categoryFilter = this.salesProfitabilityKardexCategoryFilter();
    const warehouseFilter = this.salesProfitabilityKardexWarehouseFilter();
    const dateFilter = this.salesProfitabilityKardexDateFilter();

    return rows.filter((row) => {
      const matchesProduct = !productFilter || this.normalizeText(`${row.productName} ${row.document}`).includes(productFilter);
      const matchesCategory = categoryFilter === 'Todas' || row.category === categoryFilter;
      const matchesWarehouse = warehouseFilter === 'Todas' || row.warehouse === warehouseFilter;
      const matchesDate = !dateFilter || String(row.date || '').slice(0, 10) === dateFilter;
      return matchesProduct && matchesCategory && matchesWarehouse && matchesDate;
    });
  });
  protected readonly salesProfitabilityReportOptions = computed(() => this.salesProfitabilityAnalytics()?.reports || []);
  protected readonly profitabilityPageSize = 10;
  protected readonly salesProfitabilityMonthOptions = computed(() => {
    const analytics = this.salesProfitabilityAnalytics();
    const selectedPeriod = this.selectedSalesProfitabilityPeriod();
    const selectedOption = {
      key: selectedPeriod,
      label: this.formatSalesProfitabilityPeriodLabel(selectedPeriod),
      year: Number(selectedPeriod.slice(0, 4)),
      month: Number(selectedPeriod.slice(5, 7)),
      movements: 0,
    };

    const availableMonths = analytics?.availableMonths || [];

    if (!analytics || availableMonths.length === 0) {
      return [selectedOption];
    }

    const months = availableMonths.map((period) => ({
      ...period,
      label: this.capitalizeSentence(period.label || this.formatSalesProfitabilityPeriodLabel(period.key)),
    }));

    return months.some((period) => period.key === selectedPeriod) ? months : [selectedOption, ...months];
  });

  protected readonly maxGeneratedWeeklyPay = computed(() =>
    Math.max(1, ...this.generatedPayrollTopEarners().map((line) => line.pay)),
  );

  constructor(
    private readonly http: HttpClient,
    private readonly facturacionApi: FacturacionApiService,
  ) {
    this.ensureBillingInvoiceSession();
    this.restoreInventoryColumns();
    document.addEventListener('pointerdown', this.trackEditablePointerDown, true);

    effect(() => {
      this.invoiceTrendPoints();
      this.activeThemeId();
      this.updateInvoicesSalesTrendChart();
    });

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
      this.updateProfitabilitySalesTrendChart();
      this.updatePayrollTrendChart();
      this.updatePurchasesTrendChart();
      this.updateCostsDistributionChart();
      this.updateCostsEvolutionChart();
      this.updateCostsCategoryChart();
      this.updateAuditUserTrendChart();
      this.updateDashboardModuleCharts();
    });

    effect(() => {
      this.applyPageZoom(this.pageZoomPercent());
    });

    effect(() => {
      this.applySystemFont(this.systemFont());
    });

    effect(() => {
      this.cartDetails();
      this.cartTotal();
      this.saleChangeDue();
      this.saleReceivedAmount();
      this.selectedCustomer();
      this.selectedCustomerId();
      this.selectedPaymentMethod();
      this.purchaseCosts();
      this.salePrices();
      this.activeQuoteId();
      this.activeQuoteNumber();
      this.activeMode();
      this.syncActiveBillingInvoiceSession();
      this.syncCustomerDisplayWindow();
    });

    this.startPriceChangeAlertWatcher();

    effect(() => {
      const users = this.attendanceUsers();
      const bonusesByWeek = this.payrollBonuses();
      const hours = this.payrollHours();
      const schedules = this.payrollSchedules();

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

        const sanitizedSchedules: PayrollScheduleMatrix = {};

        for (const user of users) {
          sanitizedSchedules[user.id] = this.buildPayrollScheduleWeek(schedules[user.id]);
        }

        localStorage.setItem(payrollScheduleStorageKey, JSON.stringify(sanitizedSchedules));
      } catch {
        return;
      }
    });

    try {
      const savedTheme = localStorage.getItem('yahweh-rohi-theme') as ThemeId | null;
      const defaultThemeMigrationApplied = localStorage.getItem(defaultThemeMigrationStorageKey);
      const savedFavoriteProductIds = localStorage.getItem('yahweh-rohi-favorite-products');
      const savedSidebarCollapsed = localStorage.getItem('yahweh-rohi-sidebar-collapsed');
      const savedPageZoom = Number(localStorage.getItem('yahweh-rohi-page-zoom') || 100);
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

      if (savedSidebarCollapsed !== null) {
        this.sidebarCollapsed.set(savedSidebarCollapsed === '1');
      }

      if (Number.isFinite(savedPageZoom)) {
        this.pageZoomPercent.set(this.clampPageZoom(savedPageZoom));
      }

      this.loadSystemSettings();

      const savedUser = localStorage.getItem(sessionStorageKey);

      this.loadLoginUsers();

      if (savedUser) {
        const restoredPage = this.restoreSavedActivePage();
        this.currentUser.set(JSON.parse(savedUser) as LoginResponse['user']);
        this.isAuthenticated.set(true);
        this.loadCustomers();
        if (restoredPage === 'billing') {
          this.loadBillingProductsFromDatabase();
        }
        void this.preloadAuthenticatedModuleData();
        this.activatePage(restoredPage, false);
      }
    } catch {
      this.activeThemeId.set('black-green');
    }
  }

  ngOnDestroy(): void {
    this.inventoryConfirmResolve?.(false);
    if(this.inventoryUiNoticeTimer)clearTimeout(this.inventoryUiNoticeTimer);
    if (this.detailNoticeTimer) clearTimeout(this.detailNoticeTimer);
    if (this.dailySalesResultsTimeout) clearTimeout(this.dailySalesResultsTimeout);
    if (this.billingSearchFocusTimeoutId) {
      clearTimeout(this.billingSearchFocusTimeoutId);
      this.billingSearchFocusTimeoutId = null;
    }
    document.removeEventListener('pointerdown', this.trackEditablePointerDown, true);
    this.salesTrendChart?.destroy();
    this.profitabilitySalesTrendChart?.destroy();
    this.invoicesSalesTrendChart?.destroy();
    this.creditsTrendChart?.destroy();
    this.creditHistoryTrendChart?.destroy();
    this.attendanceTrendChart?.destroy();
    this.payrollTrendChart?.destroy();
    this.pettyCashTrendChart?.destroy();
    this.financialMovementsTrendChart?.destroy();
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
    this.customerDisplayWindow?.close();
    this.customerDisplayWindow = null;

    if (this.saleSuccessTimeoutId !== null) {
      clearTimeout(this.saleSuccessTimeoutId);
    }

    if (this.inventorySuccessTimeoutId !== null) {
      clearTimeout(this.inventorySuccessTimeoutId);
    }

    if (this.creditPaymentSuccessTimeoutId !== null) {
      clearTimeout(this.creditPaymentSuccessTimeoutId);
    }

    if (this.pettyCashToastTimeoutId !== null) {
      clearTimeout(this.pettyCashToastTimeoutId);
    }

    if (this.payrollToastTimeoutId !== null) {
      clearTimeout(this.payrollToastTimeoutId);
    }

    if (this.selfAttendanceToastTimeoutId !== null) {
      clearTimeout(this.selfAttendanceToastTimeoutId);
    }

    if (this.priceChangeAlertIntervalId !== null) {
      clearInterval(this.priceChangeAlertIntervalId);
    }
  }

  protected setMode(mode: Mode): void {
    this.activeMode.set(mode);
    this.customerModalOpen.set(false);
    this.supplierModalOpen.set(false);
    if (mode === 'purchase') {
      this.activeQuoteId.set(null);
      this.activeQuoteNumber.set('');
      this.quoteModalOpen.set(false);
    }
    this.scheduleBillingSearchFocus();
  }

  private createBillingInvoiceSession(title?: string): BillingInvoiceSession {
    this.billingInvoiceSequence += 1;
    return {
      id: `billing-${Date.now()}-${this.billingInvoiceSequence}`,
      title: title || `Factura pendiente ${this.billingInvoiceSequence}`,
      cart: [],
      purchaseCosts: {},
      salePrices: {},
      paymentMethod: 'efectivo',
      customerName: 'Cliente final',
      customerId: null,
      receivedAmount: '',
      quoteId: null,
      quoteNumber: '',
      createdAt: new Date().toISOString(),
    };
  }

  private ensureBillingInvoiceSession(): void {
    if (this.billingInvoiceSessions().length > 0) {
      return;
    }

    const session = this.createBillingInvoiceSession('Factura pendiente 1');
    this.billingInvoiceSessions.set([session]);
    this.activeBillingInvoiceId.set(session.id);
  }

  private syncActiveBillingInvoiceSession(): void {
    if (this.restoringBillingInvoice || this.activeMode() !== 'sale') {
      return;
    }

    const activeId = this.activeBillingInvoiceId();
    if (!activeId) {
      return;
    }

    this.billingInvoiceSessions.update((sessions) =>
      sessions.map((session) =>
        session.id === activeId
          ? {
              ...session,
              cart: this.cart().map((line) => ({ ...line })),
              purchaseCosts: { ...this.purchaseCosts() },
              salePrices: { ...this.salePrices() },
              paymentMethod: this.selectedPaymentMethod(),
              customerName: this.selectedCustomer(),
              customerId: this.selectedCustomerId(),
              receivedAmount: this.saleReceivedAmount(),
              quoteId: this.activeQuoteId(),
              quoteNumber: this.activeQuoteNumber(),
            }
          : session,
      ),
    );
  }

  private restoreBillingInvoiceSession(session: BillingInvoiceSession): void {
    this.restoringBillingInvoice = true;
    this.cart.set(session.cart.map((line) => ({ ...line })));
    this.purchaseCosts.set({ ...session.purchaseCosts });
    this.salePrices.set({ ...session.salePrices });
    this.selectedPaymentMethod.set(session.paymentMethod);
    this.selectedCustomer.set(session.customerName || 'Cliente final');
    this.selectedCustomerId.set(session.customerId);
    this.saleReceivedAmount.set(session.receivedAmount || '');
    this.selectedSupplier.set('');
    this.activeQuoteId.set(session.quoteId);
    this.activeQuoteNumber.set(session.quoteNumber || '');
    this.restoringBillingInvoice = false;
  }

  protected createBillingInvoice(): void {
    this.syncActiveBillingInvoiceSession();
    const session = this.createBillingInvoiceSession();
    this.billingInvoiceSessions.update((sessions) => [...sessions, session]);
    this.activeBillingInvoiceId.set(session.id);
    this.restoreBillingInvoiceSession(session);
    this.activeMode.set('sale');
    this.checkoutError.set('');
    this.searchTerm.set('');
  }

  protected selectBillingInvoice(sessionId: string): void {
    if (this.activeBillingInvoiceId() === sessionId) {
      return;
    }

    this.syncActiveBillingInvoiceSession();
    const session = this.billingInvoiceSessions().find((item) => item.id === sessionId);
    if (!session) {
      return;
    }

    this.activeBillingInvoiceId.set(session.id);
    this.restoreBillingInvoiceSession(session);
    this.activeMode.set('sale');
    this.checkoutError.set('');
  }

  protected closeBillingInvoice(sessionId: string, event?: Event): void {
    event?.stopPropagation();
    const sessions = this.billingInvoiceSessions();

    if (sessions.length <= 1) {
      this.resetCart();
      return;
    }

    const remaining = sessions.filter((session) => session.id !== sessionId);
    this.billingInvoiceSessions.set(remaining);

    if (this.activeBillingInvoiceId() === sessionId) {
      const nextSession = remaining[remaining.length - 1];
      this.activeBillingInvoiceId.set(nextSession.id);
      this.restoreBillingInvoiceSession(nextSession);
    }
  }

  protected billingInvoiceItemCount(session: BillingInvoiceSession): number {
    return session.cart.reduce((total, line) => total + line.quantity, 0);
  }

  protected billingInvoiceTotal(session: BillingInvoiceSession): number {
    return session.cart.reduce((total, line) => {
      const product = this.products().find((item) => item.id === line.productId);
      const price = session.salePrices[line.productId] ?? product?.salePrice ?? 0;
      return total + price * line.quantity;
    }, 0);
  }

  protected billingInvoiceLabel(session: BillingInvoiceSession): string {
    const index = this.billingInvoiceSessions().findIndex((item) => item.id === session.id);
    return `Factura #${index >= 0 ? index + 1 : 1}`;
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
    this.scheduleVisibleChartsRefresh();
  }

  protected selectCreditCustomer(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCreditCustomerId.set(value ? Number(value) : null);
    this.scheduleVisibleChartsRefresh();
  }

  protected setCreditViewMode(mode: CreditViewMode): void {
    this.creditViewMode.set(mode);
  }

  protected setCreditTrendPeriod(period: CreditTrendPeriod): void {
    this.creditTrendPeriod.set(period);
    this.scheduleVisibleChartsRefresh();
  }

  protected openCreditPaymentModal(customer: CreditCustomerGroup): void {
    this.creditPaymentCustomer.set(customer);
    this.creditPaymentAmount.set('');
    this.creditPaymentMethod.set('transferencia');
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

  protected closeCreditPaymentVoucherModal(): void {
    this.creditPaymentVoucherModalOpen.set(false);
  }

  protected async openCreditHistoryModal(customer: CreditCustomerGroup): Promise<void> {
    this.creditHistoryCustomer.set(customer);
    this.creditHistoryPayments.set([]);
    this.creditHistoryError.set('');
    this.expandedCreditHistoryYears.set([]);
    this.expandedCreditHistoryMonths.set([]);
    this.expandedCreditHistoryWeeks.set([]);
    this.creditHistoryModalOpen.set(true);
    await this.loadCreditPaymentHistory(customer.customerId);
  }

  protected closeCreditHistoryModal(): void {
    this.creditHistoryModalOpen.set(false);
    this.creditHistoryCustomer.set(null);
    this.creditHistoryPayments.set([]);
    this.creditHistoryError.set('');
  }

  protected async openGeneralCreditHistoryModal(): Promise<void> {
    this.generalCreditHistoryModalOpen.set(true);
    this.generalCreditHistoryPayments.set([]);
    this.generalCreditHistoryError.set('');
    this.expandedGeneralCreditHistoryDays.set([]);
    this.expandedGeneralCreditHistoryCustomers.set([]);
    await this.loadGeneralCreditPaymentHistory();
  }

  protected closeGeneralCreditHistoryModal(): void {
    this.generalCreditHistoryModalOpen.set(false);
    this.generalCreditHistoryPayments.set([]);
    this.generalCreditHistoryError.set('');
    this.expandedGeneralCreditHistoryDays.set([]);
    this.expandedGeneralCreditHistoryCustomers.set([]);
  }

  protected toggleGeneralCreditHistoryDay(dayKey: string): void {
    this.expandedGeneralCreditHistoryDays.update((keys) =>
      keys.includes(dayKey) ? keys.filter((key) => key !== dayKey) : [...keys, dayKey],
    );
  }

  protected isGeneralCreditHistoryDayExpanded(dayKey: string): boolean {
    return this.expandedGeneralCreditHistoryDays().includes(dayKey);
  }

  protected toggleGeneralCreditHistoryCustomer(customerKey: string): void {
    this.expandedGeneralCreditHistoryCustomers.update((keys) =>
      keys.includes(customerKey) ? keys.filter((key) => key !== customerKey) : [...keys, customerKey],
    );
  }

  protected isGeneralCreditHistoryCustomerExpanded(customerKey: string): boolean {
    return this.expandedGeneralCreditHistoryCustomers().includes(customerKey);
  }

  protected toggleCreditHistoryYear(yearKey: string): void {
    this.expandedCreditHistoryYears.update((keys) =>
      keys.includes(yearKey) ? keys.filter((key) => key !== yearKey) : [...keys, yearKey],
    );
  }

  protected toggleCreditHistoryMonth(monthKey: string): void {
    this.expandedCreditHistoryMonths.update((keys) =>
      keys.includes(monthKey) ? keys.filter((key) => key !== monthKey) : [...keys, monthKey],
    );
  }

  protected toggleCreditHistoryWeek(weekKey: string): void {
    this.expandedCreditHistoryWeeks.update((keys) =>
      keys.includes(weekKey) ? keys.filter((key) => key !== weekKey) : [...keys, weekKey],
    );
  }

  protected setCreditHistoryTrendPeriod(period: CreditHistoryTrendPeriod): void {
    this.creditHistoryTrendPeriod.set(period);
    queueMicrotask(() => this.updateCreditHistoryTrendChart());
  }

  protected selectCreditHistoryYear(yearKey: string): void {
    this.selectedCreditHistoryYear.set(yearKey);
    this.expandedCreditHistoryYears.set([yearKey]);
  }

  protected creditHistoryTrendPeriodLabel(): string {
    const period = this.creditHistoryTrendPeriod();

    if (period === 'week') {
      return 'Total por semana';
    }

    return period === 'year' ? 'Total por año' : 'Total por mes';
  }

  protected isCreditHistoryYearExpanded(yearKey: string): boolean {
    return this.expandedCreditHistoryYears().includes(yearKey);
  }

  protected isCreditHistoryMonthExpanded(monthKey: string): boolean {
    return this.expandedCreditHistoryMonths().includes(monthKey);
  }

  protected isCreditHistoryWeekExpanded(weekKey: string): boolean {
    return this.expandedCreditHistoryWeeks().includes(weekKey);
  }

  protected creditHistoryWeeks(payments: CreditPayment[]): CreditPaymentPeriodGroup[] {
    return this.groupCreditPaymentsByPeriod(payments, 'week');
  }

  protected downloadCreditPaymentVoucher(payment: CreditPayment | CreditPaymentVoucher | null): void {
    if (!payment) {
      return;
    }

    const isCurrentVoucher = 'currentBalance' in payment;
    const currentPending = isCurrentVoucher ? payment.currentBalance : this.creditCustomerPendingTotal(payment.customerId);
    const previousBalance = isCurrentVoucher ? payment.previousBalance : currentPending + payment.amount;

    this.openPrintableCreditPaymentVoucher({
      id: payment.id,
      customerName: payment.customerName || 'Cliente sin nombre',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      previousBalance,
      currentBalance: currentPending,
      userName: payment.userName,
      createdAt: payment.createdAt,
      invoiceCount: 'invoicesTouched' in payment ? payment.invoicesTouched : 1,
      description: payment.description || 'Abono a credito',
    });
  }

  private creditCustomerPendingTotal(customerId: number): number {
    return this.creditLines()
      .filter((credit) => credit.customerId === customerId)
      .reduce((total, credit) => total + credit.pendingAmount, 0);
  }

  private async loadCreditPaymentHistory(customerId: number): Promise<void> {
    this.creditHistoryLoading.set(true);
    this.creditHistoryError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getCreditPaymentHistory(customerId)
        : await firstValueFrom(this.http.get<CreditPaymentsResponse>(`/api/credit-payments/customer/${encodeURIComponent(customerId)}`));
      this.creditHistoryPayments.set(response.payments);
      const years = [...new Set(response.payments.map((payment) => String(this.parseDate(payment.createdAt).getFullYear())))]
        .sort((left, right) => right.localeCompare(left));
      const selectedYear = years[0] || '';
      this.selectedCreditHistoryYear.set(selectedYear);
      this.expandedCreditHistoryYears.set(selectedYear ? [selectedYear] : []);
      this.expandedCreditHistoryMonths.set([]);
      this.expandedCreditHistoryWeeks.set([]);
      queueMicrotask(() => this.updateCreditHistoryTrendChart());
    } catch (error) {
      this.creditHistoryPayments.set([]);
      this.creditHistoryError.set(this.extractErrorMessage(error, 'No se pudo cargar el historico de abonos.'));
    } finally {
      this.creditHistoryLoading.set(false);
    }
  }

  private async loadGeneralCreditPaymentHistory(): Promise<void> {
    this.generalCreditHistoryLoading.set(true);
    this.generalCreditHistoryError.set('');

    try {
      const response = this.desktopApi?.getCreditPaymentsHistory
        ? await this.desktopApi.getCreditPaymentsHistory(2500)
        : await firstValueFrom(this.http.get<CreditPaymentsResponse>('/api/credit-payments/history?limit=2500'));
      this.generalCreditHistoryPayments.set(response.payments);
      const firstDay = this.generalCreditHistoryDayGroups()[0]?.key || '';
      this.expandedGeneralCreditHistoryDays.set(firstDay ? [firstDay] : []);
    } catch (error) {
      this.generalCreditHistoryPayments.set([]);
      this.generalCreditHistoryError.set(this.extractErrorMessage(error, 'No se pudo cargar el historico general de abonos.'));
    } finally {
      this.generalCreditHistoryLoading.set(false);
    }
  }

  protected updateCreditPaymentAmount(event: Event): void {
    this.creditPaymentAmount.set((event.target as HTMLInputElement).value);
  }

  protected updateCreditPaymentDescription(event: Event): void {
    this.creditPaymentDescription.set((event.target as HTMLInputElement).value);
  }

  protected updateCreditPaymentMethod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as CreditPaymentMethod;
    this.creditPaymentMethod.set(value === 'efectivo' ? 'efectivo' : 'transferencia');
  }

  private mergeCreditPaymentMethodLabels(current: string, next: string): string {
    const currentLabel = current || 'Sin abono';
    const nextLabel = next || 'Sin abono';

    if (currentLabel === nextLabel) {
      return currentLabel;
    }

    if (currentLabel === 'Sin abono') {
      return nextLabel;
    }

    if (nextLabel === 'Sin abono') {
      return currentLabel;
    }

    return 'Mixto';
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
        paymentMethod: this.creditPaymentMethod(),
        description: this.creditPaymentDescription().trim() || 'Abono a credito',
      };
      const response = this.desktopApi
        ? await this.desktopApi.createCreditPayment(payload)
        : await firstValueFrom(this.http.post<CreditPaymentCreateResponse>('/api/credits/payments', payload));
      const payment = response.payment;
      const appliedAmount = payment.appliedAmount || payment.amount;
      const previousBalance = customer.total;
      const currentBalance = Math.max(previousBalance - appliedAmount, 0);
      const voucher: CreditPaymentVoucher = {
        id: null,
        description: payload.description,
        amount: appliedAmount,
        paymentMethod: payment.paymentMethod,
        customerId: payment.customerId,
        customerName: customer.customerName,
        invoiceId: payment.allocations[0]?.invoiceId ?? null,
        userId: currentUser.id,
        userName: currentUser.nombre || currentUser.usuario,
        createdAt: payment.createdAt,
        previousBalance,
        currentBalance,
        appliedAmount: payment.appliedAmount,
        remainingAmount: currentBalance,
        invoicesTouched: payment.invoicesTouched,
        linesTouched: payment.linesTouched,
        paymentsCreated: payment.paymentsCreated,
        allocations: payment.allocations,
      };

      await this.loadCredits();
      await this.loadCustomers();
      await this.loadDashboardSalesSummary();
      await this.loadDailyCutPreview(this.todayDateKey(), currentUser.id).catch(() => null);
      this.lastCreditPaymentVoucher.set(voucher);
      this.creditPaymentVoucherModalOpen.set(true);
      this.creditPaymentModalOpen.set(false);
      this.creditPaymentCustomer.set(null);
      this.creditPaymentAmount.set('');
      this.creditPaymentDescription.set('Abono a credito');
      this.showCreditPaymentSuccess(
        `Abono aplicado correctamente a ${response.payment.linesTouched} linea(s) en ${response.payment.invoicesTouched} factura(s).`,
      );
    } catch (error) {
      this.creditPaymentError.set(this.extractErrorMessage(error, 'No se pudo registrar el abono.'));
    } finally {
      this.creditPaymentSaving.set(false);
    }
  }

  protected updateCostYear(event: Event): void {
    this.selectedCostYear.set(Number((event.target as HTMLSelectElement).value) || new Date().getFullYear());
    void this.loadCostAnalysisData();
  }

  protected updateCostMonth(event: Event): void {
    this.selectedCostMonth.set(Number((event.target as HTMLSelectElement).value) || new Date().getMonth() + 1);
    void this.loadOperationalCosts();
    void this.loadCostAnalysisInvoiceLines();
    queueMicrotask(() => this.updateCostsEvolutionChart());
  }

  protected updateCostPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as CostAnalysisPeriod;
    this.selectedCostPeriod.set(['week', 'month', 'year'].includes(value) ? value : 'month');
    void this.loadCostAnalysisInvoiceLines();
  }

  protected updateCostWeek(event: Event): void {
    const value = (event.target as HTMLSelectElement).value || this.formatDateKey(this.startOfWeek(new Date()));
    this.selectedCostWeek.set(value);
    void this.loadCostAnalysisInvoiceLines();
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
    this.updateDashboardPayrollChart();
  }

  protected setAttendanceTrendPeriod(value: PayrollTrendPeriod): void {
    this.attendanceTrendPeriod.set(value);
    this.updateAttendanceTrendChart();
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

  protected toggleCreditDay(dayKey: string): void {
    this.expandedCreditDayKeys.update((keys) =>
      keys.includes(dayKey) ? keys.filter((key) => key !== dayKey) : [...keys, dayKey],
    );
  }

  protected isCreditDayExpanded(dayKey: string): boolean {
    return this.expandedCreditDayKeys().includes(dayKey);
  }

  protected creditDayCustomerKey(dayKey: string, customerId: number): string {
    return `${dayKey}-${customerId}`;
  }

  protected toggleCreditDayCustomer(dayKey: string, customerId: number): void {
    const groupKey = this.creditDayCustomerKey(dayKey, customerId);
    this.expandedCreditDayCustomerKeys.update((keys) =>
      keys.includes(groupKey) ? keys.filter((key) => key !== groupKey) : [...keys, groupKey],
    );
  }

  protected isCreditDayCustomerExpanded(dayKey: string, customerId: number): boolean {
    return this.expandedCreditDayCustomerKeys().includes(this.creditDayCustomerKey(dayKey, customerId));
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
        this.formatCurrency(credit.paidAmount),
        this.formatCurrency(credit.pendingAmount),
        credit.createdAt || '-',
      ]),
    );

    this.openPrintableCreditReport({
      title: `Creditos de ${group.customerName}`,
      subtitle: `Cliente #${group.customerId} · ${group.customerPhone || 'Sin telefono'}`,
      summary: [
        ['Facturas', this.formatNumber(group.invoices.length)],
        ['Articulos', this.formatNumber(group.articleCount)],
        ['Total pendiente', this.formatCurrency(group.total)],
        ['Utilidad', this.formatCurrency(group.utility)],
      ],
      headers: ['Factura', 'Producto', 'Cantidad', 'Precio', 'Total', 'Abonado', 'Pendiente', 'Fecha'],
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
    ]);

    this.openPrintableCreditReport({
      title: `Factura #${invoice.invoiceId} - ${invoice.lines[0]?.createdAt || '-'}`,
      subtitle: `${invoice.customerName} · ${invoice.customerPhone || 'Sin telefono'}`,
      summary: [
        ['Articulos', this.formatNumber(invoice.lines.length)],
        ['Total factura', this.formatCurrency(invoice.originalTotal)],
        ['Total pendiente', this.formatCurrency(invoice.pendingAmount)],
      ],
      headers: ['ID', 'Producto', 'Cantidad', 'Precio', 'Total'],
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
      const response = await this.getInvoiceDetails(invoice.invoiceId);

      const rows = response.lines.map((line) => [
        line.sku || String(line.productId),
        line.productName,
        this.formatNumber(line.quantity),
        this.formatCurrency(line.salePrice),
        this.formatCurrency(line.total),
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
        headers: ['Codigo', 'Producto', 'Cantidad', 'Precio', 'Total'],
        rows,
      });
    } catch (error) {
      printWindow.close();
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudo exportar la factura.'));
    }
  }

  protected async exportInvoiceDayPdf(dayGroup: InvoiceDayGroup): Promise<void> {
    await this.exportInvoiceGroupPdf({
      title: `Facturas del dia - ${dayGroup.label}`,
      subtitle: `${this.formatNumber(dayGroup.invoices.length)} facturas emitidas`,
      invoices: dayGroup.invoices,
      total: dayGroup.total,
      itemCount: dayGroup.itemCount,
      scopeLabel: 'Dia',
      scopeValue: dayGroup.label,
    });
  }

  protected async exportInvoicePaymentPdf(paymentGroup: InvoicePaymentGroup): Promise<void> {
    await this.exportInvoiceGroupPdf({
      title: `Facturas por pago - ${paymentGroup.label}`,
      subtitle: `${this.formatNumber(paymentGroup.invoices.length)} facturas con forma de pago ${paymentGroup.label}`,
      invoices: paymentGroup.invoices,
      total: paymentGroup.total,
      itemCount: paymentGroup.itemCount,
      scopeLabel: 'Forma de pago',
      scopeValue: paymentGroup.label,
    });
  }

  private async exportInvoiceGroupPdf(group: {
    title: string;
    subtitle: string;
    invoices: InvoiceRow[];
    total: number;
    itemCount: number;
    scopeLabel: string;
    scopeValue: string;
  }): Promise<void> {
    const printWindow = this.openPrintableReportWindow();

    if (!printWindow) {
      this.invoiceError.set('No se pudo abrir la ventana de impresion. Revisa el bloqueo de ventanas emergentes.');
      return;
    }

    try {
      const details = await Promise.all(
        group.invoices.map(async (invoice) => ({
          invoice,
          response: await this.getInvoiceDetails(invoice.invoiceId),
        })),
      );

      const rows = details.flatMap(({ invoice, response }) =>
        response.lines.map((line) => [
          `#${invoice.invoiceId}`,
          this.formatTableDateTime(invoice.createdAt),
          invoice.customerName,
          invoice.paymentTypeName,
          line.sku || String(line.productId),
          line.productName,
          this.formatNumber(line.quantity),
          this.formatCurrency(line.salePrice),
          this.formatCurrency(line.total),
          invoice.statusName,
        ]),
      );

      this.writePrintableReport(printWindow, {
        title: group.title,
        subtitle: group.subtitle,
        summary: [
          [group.scopeLabel, group.scopeValue],
          ['Facturas', this.formatNumber(group.invoices.length)],
          ['Articulos', this.formatNumber(group.itemCount)],
          ['Total', this.formatCurrency(group.total)],
        ],
        headers: ['Factura', 'Fecha', 'Cliente', 'Pago', 'Codigo', 'Producto', 'Cant.', 'Precio', 'Total', 'Estado'],
        rows,
      });
    } catch (error) {
      printWindow.close();
      this.invoiceError.set(this.extractErrorMessage(error, 'No se pudo exportar el grupo de facturas.'));
    }
  }

  private getInvoiceDetails(invoiceId: number): Promise<InvoiceDetailsResponse> {
    return this.desktopApi
      ? this.desktopApi.getInvoiceDetails(invoiceId)
      : firstValueFrom(this.http.get<InvoiceDetailsResponse>(`/api/invoices/${invoiceId}/details`));
  }

  protected toggleInvoiceDay(key: string): void {
    this.expandedInvoiceDayKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected toggleInvoicePayment(key: string): void {
    this.expandedInvoicePaymentKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected toggleInvoiceMonthlySales(): void {
    this.invoiceMonthlySalesExpanded.update((expanded) => !expanded);
  }

  protected toggleInvoiceMasterTable(): void {
    this.invoiceMasterExpanded.update((expanded) => !expanded);
  }

  protected updateInvoiceMonthlyMonthsToShow(event: Event): void {
    this.invoiceMonthlyPage.set(1);
    const value = Number((event.target as HTMLSelectElement).value);
    this.invoiceMonthlyMonthsToShow.set(Number.isFinite(value) && value > 0 ? Math.min(value, 12) : 12);
  }

  protected setInvoiceMonthlyPage(page: number): void {
    this.invoiceMonthlyPage.set(Math.max(1, Math.min(page, this.invoiceMonthlyPageCount())));
  }

  protected updateInvoiceMonthlyPageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (![10, 25, 50, 100].includes(size)) return;
    this.invoiceMonthlyPageSize.set(size);
    this.invoiceMonthlyPage.set(1);
  }

  protected isInvoiceDayExpanded(key: string): boolean {
    return this.expandedInvoiceDayKeys().includes(key);
  }

  protected isInvoicePaymentExpanded(key: string): boolean {
    return this.expandedInvoicePaymentKeys().includes(key);
  }

  protected setInvoicePeriod(period: 'day' | 'week' | 'month' | 'all'): void {
    this.invoicePeriod.set(period); this.invoicePage.set(1); this.closeInvoicePreview();
    if (this.invoiceError()) void this.loadInvoicesPageData();
  }
  protected updateInvoiceDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) return;
    this.invoiceDate.set(value);
    if (this.invoicePeriod() === 'all') this.invoicePeriod.set('day');
    this.invoicePage.set(1); this.closeInvoicePreview();
    if (this.invoiceError()) void this.loadInvoicesPageData();
  }
  protected updateInvoiceGrouping(event: Event): void {
    this.invoiceGrouping.set((event.target as HTMLSelectElement).value === 'payment' ? 'payment' : 'none');
    this.invoicePage.set(1);
  }
  protected updateInvoicePageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if ([10, 25, 50, 100].includes(size)) this.invoicePageSize.set(size);
    this.invoicePage.set(1);
  }
  protected async openInvoicePreview(invoice: InvoiceRow): Promise<void> {
    const request = ++this.invoicePreviewRequest;
    this.invoicePreviewId.set(invoice.invoiceId);
    this.invoicePreviewLines.set([]); this.invoicePreviewError.set(''); this.invoicePreviewLoading.set(true);
    try {
      const response = await this.getInvoiceDetails(invoice.invoiceId);
      if (request === this.invoicePreviewRequest) this.invoicePreviewLines.set(response.lines);
    } catch (error) {
      if (request === this.invoicePreviewRequest) this.invoicePreviewError.set(this.extractErrorMessage(error, 'No se pudo cargar el detalle.'));
    } finally {
      if (request === this.invoicePreviewRequest) this.invoicePreviewLoading.set(false);
    }
  }
  protected closeInvoicePreview(): void {
    ++this.invoicePreviewRequest;
    this.invoicePreviewId.set(null); this.invoicePreviewLines.set([]);
    this.invoicePreviewLoading.set(false); this.invoicePreviewError.set('');
  }
  protected async exportFilteredInvoicesPdf(): Promise<void> {
    const invoices = this.filteredInvoiceRows();
    if (!invoices.length) return;
    await this.exportInvoiceGroupPdf({ title: 'Facturas filtradas',
      subtitle: `${invoices.length} facturas · Incluye los estados seleccionados`, invoices,
      total: invoices.reduce((sum, row) => sum + row.total, 0),
      itemCount: invoices.reduce((sum, row) => sum + row.itemCount, 0),
      scopeLabel: 'Alcance', scopeValue: 'Resultados de los filtros, incluidas anuladas si están visibles',
    });
  }

  protected async openInvoiceDetailModal(invoice: InvoiceRow): Promise<void> {
    this.detailSearch.set(''); this.detailStatus.set(''); this.detailPage.set(1); this.clearDetailSelection(); this.detailNotice.set(false);
    if (this.detailNoticeTimer) clearTimeout(this.detailNoticeTimer);
    this.invoiceDetailInvoice.set(invoice);
    this.invoiceDetailLines.set([]);
    this.invoiceDetailError.set('');
    this.invoiceDetailLoading.set(true);
    this.invoiceDetailModalOpen.set(true);

    try {
      const response = await this.getInvoiceDetails(invoice.invoiceId);

      if (this.invoiceDetailInvoice()?.invoiceId === invoice.invoiceId) this.invoiceDetailLines.set(response.lines);
    } catch (error) {
      if (this.invoiceDetailInvoice()?.invoiceId === invoice.invoiceId) this.invoiceDetailError.set(this.extractErrorMessage(error, 'No se pudo cargar el detalle de la factura.'));
    } finally {
      if (this.invoiceDetailInvoice()?.invoiceId === invoice.invoiceId) this.invoiceDetailLoading.set(false);
    }
  }

  protected closeInvoiceDetailModal(): void {
    if (this.detailNoticeTimer) clearTimeout(this.detailNoticeTimer);
    this.detailNotice.set(false);
    this.invoiceDetailModalOpen.set(false);
    this.invoiceDetailInvoice.set(null);
    this.invoiceDetailLines.set([]);
    this.invoiceDetailError.set('');
    this.invoiceDetailLoading.set(false);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ANULA O ACTIVA UNA FACTURA Y RECARGA INVENTARIO, TARJETAS, GRAFICO Y TABLA.
  // TERMINA LLAMANDO annulInvoice() O activateInvoice() EN server/data-access.js.
  protected async toggleInvoiceStatus(invoice: InvoiceRow): Promise<void> {
    if (this.isInvoiceAnnulled(invoice)) {
      await this.activateInvoice(invoice);
    } else {
      this.requestInvoiceAnnul(invoice);
    }
  }

  private async annulInvoice(invoice: InvoiceRow): Promise<void> {
    try {
      const currentUserId = this.currentUser()?.id ?? null;

      if (this.desktopApi) {
        await this.desktopApi.annulInvoice({ invoiceId: invoice.invoiceId, userId: currentUserId });
      } else {
        await firstValueFrom(this.http.post<AnnulInvoiceResponse>(`/api/invoices/${invoice.invoiceId}/annul`, {
          userId: currentUserId,
        }));
      }

      await this.loadInvoicesPageData();
      await this.fetchProducts(false);
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      if (this.dailySalesModalOpen()) {
        await this.loadTodayInvoices();
      }
      this.showInventorySuccess(`Factura #${invoice.invoiceId} anulada correctamente.`);
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo anular la factura.');
      this.invoiceError.set(message);
      this.invoiceAnnulError.set(message);
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
      const currentUserId = this.currentUser()?.id ?? null;

      if (this.desktopApi) {
        await this.desktopApi.activateInvoice({ invoiceId: invoice.invoiceId, userId: currentUserId });
      } else {
        await firstValueFrom(this.http.post<ActivateInvoiceResponse>(`/api/invoices/${invoice.invoiceId}/activate`, {
          userId: currentUserId,
        }));
      }

      await this.loadInvoicesPageData();
      await this.fetchProducts();
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      if (this.dailySalesModalOpen()) {
        await this.loadTodayInvoices();
      }
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
    this.dailySalesSelected.set(new Set());
    this.dailySalesPage.set(1);
    this.dailySalesModalOpen.set(true);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.daily-sales-modal .ghost-button')?.focus());
    void this.loadTodayInvoices();
  }

  protected closeDailySalesModal(): void {
    if (this.dailySalesResultsTimeout) clearTimeout(this.dailySalesResultsTimeout);
    this.dailySalesResultsTimeout = null;
    this.dailySalesResultsVisible.set(false);
    this.dailySalesModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected openProductCatalogModal(): void {
    this.modalTables.reset('catalog');
    this.productCatalogModalOpen.set(true);
  }

  protected closeProductCatalogModal(): void {
    this.productCatalogModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected productCatalogInitials(product: Product): string {
    return product.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'YR';
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE ALERTAS DE VENCIMIENTO EN FACTURACION.
  // RECARGA dbo.PRODUCTO_PROXIMO_VENCER POR MEDIO DE loadExpiringProducts().
  protected openExpiringProductsModal(): void {
    this.modalTables.reset('expiry');
    this.expiringProductsModalOpen.set(true);
    void this.loadExpiringProducts();
  }

  protected closeExpiringProductsModal(): void {
    this.expiringProductsModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected openLowStockAlertModal(): void {
    this.modalTables.reset('lowstock');
    this.lowStockAlertModalOpen.set(true);
  }

  protected closeLowStockAlertModal(): void {
    this.lowStockAlertModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected openSalesDropAlertModal(): void {
    this.salesDropAlertModalOpen.set(true);
    void this.loadSalesDropAlert();
  }

  protected closeSalesDropAlertModal(): void {
    this.salesDropAlertModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected async updateSystemFromDashboard(): Promise<void> {
    if (this.systemUpdateLoading()) {
      return;
    }

    const pageBeforeUpdate = this.activePage();
    const currentUser = this.currentUser();
    this.systemUpdateLoading.set(true);
    this.systemUpdateMessage.set('Actualizando sistema...');

    try {
      if (this.desktopApi?.updateSystem) {
        const response = await this.desktopApi.updateSystem();
        this.systemUpdateMessage.set(response.message || 'Sistema actualizado.');
      } else {
        await firstValueFrom(this.http.get('/api/health'));
        this.systemUpdateMessage.set('Sistema actualizado.');
      }

      try {
        if (currentUser) {
          localStorage.setItem(sessionStorageKey, JSON.stringify(currentUser));
        }
      } catch {
        // La sesion en memoria sigue activa aunque el navegador no permita persistirla.
      }

      this.refreshApplicationAfterUpdate(pageBeforeUpdate);
    } catch (error) {
      this.systemUpdateMessage.set(this.extractErrorMessage(error, 'No se pudo actualizar el sistema.'));
      this.systemUpdateLoading.set(false);
      return;
    }

    window.setTimeout(() => {
      this.systemUpdateLoading.set(false);
    }, 1200);
  }

  private refreshApplicationAfterUpdate(pageBeforeUpdate: Page): void {
    const page = availablePages.includes(pageBeforeUpdate) ? pageBeforeUpdate : 'dashboard';

    void this.loadLoginUsers();

    if (this.currentUser()) {
      void this.loadCustomers();
      this.activatePage(page, true);
      return;
    }

    this.activatePage('dashboard', false);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO ABRE EL MODAL DE CORTE EN FACTURACION.
  // LLAMA loadDailyCuts(), QUE CONSULTA dbo.CORTE_DIARIO Y dbo.PAGOS_CREDITO.
  protected openCutModal(): void {
    this.modalTables.reset('cuts');
    const today = this.todayDateKey();
    this.cutFilterFromDate.set(today);
    this.cutFilterToDate.set(today);
    this.selectedCutId.set(null);
    this.cutModalOpen.set(true);
    void this.loadDailyCuts();
  }

  protected openCutClosingFlow(cut: DailyCut | null = this.selectedCut()): void {
    const targetCut = cut || this.cutPreview();

    if (!targetCut) {
      this.cutError.set('Selecciona un corte abierto para cerrarlo.');
      return;
    }

    if (this.cutStatusClass(targetCut) !== 'open') {
      this.cutError.set('Solo se pueden cerrar cortes abiertos.');
      return;
    }

    this.cutModalOpen.set(false);
    this.logoutCutFromHistory.set(true);
    this.logoutCutTargetDate.set(String(targetCut.date).slice(0, 10));
    this.logoutCutTargetUserId.set(targetCut.userId);
    this.openLogoutCutModal();
  }

  protected closeCutModal(): void {
    this.cutModalOpen.set(false);
    this.scheduleBillingSearchFocus();
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
    this.creditPaymentRows.set([]);
    void this.loadLogoutCutPreview();
  }

  protected closeLogoutCutModal(): void {
    const shouldReturnToCuts = this.logoutCutFromHistory();
    this.logoutCutModalOpen.set(false);
    this.logoutCutError.set('');
    this.logoutCutFromHistory.set(false);
    this.logoutCutTargetDate.set(null);
    this.logoutCutTargetUserId.set(null);

    if (shouldReturnToCuts) {
      this.cutModalOpen.set(true);
      void this.loadDailyCuts();
    }
  }

  protected updateLogoutPhysicalCashCount(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    const roundedValue = Number.isFinite(value) && value >= 0 ? String(Math.round(value)) : '';
    input.value = roundedValue;
    this.logoutPhysicalCashCount.set(roundedValue);
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
      const today = this.todayDateKey();

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
    const targetDate = this.logoutCutTargetDate();
    const targetUserId = this.logoutCutTargetUserId();
    let resolvedUserId = targetUserId || currentUser?.id || 0;

    if (!resolvedUserId) {
      this.logoutCutPreview.set(null);
      this.logoutCutError.set('No hay un usuario autenticado para calcular el corte.');
      return;
    }

    this.logoutCutLoading.set(true);
    this.logoutCutError.set('');

    try {
      let cutDate = targetDate || this.todayDateKey();
      if (!targetDate) {
        let openCutsResponse = this.desktopApi
          ? await this.desktopApi.getDailyCuts(undefined, undefined, resolvedUserId)
          : await firstValueFrom(this.http.get<DailyCutsResponse>(`/api/daily-cuts?userId=${encodeURIComponent(resolvedUserId)}`));
        let openCut = openCutsResponse.cuts.find((cut) => Number(cut.statusId || 0) === 1);

        if (!openCut) {
          openCutsResponse = this.desktopApi
            ? await this.desktopApi.getDailyCuts()
            : await firstValueFrom(this.http.get<DailyCutsResponse>('/api/daily-cuts'));
          openCut = openCutsResponse.cuts.find((cut) => Number(cut.statusId || 0) === 1);
        }

        if (openCut?.date) {
          cutDate = String(openCut.date).slice(0, 10);
          resolvedUserId = openCut.userId || resolvedUserId;
          this.logoutCutTargetUserId.set(resolvedUserId);
        }
      }
      const cut = await this.loadDailyCutPreview(cutDate, resolvedUserId);
      this.logoutCutPreview.set(cut);
      this.logoutPhysicalCashCount.set(String(Math.round(cut.cashTotal || 0)));
      await this.loadCreditPaymentsForCut(cutDate, resolvedUserId);
    } catch (error) {
      this.logoutCutPreview.set(null);
      this.creditPaymentRows.set([]);
      this.logoutCutError.set(this.extractErrorMessage(error, 'No se pudo calcular el corte del dia.'));
    } finally {
      this.logoutCutLoading.set(false);
    }
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO GUARDA EL CORTE EN dbo.CORTE_DIARIO CON EL CONTEO FISICO DEL CAJERO.
  // DESPUES DE GUARDAR, CIERRA LA SESION Y EN ELECTRON CIERRA LA APLICACION.
  protected async saveLogoutCutAndClose(): Promise<void> {
    const physicalCashCount = Math.round(Number(this.logoutPhysicalCashCount()));
    const currentUser = this.currentUser();
    const targetDate = this.logoutCutTargetDate();
    const targetUserId = this.logoutCutTargetUserId();
    const previewCut = this.logoutCutPreview();
    const resolvedUserId = targetUserId || previewCut?.userId || currentUser?.id || 0;

    if (!Number.isFinite(physicalCashCount) || physicalCashCount < 0) {
      this.logoutCutError.set('Ingresa un conteo fisico valido.');
      return;
    }

    if (!resolvedUserId) {
      this.logoutCutError.set('No hay un usuario autenticado para cerrar el turno.');
      return;
    }

    this.logoutCutSaving.set(true);
    this.logoutCutError.set('');

    try {
      const cutDate = targetDate || (previewCut?.date ? String(previewCut.date).slice(0, 10) : this.todayDateKey());

      if (this.desktopApi) {
        await this.desktopApi.createDailyCut({ date: cutDate, physicalCashCount, userId: resolvedUserId });
      } else {
        await firstValueFrom(this.http.post<DailyCutResponse>('/api/daily-cuts', {
          date: cutDate,
          physicalCashCount,
          userId: resolvedUserId,
        }));
      }

      if (this.logoutCutFromHistory()) {
        this.logoutCutModalOpen.set(false);
        this.logoutCutFromHistory.set(false);
        this.logoutCutTargetDate.set(null);
        this.logoutCutTargetUserId.set(null);
        this.cutModalOpen.set(true);
        await this.loadDailyCuts();
        if (this.activePage() === 'petty-cash') {
          await this.loadPettyCashData();
        }
        return;
      }

      if (this.activePage() === 'petty-cash') {
        await this.loadPettyCashData();
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

  protected exportPurchaseDayPdf(dayGroup: PurchaseDayGroup): void {
    this.exportPurchaseGroupPdf({
      title: `Compras del dia - ${dayGroup.label}`,
      subtitle: `${this.formatNumber(dayGroup.invoices.length)} factura(s) de compra`,
      scopeLabel: 'Dia',
      scopeValue: dayGroup.label,
      invoices: dayGroup.invoices,
      total: dayGroup.total,
      quantity: dayGroup.quantity,
    });
  }

  protected exportPurchasePaymentPdf(paymentGroup: PurchasePaymentGroup): void {
    this.exportPurchaseGroupPdf({
      title: `Compras por pago - ${paymentGroup.label}`,
      subtitle: `${this.formatNumber(paymentGroup.invoices.length)} factura(s) de compra`,
      scopeLabel: 'Forma de pago',
      scopeValue: paymentGroup.label,
      invoices: paymentGroup.invoices,
      total: paymentGroup.total,
      quantity: paymentGroup.quantity,
    });
  }

  private exportPurchaseGroupPdf(group: {
    title: string;
    subtitle: string;
    scopeLabel: string;
    scopeValue: string;
    invoices: PurchaseInvoiceGroup[];
    total: number;
    quantity: number;
  }): void {
    this.openPrintableCreditReport({
      title: group.title,
      subtitle: group.subtitle,
      summary: [
        [group.scopeLabel, group.scopeValue],
        ['Facturas', this.formatNumber(group.invoices.length)],
        ['Cantidad total', this.formatNumber(group.quantity)],
        ['Total', this.formatCurrency(group.total)],
      ],
      headers: ['Factura', 'Proveedor', 'Pago', 'Producto', 'Cantidad', 'Costo', 'Total', 'Estado', 'Fecha'],
      rows: group.invoices.flatMap((invoice) =>
        invoice.lines.map((line) => [
          invoice.invoiceNumber || '-',
          invoice.supplierName,
          invoice.purchaseType,
          line.productName,
          this.formatNumber(line.quantity),
          this.formatCurrency(line.unitCost),
          this.formatCurrency(line.total),
          invoice.statusName,
          line.createdAt || '-',
        ]),
      ),
    });
  }

  protected togglePurchaseDay(key: string): void {
    this.expandedPurchaseDayKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected togglePurchasePayment(key: string): void {
    this.expandedPurchasePaymentKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected isPurchaseDayExpanded(key: string): boolean {
    return this.expandedPurchaseDayKeys().includes(key);
  }

  protected isPurchasePaymentExpanded(key: string): boolean {
    return this.expandedPurchasePaymentKeys().includes(key);
  }

  protected isPurchaseAnnulled(invoice: PurchaseInvoiceGroup): boolean {
    return Number(invoice.statusId || 0) === 3 || this.normalizeText(invoice.statusName).startsWith('anulad');
  }

  protected async annulPurchaseInvoice(invoice: PurchaseInvoiceGroup): Promise<void> {
    const confirmed = window.confirm(`Anular factura de compra ${invoice.invoiceNumber} y descontar el inventario comprado?`);

    if (!confirmed) {
      return;
    }

    try {
      const payload = {
        purchaseType: invoice.purchaseType,
        invoiceNumber: invoice.invoiceNumber,
        userId: this.currentUser()?.id ?? null,
      };

      if (this.desktopApi?.annulPurchase) {
        await this.desktopApi.annulPurchase(payload);
      } else {
        await firstValueFrom(this.http.post<AnnulPurchaseResponse>('/api/purchases/annul', payload));
      }

      await this.loadPurchases();
      await this.fetchProducts();
      await this.loadDashboardSalesSummary();
      this.showInventorySuccess(`Factura de compra ${invoice.invoiceNumber} anulada correctamente.`);
    } catch (error) {
      this.purchaseError.set(this.extractErrorMessage(error, 'No se pudo anular la compra.'));
    }
  }

  protected async exportProductCatalogPdf(): Promise<void> {
    if (this.catalogExporting()) return;
    this.catalogExporting.set(true);
    try {
      const products = this.catalogProducts();

      if (products.length === 0) {
        this.showSaleSuccess('No hay productos con precio de venta para exportar.', 'error');
        return;
      }

      const catalogHtml = this.buildProductCatalogHtml(products, {
        autoPrint: !this.desktopApi?.exportHtmlPdf,
        includePrintButton: !this.desktopApi?.exportHtmlPdf,
      });

      if (this.desktopApi?.exportHtmlPdf) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const result = await this.desktopApi.exportHtmlPdf({
            html: catalogHtml,
            defaultFileName: `Catalogo-productos-${today}.pdf`,
          });

          if (!result.canceled) {
            const sizeKb = Math.max(1, Math.round(Number(result.size || 0) / 1024));
            this.showSaleSuccess(`Catalogo exportado correctamente (${sizeKb} KB).`);
          }
        } catch (error) {
          this.showSaleSuccess(this.extractErrorMessage(error, 'No se pudo exportar el catalogo en PDF.'), 'error');
        }
        return;
      }

      const printWindow = this.openPrintableReportWindow();

      if (!printWindow) {
        this.showSaleSuccess('No se pudo abrir la ventana de impresion. Revisa el bloqueo de ventanas emergentes.', 'error');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(catalogHtml);
      printWindow.document.close();
    } finally {
      this.catalogExporting.set(false);
    }
  }

  private buildProductCatalogHtml(products: Product[], options: {
    autoPrint: boolean;
    includePrintButton: boolean;
  }): string {
    const generatedAt = new Date().toLocaleString('es-HN');
    const categoriesCount = new Set(products.map((product) => product.category)).size;
    const availableUnits = products.reduce((total, product) => total + Number(product.stock || 0), 0);
    const printButtonHtml = options.includePrintButton
      ? '<button onclick="printCatalogWhenReady()">Guardar como PDF</button>'
      : '';
    const printScriptHtml = options.autoPrint
      ? `
          <script>
            let catalogPrintRunning = false;

            function waitForImages() {
              const images = Array.from(document.images || []);
              if (images.length === 0) {
                return Promise.resolve();
              }

              return Promise.all(images.map((image) => {
                if (image.complete) {
                  return Promise.resolve();
                }

                return new Promise((resolve) => {
                  let resolved = false;
                  const finish = () => {
                    if (resolved) {
                      return;
                    }

                    resolved = true;
                    resolve();
                  };

                  image.addEventListener('load', finish, { once: true });
                  image.addEventListener('error', finish, { once: true });
                  setTimeout(finish, 4500);
                });
              }));
            }

            function printCatalogWhenReady() {
              if (catalogPrintRunning) {
                return;
              }

              catalogPrintRunning = true;
              const button = document.querySelector('button');
              const originalText = button ? button.textContent : '';

              if (button) {
                button.disabled = true;
                button.textContent = 'Preparando PDF...';
              }

              waitForImages().then(() => {
                setTimeout(() => {
                  if (button) {
                    button.disabled = false;
                    button.textContent = originalText || 'Guardar como PDF';
                  }

                  catalogPrintRunning = false;
                  window.focus();
                  window.print();
                }, 500);
              });
            }

            if (document.readyState === 'complete') {
              setTimeout(printCatalogWhenReady, 350);
            } else {
              window.addEventListener('load', () => setTimeout(printCatalogWhenReady, 350), { once: true });
            }
          </script>
        `
      : '';
    const catalogCards = products
      .map((product) => {
        const imageHtml = product.imageUrl
          ? `<img src="${this.escapeHtml(this.printableImageUrl(product.imageUrl))}" alt="${this.escapeHtml(product.name)}" loading="eager" decoding="sync" />`
          : `<div class="catalog-placeholder">${this.escapeHtml(this.productCatalogInitials(product))}</div>`;
        const stockLabel = `${this.formatNumber(product.stock)} ${product.unitMeasure || 'uds.'}`;

        return `
          <article class="catalog-card">
            <div class="catalog-image">${imageHtml}</div>
            <div class="catalog-info">
              <span>${this.escapeHtml(product.category || 'Sin categoria')}</span>
              <h2>${this.escapeHtml(product.name)}</h2>
              <p>${this.escapeHtml(product.sku)}</p>
              <strong>${this.formatCurrency(product.salePrice)}</strong>
              <small>Disponible: ${this.escapeHtml(stockLabel)}</small>
            </div>
          </article>
        `;
      })
      .join('');

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Catalogo de productos</title>
          <style>
            * { box-sizing: border-box; }
            @page { size: A4 landscape; margin: 8mm; }
            html { background: #ffffff; }
            body { margin: 18px; color: #111827; font-family: Arial, Helvetica, sans-serif; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid #0f766e; }
            h1 { margin: 0; font-size: 25px; letter-spacing: 0; }
            header p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
            button { border: 0; border-radius: 999px; background: #0f766e; color: #ffffff; font-weight: 900; padding: 11px 18px; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
            .summary article { border: 1px solid #dbe2ea; border-radius: 8px; background: #ffffff; padding: 9px 10px; }
            .summary span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .summary strong { display: block; margin-top: 3px; color: #0f172a; font-size: 16px; }
            .catalog-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-items: start; }
            .catalog-card { position: relative; height: 190px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; border: 1px solid #dbe2ea; border-radius: 10px; background: #ffffff; box-shadow: 0 10px 24px rgb(15 23 42 / 8%); }
            .catalog-image { display: grid; width: 100%; height: 190px; place-items: center; background: linear-gradient(135deg, #e2e8f0, #f8fafc); }
            .catalog-image img { width: 100%; height: 100%; object-fit: contain; padding: 8px 8px 48px; }
            .catalog-placeholder { display: grid; width: 62px; height: 62px; place-items: center; border-radius: 16px; background: linear-gradient(135deg, #0f766e, #22c55e); color: #ffffff; font-size: 22px; font-weight: 900; }
            .catalog-info { position: absolute; right: 0; bottom: 0; left: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 48px; padding: 8px 9px; border-top: 1px solid rgb(255 255 255 / 18%); background: linear-gradient(180deg, rgb(0 0 0 / 58%), rgb(0 0 0 / 82%)); color: #ffffff; }
            .catalog-info span, .catalog-info p, .catalog-info small { display: none; }
            .catalog-info h2 { display: -webkit-box; overflow: hidden; margin: 0; color: #ffffff; font-size: 11px; line-height: 1.15; text-align: left; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
            .catalog-info strong { justify-self: end; color: #ffffff; font-size: 13px; line-height: 1.05; text-align: right; white-space: nowrap; }
            footer { margin-top: 12px; color: #64748b; font-size: 10px; }
            @media print {
              body { margin: 0; background: #ffffff; }
              button { display: none; }
              header { margin-bottom: 8px; padding-bottom: 8px; }
              .summary { margin-bottom: 8px; }
              .catalog-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
              .catalog-card { height: 178px; box-shadow: none; }
              .catalog-image { height: 178px; }
              .catalog-card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>Catalogo de productos</h1>
              <p>Yahweh Rohi Inventory - Generado ${this.escapeHtml(generatedAt)}</p>
            </div>
            ${printButtonHtml}
          </header>
          <section class="summary">
            <article><span>Productos</span><strong>${this.formatNumber(products.length)}</strong></article>
            <article><span>Categorias</span><strong>${this.formatNumber(categoriesCount)}</strong></article>
            <article><span>Inventario disponible</span><strong>${this.formatNumber(availableUnits)}</strong></article>
          </section>
          <main class="catalog-grid">${catalogCards}</main>
          <footer>Catalogo generado desde el modulo de facturacion.</footer>
          ${printScriptHtml}
        </body>
      </html>
    `;
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
    this.purchaseProductPickerOpen.set(false);
    this.estimatedPurchaseModalOpen.set(false);
    this.purchaseModalError.set('');
  }

  protected openPurchaseModal(): void {
    this.newPurchaseWorkspace();
    if (this.purchaseWorkspaceNotice().startsWith('No se pudo') || this.purchaseWorkspaceNotice().startsWith('No se pudieron')) return;
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

  protected setPurchaseMainViewMode(mode: PurchaseMainViewMode): void {
    this.purchaseMainViewMode.set(mode);
    this.expandedPurchaseSupplierId.set(null);
    this.expandedPurchaseInvoiceKey.set(null);
    this.expandedPurchaseDayKeys.set([]);
    this.expandedPurchasePaymentKeys.set([]);
  }

  protected refreshPurchaseHistory(): void {
    void this.loadPurchases();
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

  protected updatePurchaseDraftLineLot(productId: number, event: Event): void {
    const lotNumber = (event.target as HTMLInputElement).value;
    this.purchaseDraftLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, lotNumber } : line),
    );
  }

  protected updatePurchaseDraftLineExpiry(productId: number, event: Event): void {
    const expiryDate = (event.target as HTMLInputElement).value || null;
    this.purchaseDraftLines.update((lines) =>
      lines.map((line) => line.productId === productId ? { ...line, expiryDate } : line),
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

  protected openPurchaseProductPicker(): void {
    this.purchaseProductPickerOpen.set(true);
    this.purchaseProductSearch.set('');
    this.purchaseProductCategory.set('Todas');
    void this.fetchProducts();
  }

  protected closePurchaseProductPicker(): void {
    this.purchaseProductPickerOpen.set(false);
  }

  protected updatePurchaseProductSearch(event: Event): void {
    this.purchaseProductSearch.set((event.target as HTMLInputElement).value);
  }

  protected updatePurchaseProductCategory(event: Event): void {
    this.purchaseProductCategory.set((event.target as HTMLSelectElement).value);
  }

  protected isProductInPurchaseDraft(productId: number): boolean {
    return this.purchaseDraftLines().some((line) => line.productId === productId);
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
            line.productId === product.id
              ? this.withDefaultPurchaseLot({ ...line, quantity: line.quantity + quantity, unitCost })
              : line,
          );
        }

        return [...lines, this.withDefaultPurchaseLot({ productId: product.id, quantity, unitCost })];
      });
      addedLines += 1;
    }

    return addedLines;
  }

  private buildDefaultPurchaseLot(productId: number): string {
    const product = this.products().find((item) => item.id === productId);
    const sku = (product?.sku || String(productId)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24);
    const dateKey = (this.purchaseDate() || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const invoiceKey = (this.purchaseInvoiceNumber().trim() || 'COMPRA').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);

    return `${invoiceKey}-${sku}-${dateKey}`.slice(0, 80);
  }

  private withDefaultPurchaseLot(line: PurchaseDraftLine): PurchaseDraftLine {
    return {
      ...line,
      lotNumber: line.lotNumber?.trim() || '',
      expiryDate: line.expiryDate || null,
    };
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
          line.productId === productId
            ? this.withDefaultPurchaseLot({ ...line, quantity: line.quantity + quantity, unitCost })
            : line,
        );
      }

      return [...lines, this.withDefaultPurchaseLot({ productId, quantity, unitCost })];
    });
    this.estimatedPurchaseReasons.update((reasons) => {
      const { [productId]: _removed, ...remaining } = reasons;
      return remaining;
    });
    this.purchaseModalError.set('');
  }

  protected addProductToPurchaseDraft(product: Product): void {
    this.purchaseDraftLines.update((lines) => {
      const existing = lines.find((line) => line.productId === product.id);
      const unitCost = Math.max(product.unitCost || 0, 0);

      if (existing) {
        return lines.map((line) =>
          line.productId === product.id
            ? this.withDefaultPurchaseLot({
                ...line,
                quantity: line.quantity + 1,
                unitCost: line.unitCost > 0 ? line.unitCost : unitCost,
              })
            : line,
        );
      }

      return [...lines, this.withDefaultPurchaseLot({ productId: product.id, quantity: 1, unitCost })];
    });
    this.estimatedPurchaseReasons.update((reasons) => {
      const { [product.id]: _removed, ...remaining } = reasons;
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

    this.newPurchaseWorkspace();
    if (this.purchaseDraftLines().length) return;
    this.purchaseDate.set(new Date().toISOString().slice(0, 10));
    this.purchaseInvoiceNumber.set(`AUTO-${this.purchaseDate().replace(/-/g, '')}`);
    this.purchasePaymentTypeId.set(1);
    this.purchaseDraftLines.set(lines.map(({ reason: _reason, ...line }) => this.withDefaultPurchaseLot(line)));
    this.estimatedPurchaseReasons.set(reasons);
    this.purchaseMainModalOpen.set(false);
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
    this.purchaseProductSearch.set('');
    this.purchaseProductCategory.set('Todas');
    this.purchaseProductPickerOpen.set(false);
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
    if (this.purchaseModalSaving()) return;
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

    const normalizedLines = this.purchaseDraftLines().map((line) => ({ ...line, lotNumber: line.lotNumber || '', expiryDate: line.expiryDate || null }));

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
        lines: normalizedLines,
      };

      if (this.desktopApi) {
        await this.desktopApi.createPurchase(payload);
      } else {
        await firstValueFrom(this.http.post<PurchaseResponse>('/api/purchases', payload));
      }

      const remainingDrafts = this.purchaseWorkspaceDrafts().filter(d => d.id !== this.purchaseWorkspaceId());
      this.purchaseWorkspaceDrafts.set(remainingDrafts);
      try { localStorage.setItem(this.purchaseWorkspaceKey(), JSON.stringify(remainingDrafts)); this.purchaseWorkspaceNotice.set('Compra registrada. Inventario actualizado.'); }
      catch { this.purchaseWorkspaceNotice.set('Compra registrada, pero no se pudo quitar el borrador local. No vuelvas a registrar esta factura.'); }
      this.purchaseWorkspaceId.set(null);
      this.purchaseWorkspaceStage.set('prepare');
      this.purchaseExpectedDate.set('');
      this.purchaseReviewOpen.set(false);
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

  private printableImageUrl(value: string | null | undefined): string {
    const rawValue = String(value || '').trim();

    if (!rawValue) {
      return '';
    }

    if (/^(data:|blob:|https?:\/\/|file:\/\/)/i.test(rawValue)) {
      return rawValue;
    }

    if (/^[a-zA-Z]:[\\/]/.test(rawValue)) {
      return `file:///${rawValue.replace(/\\/g, '/')}`;
    }

    try {
      return new URL(rawValue, window.location.href).href;
    } catch {
      return rawValue;
    }
  }

  protected productThumbnailUrl(value: string | null | undefined, size = 120): string {
    const rawValue = String(value || '').trim();

    if (!rawValue) {
      return '';
    }

    const normalizedSize = Math.min(Math.max(Math.round(size), 48), 320);
    const assetMatch = rawValue.match(/^\/api\/product-images\/(.+)$/);

    if (assetMatch) {
      return `/api/product-image-thumbnails/assets/${assetMatch[1]}?size=${normalizedSize}`;
    }

    const localMatch = rawValue.match(/^\/api\/product-images-local\/([^/?#]+)/);

    if (localMatch) {
      return `/api/product-image-thumbnails/local/${localMatch[1]}?size=${normalizedSize}`;
    }

    return rawValue;
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

  private openPrintableCreditPaymentVoucher(voucher: {
    id: number | null;
    customerName: string;
    amount: number;
    paymentMethod: CreditPaymentMethod;
    previousBalance: number;
    currentBalance: number;
    userName: string;
    createdAt: string;
    invoiceCount: number;
    description: string;
  }): boolean {
    const printWindow = this.openPrintableReportWindow();

    if (!printWindow) {
      return false;
    }

    const voucherCode = this.creditPaymentVoucherCode(voucher.id, voucher.createdAt);
    const paymentLabel = voucher.paymentMethod === 'transferencia' ? 'TRANSFERENCIA' : 'EFECTIVO';

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Voucher de abono ${this.escapeHtml(voucherCode)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt {
              width: 380px;
              margin: 18px auto;
              padding: 24px 26px 18px;
              text-align: center;
            }
            .brand {
              margin: 0 0 8px;
              color: #0f766e;
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 0;
            }
            .quota {
              float: right;
              margin-top: -4px;
              font-size: 15px;
              font-weight: 800;
            }
            h1 {
              clear: both;
              margin: 10px 0 0;
              font-size: 28px;
              font-weight: 500;
              letter-spacing: 0;
            }
            .subtitle {
              margin: 2px 0;
              font-size: 15px;
              font-weight: 800;
            }
            .client {
              margin: 2px 0 8px;
              font-size: 14px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .amount-table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0 6px;
            }
            .amount-table td {
              border: 1px solid #777;
              padding: 5px 8px;
              font-size: 21px;
              text-align: right;
            }
            .amount-table td:first-child {
              text-align: right;
              font-weight: 500;
            }
            .date {
              margin: 6px 0 4px;
              font-size: 14px;
              font-weight: 700;
            }
            .barcode {
              height: 70px;
              margin: 4px 0 6px;
              background:
                repeating-linear-gradient(90deg,
                  #000 0 2px,
                  #fff 2px 4px,
                  #000 4px 5px,
                  #fff 5px 8px,
                  #000 8px 11px,
                  #fff 11px 13px);
            }
            .code {
              margin: 0;
              font-size: 24px;
              font-weight: 500;
              letter-spacing: 1px;
            }
            .user {
              margin: 0 0 10px;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .divider {
              font-size: 15px;
              letter-spacing: 1px;
            }
            .meta {
              margin-top: 8px;
              color: #374151;
              font-size: 11px;
              line-height: 1.35;
            }
            button {
              display: block;
              margin: 14px auto 0;
              border: 0;
              border-radius: 8px;
              background: #0f766e;
              color: #fff;
              padding: 10px 16px;
              font-weight: 800;
            }
            @media print {
              body { margin: 0; }
              button { display: none; }
              .receipt { margin: 0 auto; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <div class="quota">CUOTAS: 1/${this.escapeHtml(String(Math.max(voucher.invoiceCount, 1)))}</div>
            <p class="brand">Yahweh Rohi</p>
            <h1>COMPROBANTE</h1>
            <p class="subtitle">COMPROBANTE DE ABONO A CREDITO</p>
            <p class="client">CLIENTE: ${this.escapeHtml(voucher.customerName.toUpperCase())}</p>
            <table class="amount-table">
              <tbody>
                <tr><td>SALDO INICIAL :</td><td>${this.escapeHtml(this.formatCurrency(voucher.previousBalance))}</td></tr>
                <tr><td>SALDO ANTERIOR:</td><td>${this.escapeHtml(this.formatCurrency(voucher.previousBalance))}</td></tr>
                <tr><td>ABONO:</td><td>${this.escapeHtml(this.formatCurrency(voucher.amount))}</td></tr>
                <tr><td>SALDO ACTUAL:</td><td>${this.escapeHtml(this.formatCurrency(voucher.currentBalance))}</td></tr>
              </tbody>
            </table>
            <p class="date">FECHA Y HORA: ${this.escapeHtml(this.formatVoucherDateTime(voucher.createdAt))}</p>
            <div class="barcode" aria-hidden="true"></div>
            <p class="code">${this.escapeHtml(voucherCode)}</p>
            <p class="user">${this.escapeHtml(voucher.userName || 'USUARIO')}</p>
            <p class="divider">==============================</p>
            <p class="meta">${this.escapeHtml(paymentLabel)} · ${this.escapeHtml(voucher.description)}</p>
            <button type="button" onclick="window.print()">Guardar como PDF</button>
          </main>
          <script>
            window.addEventListener('load', () => window.print());
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    return true;
  }

  private creditPaymentVoucherCode(id: number | null, createdAt: string): string {
    const date = this.parseDate(createdAt);
    const datePart = [
      date.getFullYear(),
      this.padDatePart(date.getMonth() + 1),
      this.padDatePart(date.getDate()),
      this.padDatePart(date.getHours()),
      this.padDatePart(date.getMinutes()),
      this.padDatePart(date.getSeconds()),
    ].join('');
    const idPart = String(id || date.getMilliseconds()).padStart(4, '0').slice(-4);
    return `${datePart}${idPart}`;
  }

  private formatVoucherDateTime(value: string): string {
    const date = this.parseDate(value);
    return `${date.getFullYear()}/${this.padDatePart(date.getMonth() + 1)}/${this.padDatePart(date.getDate())} - ${this.padDatePart(date.getHours())}:${this.padDatePart(date.getMinutes())}:${this.padDatePart(date.getSeconds())}`;
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

  private parseDate(value: string | null | undefined): Date {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  private dateKey(value: string | null | undefined): string {
    return this.formatDateKey(this.parseDate(value));
  }

  private formatInvoiceDayLabel(dayKey: string): string {
    const [yearText, monthText, dayText] = String(dayKey || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return 'Fecha sin registrar';
    }

    return this.capitalizeSentence(new Intl.DateTimeFormat('es-HN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, day)));
  }

  private creditHistoryTrendGrouping(date: Date, period: CreditHistoryTrendPeriod): { key: string; label: string } {
    if (period === 'week') {
      const weekStart = this.startOfWeek(date);
      return {
        key: this.formatDateKey(weekStart),
        label: `Semana ${new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(weekStart)}`,
      };
    }

    if (period === 'year') {
      const year = String(date.getFullYear());
      return { key: year, label: year };
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      label: this.formatSalesProfitabilityPeriodLabel(key),
    };
  }

  private creditTrendGrouping(date: Date, period: CreditTrendPeriod): { key: string; label: string; sortValue: number } {
    if (period === 'day') {
      const day = this.startOfDay(date);
      return {
        key: this.formatDateKey(day),
        label: new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(day),
        sortValue: day.getTime(),
      };
    }

    if (period === 'week') {
      const weekStart = this.startOfWeek(date);
      return {
        key: this.formatDateKey(weekStart),
        label: `Semana ${new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(weekStart)}`,
        sortValue: weekStart.getTime(),
      };
    }

    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('es-HN', { month: 'short', year: '2-digit' }).format(monthStart),
      sortValue: monthStart.getTime(),
    };
  }

  private groupCreditPaymentsByPeriod(payments: CreditPayment[], period: 'month' | 'week'): CreditPaymentPeriodGroup[] {
    const groups = new Map<string, CreditPayment[]>();

    for (const payment of payments) {
      const date = this.parseDate(payment.createdAt);
      const key = period === 'month'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : this.formatDateKey(this.startOfWeek(date));
      groups.set(key, [...(groups.get(key) || []), payment]);
    }

    return [...groups.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([key, groupPayments]) => ({
        key,
        label: period === 'month' ? this.formatSalesProfitabilityPeriodLabel(key) : `Semana ${key}`,
        total: groupPayments.reduce((total, payment) => total + payment.amount, 0),
        count: groupPayments.length,
        payments: groupPayments,
      }));
  }

  private formatSalesProfitabilityPeriodLabel(periodKey: string): string {
    const [yearText, monthText] = String(periodKey || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return 'Mes actual';
    }

    return this.capitalizeSentence(new Intl.DateTimeFormat('es-HN', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1)));
  }

  private capitalizeSentence(value: string): string {
    const text = String(value || '').trim();
    return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  protected isPromotionProduct(product: Product): boolean {
    return this.normalizeText(`${product.description || ''} ${product.name || ''}`).includes('promocion');
  }

  protected isNewProduct(product: Product): boolean {
    if (!product.createdAt) {
      return false;
    }

    const createdBy = this.normalizeText(product.createdBy || '');

    if (
      createdBy.startsWith('sync') ||
      createdBy.includes('migracion') ||
      createdBy.includes('historico') ||
      createdBy.includes('lanzamiento') ||
      createdBy === 'carga inicial'
    ) {
      return false;
    }

    const createdAt = new Date(product.createdAt);

    if (Number.isNaN(createdAt.getTime())) {
      return false;
    }

    const ageMs = Date.now() - createdAt.getTime();
    const maxAgeMs = 45 * 24 * 60 * 60 * 1000;
    return ageMs >= 0 && ageMs < maxAgeMs;
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

  protected todayDateKey(): string {
    return this.formatDateKey(new Date());
  }

  private currentDateTimeLocalValue(): string {
    const now = new Date();
    return `${this.formatDateKey(now)}T${this.padDatePart(now.getHours())}:${this.padDatePart(now.getMinutes())}`;
  }

  private financialMovementDayKey(value: string | null | undefined): string {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : this.todayDateKey();
  }

  private dateOffsetKey(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.formatDateKey(date);
  }

  private isCurrentLocalDate(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    return this.formatDateKey(date) === this.formatDateKey(new Date());
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

  protected formatTableDateTime(value: string | null | undefined): string {
    return this.formatCutDateTime(value);
  }

  protected formatAuditDateTime(value: string | null | undefined): string {
    const date = this.parseAuditDate(value);
    return date ? `${this.padDatePart(date.getDate())}/${this.padDatePart(date.getMonth() + 1)} ${this.padDatePart(date.getHours())}:${this.padDatePart(date.getMinutes())}` : '--';
  }

  protected formatAuditDate(value: string | null | undefined): string {
    const date = this.parseAuditDate(value);
    return date ? `${this.padDatePart(date.getDate())}/${this.padDatePart(date.getMonth() + 1)}/${date.getFullYear()}` : '--';
  }

  protected formatAuditTime(value: string | null | undefined): string {
    const date = this.parseAuditDate(value);
    return date ? `${this.padDatePart(date.getHours())}:${this.padDatePart(date.getMinutes())}:${this.padDatePart(date.getSeconds())}` : '--:--:--';
  }

  private parseAuditDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const rawValue = String(value).trim();
    const parsed = new Date(rawValue);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    const normalized = rawValue.replace(' ', 'T');
    const fallback = new Date(normalized);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  private padDatePart(value: number): string {
    return String(value).padStart(2, '0');
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

  protected loadBillingProductsFromDatabase(force = false): void {
    void this.fetchBillingProducts(force);
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

  protected togglePayrollNav(): void {
    this.payrollNavCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleFinanceNav(): void {
    this.financeNavCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  protected openLogoutFromUserMenu(): void {
    this.userMenuOpen.set(false);
    this.openLogoutCutModal();
  }

  protected async openSelfAttendanceMarkModal(): Promise<void> {
    this.userMenuOpen.set(false);
    this.selfAttendanceMarkError.set('');
    this.selfAttendanceMarkSuccess.set('');
    this.selfAttendanceMarkModalOpen.set(true);
    await this.loadAttendanceUsers(true);
    this.selectedSelfAttendanceUserId.set(this.defaultSelfAttendanceUserId());
  }

  protected closeSelfAttendanceMarkModal(): void {
    this.selfAttendanceMarkModalOpen.set(false);
    this.selfAttendanceMarkSaving.set(false);
    this.selfAttendanceMarkError.set('');
    this.selfAttendanceMarkSuccess.set('');
    this.selfAttendanceToastMessage.set('');
    this.selfAttendanceToastVariant.set('success');
  }

  protected currentTimeLabel(): string {
    return this.currentTimeKey();
  }

  protected updateSelfAttendanceUser(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.selectedSelfAttendanceUserId.set(Number.isFinite(value) && value > 0 ? value : null);
    this.selfAttendanceMarkError.set('');
    this.selfAttendanceMarkSuccess.set('');
  }

  protected async saveSelfAttendanceMark(markType: 'entry' | 'exit'): Promise<void> {
    const currentUser = this.currentUser();
    const employeeId = this.selectedSelfAttendanceUserId();

    if (!currentUser || !employeeId) {
      const message = 'Selecciona un usuario para agregar la marca.';
      this.selfAttendanceMarkError.set(message);
      this.showSelfAttendanceToast(message, 'error');
      return;
    }

    this.selfAttendanceMarkSaving.set(true);
    this.selfAttendanceMarkError.set('');
    this.selfAttendanceMarkSuccess.set('');

    try {
      await this.loadAttendanceUsers(true);
      const employee = this.attendanceUserById(employeeId);
      const today = this.todayDateKey();
      const todayRecord = employee?.history.find((record) => record.date.toISOString().slice(0, 10) === today) || null;
      const now = this.currentTimeKey();

      if (markType === 'entry' && todayRecord?.entryTime) {
        const message = `Ya existe una entrada registrada hoy a las ${todayRecord.entryTime}.`;
        this.selfAttendanceMarkError.set(message);
        this.showSelfAttendanceToast(message, 'error');
        return;
      }

      if (markType === 'exit' && !todayRecord?.entryTime) {
        const message = 'Primero debes agregar la marca de entrada de hoy.';
        this.selfAttendanceMarkError.set(message);
        this.showSelfAttendanceToast(message, 'error');
        return;
      }

      if (markType === 'exit' && todayRecord?.exitTime) {
        const message = `Ya existe una salida registrada hoy a las ${todayRecord.exitTime}.`;
        this.selfAttendanceMarkError.set(message);
        this.showSelfAttendanceToast(message, 'error');
        return;
      }

      if (markType === 'exit' && todayRecord?.entryTime && now <= todayRecord.entryTime) {
        const message = 'La salida debe ser mayor que la hora de entrada.';
        this.selfAttendanceMarkError.set(message);
        this.showSelfAttendanceToast(message, 'error');
        return;
      }

      const payload = {
        employeeId,
        date: today,
        entryTime: markType === 'entry' ? now : todayRecord?.entryTime || '',
        exitTime: markType === 'exit' ? now : todayRecord?.exitTime || '',
        recordedBy: currentUser.usuario,
        recordedById: currentUser.id,
        observation: markType === 'entry' ? 'Marca de entrada registrada por el usuario.' : 'Marca de salida registrada por el usuario.',
      };

      const response = this.desktopApi?.saveAttendanceMark
        ? await this.desktopApi.saveAttendanceMark(payload)
        : await firstValueFrom(this.http.post<AttendanceMarkResponse>('/api/attendance/mark', payload));

      await this.loadAttendanceUsers(true);
      const savedDate = response.mark?.date ? new Date(response.mark.date) : new Date(today);
      const weekKey = `${employeeId}-${this.attendanceWeekKeyForDate(savedDate)}`;
      this.attendanceExpandedUserIds.update((ids) => (ids.includes(employeeId) ? ids : [...ids, employeeId]));
      this.attendanceExpandedWeekKeys.update((keys) => (keys.includes(weekKey) ? keys : [...keys, weekKey]));
      const message = markType === 'entry' ? `Entrada registrada a las ${now}.` : `Salida registrada a las ${now}.`;
      this.selfAttendanceMarkSuccess.set(message);
      this.showSelfAttendanceToast(message);
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo guardar la marca personal.');
      this.selfAttendanceMarkError.set(message);
      this.showSelfAttendanceToast(message, 'error');
    } finally {
      this.selfAttendanceMarkSaving.set(false);
    }
  }

  private showSelfAttendanceToast(message: string, variant: 'success' | 'error' = 'success'): void {
    this.selfAttendanceToastVariant.set(variant);
    this.selfAttendanceToastMessage.set(message);

    if (this.selfAttendanceToastTimeoutId !== null) {
      clearTimeout(this.selfAttendanceToastTimeoutId);
    }

    this.selfAttendanceToastTimeoutId = setTimeout(() => {
      this.selfAttendanceToastMessage.set('');
      this.selfAttendanceToastVariant.set('success');
      this.selfAttendanceToastTimeoutId = null;
    }, 3000);
  }

  private defaultSelfAttendanceUserId(): number | null {
    const users = this.attendanceUsers();
    const currentUserId = this.currentUser()?.id || 0;
    const currentAttendanceUser = users.find((user) => user.id === currentUserId);

    if (currentAttendanceUser) {
      return currentAttendanceUser.id;
    }

    const seydiUser = users.find((user) => {
      const haystack = this.normalizeSearchText(`${user.name} ${user.username}`);
      return haystack.includes('seydi') || haystack.includes('seidy');
    });

    return seydiUser?.id || users[0]?.id || currentUserId || null;
  }

  private currentTimeKey(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.selfAttendanceMarkModalOpen.set(false);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.loginPassword.set('');
    this.loginError.set('');
    this.activePage.set('billing');
    this.expiringProductsModalOpen.set(false);
    this.salesDropAlertModalOpen.set(false);
    this.payrollDataLoaded = false;
    this.payrollDataLoadPromise = null;
    this.salesProfitabilityCache.clear();
    this.salesProfitabilityLoadPromises.clear();
    this.salesProfitabilityAnalytics.set(null);
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
        ? await this.desktopApi.getDailyCuts(undefined, undefined, currentUser.id)
        : await firstValueFrom(this.http.get<{ cuts: DailyCut[] }>(
            `/api/daily-cuts?userId=${encodeURIComponent(currentUser.id)}`,
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
      const today = this.todayDateKey();
      this.currentUser.set(response.user);
      const shouldOpenOpeningCut = await this.shouldPromptOpeningCut(today);
      this.isAuthenticated.set(true);
      this.logoutCutModalOpen.set(false);
      this.logoutCutError.set('');
      this.logoutCutPreview.set(null);
      this.saveSession(response.user);
      this.loadCustomers();
      this.loadBillingProductsFromDatabase();
      void this.preloadAuthenticatedModuleData();
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

  private async loadLoginUsers(attempt = 0): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getUsers()
        : await firstValueFrom(this.http.get<UsersResponse>('/api/auth/users'));

      this.loginUsers.set(response.users);
      this.loginError.set('');

      if (!this.loginUser() && response.users.length === 1) {
        this.loginUser.set(response.users[0].usuario);
      }
    } catch {
      this.loginUsers.set([]);
      this.loginError.set('No se pudieron cargar los usuarios. Reintentando...');

      if (attempt < 5) {
        window.setTimeout(() => void this.loadLoginUsers(attempt + 1), 1000);
      }
    }
  }

  private preloadAuthenticatedModuleData(): void {
    // Los modulos pesados se cargan bajo demanda desde loadPageData().
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
  private async loadAttendanceUsers(force = false): Promise<void> {
    if (!force && this.payrollDataLoaded) {
      return;
    }

    if (!force && this.payrollDataLoadPromise) {
      return this.payrollDataLoadPromise;
    }

    this.payrollDataLoadPromise = this.fetchAttendanceAndPayrollData();

    try {
      await this.payrollDataLoadPromise;
    } finally {
      this.payrollDataLoadPromise = null;
    }
  }

  private async fetchAttendanceAndPayrollData(): Promise<void> {
    try {
      const [attendanceResponse, payrollResponse] = await Promise.all([
        this.desktopApi?.getAttendanceUsers
          ? this.desktopApi.getAttendanceUsers()
          : firstValueFrom(this.http.get<AttendanceUsersResponse>('/api/attendance/users')),
        this.desktopApi?.getPayrollRecords
          ? this.desktopApi.getPayrollRecords()
          : firstValueFrom(this.http.get<PayrollRecordsResponse>('/api/payroll/records')),
      ]);

      const users = attendanceResponse.users.map((user) => this.mapAttendanceUser(user));
      this.attendanceUsers.set(users);
      this.payrollDatabaseRecords.set(payrollResponse.records || []);
      this.syncPayrollState(users);
      this.payrollDataLoaded = true;
      queueMicrotask(() => {
        this.updateAttendanceTrendChart();
        this.updatePayrollTrendChart();
      });
    } catch {
      this.attendanceUsers.set([]);
      this.payrollDatabaseRecords.set([]);
      this.syncPayrollState([]);
      this.payrollDataLoaded = false;
    }
  }

  private async loadPayrollRecords(): Promise<void> {
    try {
      const response = this.desktopApi?.getPayrollRecords
        ? await this.desktopApi.getPayrollRecords()
        : await firstValueFrom(this.http.get<PayrollRecordsResponse>('/api/payroll/records'));

      this.payrollDatabaseRecords.set(response.records || []);
      this.payrollDataLoaded = true;
      this.syncPayrollState(this.attendanceUsers());
      queueMicrotask(() => {
        this.updateAttendanceTrendChart();
        this.updatePayrollTrendChart();
      });
    } catch {
      this.payrollDatabaseRecords.set([]);
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

  private async loadCostAnalysisData(): Promise<void> {
    this.costAnalysisError.set('');

    try {
      await Promise.all([
        this.loadInvoicesPageData(),
        this.loadPurchases(),
        this.loadCostIncreaseAlerts(),
        this.loadOperationalCosts(),
      ]);
      await this.loadCostAnalysisInvoiceLines();
    } catch (error) {
      this.costAnalysisError.set(this.extractErrorMessage(error, 'No se pudo cargar el analisis de costos.'));
    }
  }

  private async loadCostAnalysisInvoiceLines(): Promise<void> {
    const missingInvoices = this.costPeriodInvoices()
      .filter((invoice) => !this.costInvoiceLineRows()[invoice.invoiceId])
      .slice(0, 250);

    if (missingInvoices.length === 0) {
      queueMicrotask(() => {
        this.updateCostsCategoryChart();
        this.updateCostsEvolutionChart();
      });
      return;
    }

    this.costAnalysisLoading.set(true);
    this.costAnalysisError.set('');

    try {
      const entries = await Promise.all(missingInvoices.map(async (invoice) => {
        const response = await this.getInvoiceDetails(invoice.invoiceId);
        return [invoice.invoiceId, response.lines] as const;
      }));

      this.costInvoiceLineRows.update((current) => {
        const next = { ...current };
        for (const [invoiceId, lines] of entries) {
          next[invoiceId] = lines;
        }
        return next;
      });
      queueMicrotask(() => {
        this.updateCostsCategoryChart();
        this.updateCostsEvolutionChart();
      });
    } catch (error) {
      this.costAnalysisError.set(this.extractErrorMessage(error, 'No se pudieron cargar los detalles de ventas para costos.'));
    } finally {
      this.costAnalysisLoading.set(false);
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
      this.auditHistoryPageIndex.set(0);
      this.evaluateAutomaticPriceChangeAlert();
    } catch {
      this.auditHistory.set([]);
      this.auditHistoryError.set('No se pudo cargar el historico de auditoria.');
    } finally {
      this.auditHistoryLoading.set(false);
    }
  }

  private async createAuditHistoryRecord(payload: {
    tableName: string;
    action: string;
    recordKey?: string;
    userId?: number | null;
    user?: string | null;
    previousData?: string;
    newData?: string;
  }): Promise<void> {
    try {
      if (this.desktopApi?.createAuditHistoryRecord) {
        await this.desktopApi.createAuditHistoryRecord(payload);
      } else {
        await firstValueFrom(this.http.post('/api/history/audit', payload));
      }

      if (this.activePage() === 'history') {
        await this.loadAuditHistory();
      }
    } catch {
      return;
    }
  }

  private startPriceChangeAlertWatcher(): void {
    if (this.priceChangeAlertIntervalId !== null || typeof window === 'undefined') {
      return;
    }

    this.priceChangeAlertIntervalId = window.setInterval(() => {
      void this.loadAuditHistory();
    }, 2 * 60 * 60 * 1000);
  }

  private evaluateAutomaticPriceChangeAlert(): void {
    const todayAlerts = this.todayPriceChangeAlerts();

    if (todayAlerts.length === 0 || this.priceChangeAlertModalOpen()) {
      return;
    }

    const storageKey = `yr-price-alert-last-open-${this.todayDateKey()}`;
    const lastOpen = Number(window.localStorage.getItem(storageKey) || 0);
    const now = Date.now();

    if (lastOpen > 0 && now - lastOpen < 2 * 60 * 60 * 1000) {
      return;
    }

    window.localStorage.setItem(storageKey, String(now));
    this.priceChangeAlertMode.set('auto');
    this.priceChangeAlertPeriod.set('week');
    this.priceChangeAlertModalOpen.set(true);
  }

  protected async openPriceChangeAlertsModal(mode: 'auto' | 'manual' = 'manual'): Promise<void> {
    this.priceChangeAlertMode.set(mode);

    if (mode === 'manual') {
      this.priceChangeAlertPeriod.set('week');
    }

    this.priceChangeAlertModalOpen.set(true);
    await this.loadAuditHistory();
  }

  protected closePriceChangeAlertsModal(): void {
    this.priceChangeAlertModalOpen.set(false);
    this.priceChangeAlertMode.set('manual');
  }

  protected async openActivityNotifications(): Promise<void> {
    this.activityNotificationsOpen.set(true);
    await this.loadAuditHistory();
  }

  protected closeActivityNotifications(): void {
    this.activityNotificationsOpen.set(false);
  }

  protected setPriceChangeAlertPeriod(period: 'week' | 'month'): void {
    this.priceChangeAlertPeriod.set(period);
  }

  protected priceChangeModalAlerts(): PriceChangeAlert[] {
    return this.priceChangeAlertMode() === 'auto'
      ? this.todayPriceChangeAlerts()
      : this.visiblePriceChangeAlerts();
  }

  protected priceChangeAlertTitle(): string {
    return this.priceChangeAlertMode() === 'auto'
      ? 'Cambios de precio del dia'
      : 'Productos con cambios de precio';
  }

  private mapActivityNotification(record: AuditHistoryRecord): ActivityNotification | null {
    const action = this.formatActivityAction(record.action, record.tableName);
    const detailParts = [
      record.recordKey ? String(record.recordKey) : '',
      record.tableName ? `Modulo: ${record.tableName}` : '',
    ].filter(Boolean);

    return {
      id: record.id,
      action,
      detail: detailParts.join(' - ') || 'Movimiento registrado en el sistema',
      user: record.user || 'Sistema',
      createdAt: record.date,
    };
  }

  protected formatActivityRelativeTime(value: string | null | undefined): string {
    const date = this.parseAuditDate(value);

    if (!date) {
      return 'sin hora';
    }

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
      return 'ahora';
    }

    if (diffMinutes < 60) {
      return `hace ${diffMinutes} minuto${diffMinutes === 1 ? '' : 's'}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
      return `hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;
    }

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays < 7) {
      return `hace ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
    }

    return this.formatAuditDateTime(value);
  }

  private formatActivityAction(action: string | null | undefined, tableName: string | null | undefined): string {
    const normalizedAction = String(action || '').trim();
    const normalizedTable = String(tableName || '').trim();
    const readableAction = normalizedAction
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    if (!readableAction && !normalizedTable) {
      return 'Movimiento registrado';
    }

    if (!normalizedTable) {
      return readableAction;
    }

    return `${readableAction || 'Movimiento'} en ${normalizedTable}`;
  }

  private mapPriceChangeAlert(record: AuditHistoryRecord): PriceChangeAlert | null {
    if (String(record.action || '').toUpperCase() !== 'CAMBIO_PRECIO') {
      return null;
    }

    try {
      const data = JSON.parse(record.newData || '{}') as Partial<PriceChangeAlert> & { changedAt?: string };
      const productName = String(data.productName || '').trim();
      const previousPrice = Number(data.previousPrice || 0);
      const newPrice = Number(data.newPrice || 0);
      const changedAt = String(data.changedAt || record.date || '');

      if (!productName || !Number.isFinite(previousPrice) || !Number.isFinite(newPrice) || !changedAt) {
        return null;
      }

      return {
        id: record.id,
        productId: data.productId ? Number(data.productId) : null,
        productName,
        imageUrl: data.imageUrl ? String(data.imageUrl) : null,
        previousPrice,
        newPrice,
        changedAt,
        user: record.user || 'Sistema',
      };
    } catch {
      return null;
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

      this.creditSearchTerm.set('');
      this.selectedCreditCustomerId.set(null);
      this.creditLines.set(response.credits);
      if (this.activePage() === 'credits') void this.loadCreditPeopleHistories();
      this.scheduleVisibleChartsRefresh();
    } catch {
      this.creditLines.set([]);
      this.creditError.set('No se pudieron cargar los creditos.');
      this.scheduleVisibleChartsRefresh();
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

  protected async loadInvoiceMonthlySalesTrend(): Promise<void> {
    try {
      const response = this.desktopApi
        ? await this.desktopApi.getDashboardSalesTrend('month')
        : await firstValueFrom(this.http.get<DashboardSalesTrendResponse>('/api/dashboard/sales-trend?period=month'));

      this.invoiceMonthlySalesTrendData.set(response.trend.map((item) => ({
        ...item,
        label: this.formatSalesTrendLabel(item.periodStart, 'month'),
      })));
    } catch {
      this.invoiceMonthlySalesTrendData.set([]);
    }
  }

  protected async loadSalesProfitabilityAnalytics(): Promise<void> {
    const selectedPeriod = this.selectedSalesProfitabilityPeriod();
    const cachedAnalytics = this.salesProfitabilityCache.get(selectedPeriod);

    if (cachedAnalytics) {
      this.salesProfitabilityAnalytics.set(cachedAnalytics);
      this.salesProfitabilityError.set('');
      this.salesProfitabilityLoading.set(false);
      this.scheduleVisibleChartsRefresh();
      return;
    }

    const activeLoad = this.salesProfitabilityLoadPromises.get(selectedPeriod);

    if (activeLoad) {
      return activeLoad;
    }

    this.salesProfitabilityLoading.set(true);
    this.salesProfitabilityError.set('');
    const loadPromise = this.fetchSalesProfitabilityAnalytics(selectedPeriod);
    this.salesProfitabilityLoadPromises.set(selectedPeriod, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.salesProfitabilityLoadPromises.delete(selectedPeriod);
      this.salesProfitabilityLoading.set(false);
    }
  }

  private async fetchSalesProfitabilityAnalytics(selectedPeriod: string): Promise<void> {
    try {
      const year = Number(selectedPeriod.slice(0, 4));
      const month = Number(selectedPeriod.slice(5, 7));
      const response = this.desktopApi?.getSalesProfitabilityAnalytics
        ? await this.desktopApi.getSalesProfitabilityAnalytics({ year, month })
        : await firstValueFrom(
            this.http.get<SalesProfitabilityAnalytics>(
              `/api/analytics/sales-profitability?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
            ),
          );

      this.salesProfitabilityAnalytics.set(response);
      this.resetProfitabilityPagination();
      this.salesProfitabilityCache.set(response.selectedPeriod?.key || selectedPeriod, response);
      if (response.selectedPeriod?.key) {
        this.selectedSalesProfitabilityPeriod.set(response.selectedPeriod.key);
      }
    } catch (error) {
      this.salesProfitabilityAnalytics.set(null);
      this.salesProfitabilityError.set(this.extractErrorMessage(error, 'No se pudo cargar ventas y rentabilidad.'));
    }
  }

  protected async loadSystemHealth(): Promise<void> {
    if (this.systemHealthLoading()) {
      return;
    }

    this.systemHealthLoading.set(true);
    this.systemHealthError.set('');

    try {
      const response = this.desktopApi?.getSystemHealth
        ? await this.desktopApi.getSystemHealth()
        : await firstValueFrom(this.http.get<SystemHealthResponse>('/api/system-health'));

      this.systemHealth.set(response);
    } catch (error) {
      this.systemHealthError.set(this.extractErrorMessage(error, 'No se pudo cargar la salud del sistema.'));
    } finally {
      this.systemHealthLoading.set(false);
    }
  }

  protected systemHealthStatusLabel(): string {
    const health = this.systemHealth();
    const summary = health?.summary;

    if (!summary) {
      return 'Pendiente';
    }

    const criticalIssues = health?.checks
      .filter((check) => check.severity === 'critical')
      .reduce((total, check) => total + check.affected, 0) || 0;

    if (criticalIssues > 0) {
      return 'Critico';
    }

    return this.systemHealthWarningCount() > 0 ? 'Advertencia' : 'Saludable';
  }

  protected systemHealthStatusClass(): string {
    const score = this.systemHealthScore();

    if (score >= 95) {
      return 'profitability-status excellent';
    }

    if (score >= 80) {
      return 'profitability-status good';
    }

    if (score >= 60) {
      return 'profitability-status regular';
    }

    return 'profitability-status critical';
  }

  protected systemHealthScore(): number {
    const summary = this.systemHealth()?.summary;

    if (!summary) {
      return 0;
    }

    const criticalPenalty =
      (summary.missingCodes +
        summary.stockMismatches +
        summary.duplicateProductCodes +
        summary.duplicateInventoryCodes +
        summary.productsWithoutInventory +
        (summary.invoicesWithoutLines || 0) +
        (summary.saleLinesWithoutInvoice || 0)) *
      12;
    const warningPenalty =
      (summary.activeExtraCodes +
        summary.negativeStock +
        summary.inventoryWithoutProduct +
        (summary.inactiveProductsWithStock || 0) +
        (summary.expiringProducts || 0) +
        (summary.brokenProductImages || 0)) *
      4;

    return Math.max(0, Math.min(100, 100 - criticalPenalty - warningPenalty));
  }

  protected systemHealthCriticalCount(): number {
    return this.systemHealth()?.checks
      .filter((check) => check.severity === 'critical')
      .reduce((total, check) => total + check.affected, 0) || 0;
  }

  protected systemHealthWarningCount(): number {
    return this.systemHealth()?.checks
      .filter((check) => check.severity === 'warning')
      .reduce((total, check) => total + check.affected, 0) || 0;
  }

  protected systemHealthMonthlyChangeTotal(): number {
    return this.systemHealth()?.monthlyChanges.reduce((total, change) => total + change.total, 0) || 0;
  }

  protected systemHealthSeverityClass(severity: string): string {
    return `profitability-status ${severity === 'critical' ? 'critical' : severity === 'warning' ? 'regular' : 'good'}`;
  }

  protected systemHealthActionLabel(title: string): string {
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle.includes('factura') || normalizedTitle.includes('venta')) {
      return 'Ver facturas';
    }

    if (
      normalizedTitle.includes('stock') ||
      normalizedTitle.includes('inventario') ||
      normalizedTitle.includes('producto') ||
      normalizedTitle.includes('codigo') ||
      normalizedTitle.includes('imagen') ||
      normalizedTitle.includes('vencer')
    ) {
      return 'Ver inventario';
    }

    return 'Revisar';
  }

  protected openSystemHealthAction(title: string): void {
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle.includes('factura') || normalizedTitle.includes('venta')) {
      this.activatePage('invoices', true);
      return;
    }

    if (
      normalizedTitle.includes('stock') ||
      normalizedTitle.includes('inventario') ||
      normalizedTitle.includes('producto') ||
      normalizedTitle.includes('codigo') ||
      normalizedTitle.includes('imagen') ||
      normalizedTitle.includes('vencer')
    ) {
      this.activatePage('inventory-sheet', true);
    }
  }

  protected formatHealthBytes(value: number | null | undefined): string {
    const bytes = Number(value || 0);

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return 'No disponible';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  protected exportSystemHealthReport(): void {
    const health = this.systemHealth();

    if (!health) {
      return;
    }

    const text = JSON.stringify(health, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salud-sistema-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected updateSalesProfitabilityPeriod(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (!/^\d{4}-\d{2}$/.test(value)) {
      return;
    }

    this.selectedSalesProfitabilityPeriod.set(value);
    this.resetProfitabilityPagination();
    void this.loadSalesProfitabilityAnalytics();
  }

  protected profitabilityChartMax(rows: ProfitabilityChartPoint[], key: 'value' | 'sales' | 'utility' = 'value'): number {
    return Math.max(1, ...rows.map((row) => Number(row[key] || 0)));
  }

  protected profitabilityBarWidth(value: number, maxValue: number): string {
    const width = Math.max(3, Math.min(100, (Number(value || 0) / Math.max(maxValue, 1)) * 100));
    return `${width}%`;
  }

  protected profitabilityVariationClass(value: number): string {
    if (value > 0) {
      return 'positive';
    }

    if (value < 0) {
      return 'negative';
    }

    return 'neutral';
  }

  protected profitabilityKpiReferenceValue(kpi: ProfitabilityKpi): string {
    if (kpi.key === 'net_margin') {
      return `${Number(kpi.previousValue || 0).toFixed(2)}%`;
    }

    return this.formatCurrency(kpi.previousValue || 0);
  }

  protected profitabilityTopSoldRows(): ProfitabilityProductRow[] {
    return this.paginateProfitabilityRows(this.salesProfitabilityAnalytics()?.products.topSold || [], this.profitabilityTopSoldPage());
  }

  protected profitabilityTopProfitableRows(): ProfitabilityProductRow[] {
    return this.paginateProfitabilityRows(
      this.salesProfitabilityAnalytics()?.products.topProfitable || [],
      this.profitabilityTopProfitablePage(),
    );
  }

  protected profitabilityCustomerRows(): ProfitabilityCustomerRow[] {
    return this.paginateProfitabilityRows(this.salesProfitabilityAnalytics()?.customers.topRevenue || [], this.profitabilityCustomersPage());
  }

  protected profitabilityKardexRows(): ProfitabilityKardexRow[] {
    return this.paginateProfitabilityRows(this.filteredSalesProfitabilityKardexRows(), this.profitabilityKardexPage());
  }

  protected profitabilityPageCount(totalRows: number): number {
    return Math.max(1, Math.ceil(totalRows / this.profitabilityPageSize));
  }

  protected profitabilityPageStart(page: number, totalRows: number): number {
    return totalRows === 0 ? 0 : (page - 1) * this.profitabilityPageSize + 1;
  }

  protected profitabilityPageEnd(page: number, totalRows: number): number {
    return Math.min(totalRows, page * this.profitabilityPageSize);
  }

  protected setProfitabilityTablePage(
    table: 'topSold' | 'topProfitable' | 'customers' | 'kardex',
    page: number,
    totalRows: number,
  ): void {
    const nextPage = Math.min(Math.max(1, page), this.profitabilityPageCount(totalRows));

    if (table === 'topSold') {
      this.profitabilityTopSoldPage.set(nextPage);
      return;
    }

    if (table === 'topProfitable') {
      this.profitabilityTopProfitablePage.set(nextPage);
      return;
    }

    if (table === 'customers') {
      this.profitabilityCustomersPage.set(nextPage);
      return;
    }

    this.profitabilityKardexPage.set(nextPage);
  }

  private paginateProfitabilityRows<T>(rows: T[], page: number): T[] {
    const start = (page - 1) * this.profitabilityPageSize;
    return rows.slice(start, start + this.profitabilityPageSize);
  }

  private resetProfitabilityPagination(): void {
    this.profitabilityTopSoldPage.set(1);
    this.profitabilityTopProfitablePage.set(1);
    this.profitabilityCustomersPage.set(1);
    this.profitabilityKardexPage.set(1);
  }

  protected updateSalesProfitabilityKardexProductFilter(event: Event): void {
    this.salesProfitabilityKardexProductFilter.set((event.target as HTMLInputElement).value);
    this.profitabilityKardexPage.set(1);
  }

  protected updateSalesProfitabilityKardexCategoryFilter(event: Event): void {
    this.salesProfitabilityKardexCategoryFilter.set((event.target as HTMLSelectElement).value);
    this.profitabilityKardexPage.set(1);
  }

  protected updateSalesProfitabilityKardexWarehouseFilter(event: Event): void {
    this.salesProfitabilityKardexWarehouseFilter.set((event.target as HTMLSelectElement).value);
    this.profitabilityKardexPage.set(1);
  }

  protected updateSalesProfitabilityKardexDateFilter(event: Event): void {
    this.salesProfitabilityKardexDateFilter.set((event.target as HTMLInputElement).value);
    this.profitabilityKardexPage.set(1);
  }

  protected exportSalesProfitabilityReport(report: string, format: 'csv' | 'excel' | 'pdf'): void {
    const analytics = this.salesProfitabilityAnalytics();

    if (!analytics) {
      return;
    }

    const rows = this.resolveSalesProfitabilityReportRows(report, analytics);
    const headers = rows[0] || ['Reporte', 'Valor'];
    const body = rows.slice(1);

    if (format === 'pdf') {
      const printWindow = window.open('', '_blank', 'width=1000,height=800');
      if (!printWindow) {
        return;
      }

      this.writePrintableReport(printWindow, {
        title: report,
        subtitle: 'Modulo de Ventas y Rentabilidad',
        summary: [
          ['Generado', new Date(analytics.generatedAt).toLocaleString('es-HN')],
          ['Utilidad neta', this.formatCurrency(analytics.profitability.netProfit)],
          ['Margen neto', `${analytics.profitability.netMargin.toFixed(2)}%`],
        ],
        headers,
        rows: body,
      });
      return;
    }

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.normalizeReportFileName(report)}.${format === 'excel' ? 'csv' : 'csv'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private resolveSalesProfitabilityReportRows(report: string, analytics: SalesProfitabilityAnalytics): string[][] {
    const normalizedReport = this.normalizeText(report);

    if (normalizedReport.includes('kardex')) {
      return [
        ['Fecha', 'Documento', 'Movimiento', 'Producto', 'Entrada', 'Salida', 'Existencia', 'Costo unitario', 'Costo promedio', 'Usuario'],
        ...this.filteredSalesProfitabilityKardexRows().map((row) => [
          row.date || '',
          row.document,
          row.movementType,
          row.productName,
          this.formatNumber(row.entrada),
          this.formatNumber(row.salida),
          this.formatNumber(row.existencia),
          this.formatCurrency(row.unitCost),
          this.formatCurrency(row.averageCost),
          row.userName,
        ]),
      ];
    }

    if (normalizedReport.includes('cliente')) {
      return [
        ['Cliente', 'Facturas', 'Ventas', 'Utilidad', 'Ultima venta'],
        ...analytics.customers.topRevenue.map((row) => [
          row.customerName,
          this.formatNumber(row.invoices),
          this.formatCurrency(row.sales),
          this.formatCurrency(row.utility),
          row.lastSale || '',
        ]),
      ];
    }

    if (normalizedReport.includes('producto') || normalizedReport.includes('vendido')) {
      const rows = normalizedReport.includes('menos') ? analytics.products.lowProfitability : analytics.products.topSold;
      return [
        ['Producto', 'Categoria', 'Cantidad', 'Ventas', 'Utilidad', 'Precio', 'Costo', 'Margen'],
        ...rows.map((row) => [
          row.productName,
          row.category,
          this.formatNumber(row.quantity || 0),
          this.formatCurrency(row.sales || 0),
          this.formatCurrency(row.utility || 0),
          this.formatCurrency(row.salePrice || 0),
          this.formatCurrency(row.cost || 0),
          `${Number((row.margin || 0) * 100).toFixed(2)}%`,
        ]),
      ];
    }

    return [
      ['Indicador', 'Valor'],
      ['Ingresos totales', this.formatCurrency(analytics.profitability.income)],
      ['Costo de ventas', this.formatCurrency(analytics.profitability.costOfSales)],
      ['Gastos operativos', this.formatCurrency(analytics.profitability.operationalExpenses)],
      ['Utilidad bruta', this.formatCurrency(analytics.profitability.grossProfit)],
      ['Utilidad neta', this.formatCurrency(analytics.profitability.netProfit)],
      ['Margen neto', `${analytics.profitability.netMargin.toFixed(2)}%`],
      ['Rentabilidad', analytics.profitability.generalProfitability],
    ];
  }

  private normalizeReportFileName(value: string): string {
    return this.normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'reporte';
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CARGA LA PAGINA FACTURAS DESDE SQL SERVER.
  // LLAMA /api/invoices Y /api/invoices/summary O LOS HANDLERS DE ELECTRON.
  protected async loadInvoicesPageData(): Promise<void> {
    if (this.invoiceLoading()) return;
    this.invoiceLoading.set(true);
    this.invoiceError.set('');

    try {
      // El listado es la fuente de los indicadores filtrados; no depende del resumen global.
      const response = this.desktopApi
        ? await this.desktopApi.getInvoices()
        : await firstValueFrom(this.http.get<InvoicesResponse>('/api/invoices'));
      this.invoiceRows.set(response.invoices);
      this.invoicePage.set(1);
      const preview = this.invoicePreview();
      if (preview) void this.openInvoicePreview(preview);
      else this.closeInvoicePreview();
      // Una consulta histórica lenta o fallida no debe impedir filtrar las facturas.
      void this.loadInvoiceMonthlySalesTrend();
    } catch (error) {
      this.invoiceRows.set([]);
      this.closeInvoicePreview();
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

  protected openQuotesModal(): void {
    this.modalTables.reset('quotes');
    this.quoteModalOpen.set(true);
    void this.loadQuotes();
  }

  protected closeQuotesModal(): void {
    if (this.quoteSaving()) {
      return;
    }

    this.quoteModalOpen.set(false);
    this.quoteError.set('');
  }

  protected isQuoteExpanded(quoteId: number): boolean {
    return this.expandedQuoteIds().includes(quoteId);
  }

  protected isQuoteDetailLoading(quoteId: number): boolean {
    return this.quoteDetailLoadingIds().includes(quoteId);
  }

  protected quoteLinesFor(quoteId: number): QuoteLine[] {
    return this.quoteDetailRows()[quoteId] || [];
  }

  protected async toggleQuoteDetails(quoteId: number): Promise<void> {
    if (this.isQuoteExpanded(quoteId)) {
      this.expandedQuoteIds.update((ids) => ids.filter((id) => id !== quoteId));
      return;
    }

    this.expandedQuoteIds.update((ids) => (ids.includes(quoteId) ? ids : [...ids, quoteId]));

    if (this.quoteDetailRows()[quoteId]) {
      return;
    }

    await this.loadQuoteDetailsForModal(quoteId);
  }

  private async loadQuoteDetailsForModal(quoteId: number): Promise<void> {
    this.quoteDetailLoadingIds.update((ids) => (ids.includes(quoteId) ? ids : [...ids, quoteId]));
    this.quoteError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getQuoteDetails(quoteId)
        : await firstValueFrom(this.http.get<QuoteDetailsResponse>(`/api/quotes/${quoteId}`));

      this.quoteDetailRows.update((details) => ({
        ...details,
        [quoteId]: response.lines,
      }));
    } catch (error) {
      this.quoteError.set(this.extractErrorMessage(error, 'No se pudieron cargar los articulos de la cotizacion.'));
    } finally {
      this.quoteDetailLoadingIds.update((ids) => ids.filter((id) => id !== quoteId));
    }
  }

  protected async loadQuotes(): Promise<void> {
    this.quoteLoading.set(true);
    this.quoteError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getQuotes('ABIERTA')
        : await firstValueFrom(this.http.get<QuotesResponse>('/api/quotes?status=ABIERTA'));

      this.quoteRows.set(response.quotes);
      this.expandedQuoteIds.set([]);
      this.quoteDetailRows.set({});
    } catch (error) {
      this.quoteRows.set([]);
      this.quoteError.set(this.extractErrorMessage(error, 'No se pudieron cargar las cotizaciones.'));
    } finally {
      this.quoteLoading.set(false);
    }
  }

  protected async saveCurrentQuote(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser) {
      this.checkoutError.set('No hay un usuario autenticado para guardar la cotizacion.');
      return;
    }

    if (this.activeMode() !== 'sale' || this.cartDetails().length === 0) {
      this.checkoutError.set('Agrega productos a la venta antes de guardar una cotizacion.');
      return;
    }

    this.quoteSaving.set(true);
    this.checkoutError.set('');
    this.quoteError.set('');

    try {
      const quote = await this.requestCreateQuote({
        user: currentUser.nombre || currentUser.usuario,
        userId: currentUser.id,
        paymentTypeId: this.selectedPaymentTypeId(),
        customerId: this.selectedCustomerId(),
        customerName: this.selectedCustomer(),
        lines: this.salePayloadLines(),
      });

      this.cart.set([]);
      this.purchaseCosts.set({});
      this.salePrices.set({});
      this.saleReceivedAmount.set('');
      this.selectedPaymentMethod.set('efectivo');
      this.selectedCustomer.set('Cliente final');
      this.selectedCustomerId.set(null);
      this.selectedSupplier.set('');
      this.activeQuoteId.set(null);
      this.activeQuoteNumber.set('');
      this.showSaleSuccess(`Cotizacion ${quote.quote.number} guardada correctamente.`);
      if (this.quoteModalOpen()) {
        await this.loadQuotes();
      }
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo guardar la cotizacion.');
      this.checkoutError.set(message);
      this.quoteError.set(message);
      this.showSaleSuccess(message, 'error');
    } finally {
      this.quoteSaving.set(false);
    }
  }

  protected async loadQuoteToCart(quoteId: number): Promise<void> {
    this.quoteLoading.set(true);
    this.quoteError.set('');

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getQuoteDetails(quoteId)
        : await firstValueFrom(this.http.get<QuoteDetailsResponse>(`/api/quotes/${quoteId}`));

      this.activeMode.set('sale');
      this.cart.set(response.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })));
      this.salePrices.set(response.lines.reduce<Record<number, number>>((prices, line) => ({
        ...prices,
        [line.productId]: line.salePrice,
      }), {}));
      this.purchaseCosts.set({});
      this.selectedPaymentMethod.set(this.paymentMethodFromTypeId(response.quote.paymentTypeId));
      this.selectedCustomerId.set(response.quote.customerId);
      this.selectedCustomer.set(response.quote.customerName || 'Cliente final');
      this.activeQuoteId.set(response.quote.id);
      this.activeQuoteNumber.set(response.quote.number);
      this.quoteModalOpen.set(false);
      this.showSaleSuccess(`Cotizacion ${response.quote.number} cargada para facturar.`);
    } catch (error) {
      this.quoteError.set(this.extractErrorMessage(error, 'No se pudo cargar la cotizacion.'));
    } finally {
      this.quoteLoading.set(false);
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
      this.selectedCutId.set(null);
      const preview = await this.loadDailyCutPreview(dateTo);
      this.cutPreview.set(preview);
      await this.loadCreditPaymentsForCut(dateTo);
    } catch (error) {
      this.cutRows.set([]);
      this.cutPreview.set(null);
      this.creditPaymentRows.set([]);
      this.cutError.set(this.extractErrorMessage(error, 'No se pudieron cargar los cortes.'));
    } finally {
      this.cutLoading.set(false);
    }
  }

  protected async loadPettyCashData(): Promise<void> {
    this.pettyCashLoading.set(true);
    this.pettyCashError.set('');

    try {
      const [cutsResponse, recordsResponse] = await Promise.all([
        this.desktopApi
          ? this.desktopApi.getDailyCuts()
          : firstValueFrom(this.http.get<DailyCutsResponse>('/api/daily-cuts')),
        this.desktopApi?.getPettyCashRecords
          ? this.desktopApi.getPettyCashRecords()
          : firstValueFrom(this.http.get<PettyCashRecordsResponse>('/api/petty-cash')),
      ]);

      this.pettyCashCuts.set(cutsResponse.cuts);
      this.pettyCashManualRecords.set(recordsResponse.records || []);
      this.pettyCashPage.set(1);
      this.scheduleVisibleChartsRefresh();
    } catch (error) {
      this.pettyCashCuts.set([]);
      this.pettyCashManualRecords.set([]);
      this.pettyCashError.set(this.extractErrorMessage(error, 'No se pudo cargar caja chica.'));
    } finally {
      this.pettyCashLoading.set(false);
    }
  }

  protected setPettyCashTrendPeriod(period: PettyCashTrendPeriod): void {
    this.pettyCashTrendPeriod.set(period);
    this.scheduleVisibleChartsRefresh();
  }

  protected async loadFinancialMovements(): Promise<void> {
    this.financialMovementsLoading.set(true);
    this.financialMovementsError.set('');

    try {
      const [year, month] = this.selectedFinancialPeriod().split('-').map((value) => Number(value));
      const response = this.desktopApi?.getFinancialMovements
        ? await this.desktopApi.getFinancialMovements(year, month)
        : await firstValueFrom(this.http.get<FinancialMovementsResponse>(
            `/api/financial-movements?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
          ));

      this.financialMovements.set(response.movements || []);
      this.scheduleVisibleChartsRefresh();
    } catch (error) {
      this.financialMovements.set([]);
      this.financialMovementsError.set(this.extractErrorMessage(error, 'No se pudieron cargar los movimientos financieros.'));
    } finally {
      this.financialMovementsLoading.set(false);
    }
  }

  protected openFinancialMovementModal(): void {
    this.financialMovementDraft.set(this.defaultFinancialMovementDraft());
    this.financialMovementsError.set('');
    this.financialMovementModalOpen.set(true);
  }

  private defaultFinancialMovementDraft(): FinancialMovementDraft {
    return {
      date: this.currentDateTimeLocalValue(),
      movementType: 'salida',
      paymentMethod: 'efectivo',
      target: 'caja_chica',
      category: 'Operacion',
      description: '',
      amount: '',
      bankAccount: '',
      creditCard: '',
    };
  }

  protected closeFinancialMovementModal(): void {
    if (this.financialMovementsSaving()) {
      return;
    }

    this.financialMovementModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected updateFinancialPeriod(event: Event): void {
    const value = (event.target as HTMLInputElement).value || this.todayDateKey().slice(0, 7);
    this.selectedFinancialPeriod.set(value);
    void this.loadFinancialMovements();
  }

  protected updateFinancialMovementDraftField(field: keyof FinancialMovementDraft, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.financialMovementDraft.update((draft) => {
      const nextDraft = { ...draft, [field]: value };

      if (field === 'paymentMethod') {
        const paymentMethod = value as FinancialPaymentMethod;
        if (paymentMethod === 'tarjeta_credito') {
          nextDraft.movementType = 'salida';
          nextDraft.target = 'tarjeta_credito';
          nextDraft.creditCard = nextDraft.creditCard || this.financialCreditCards[0];
        } else if (paymentMethod === 'transferencia') {
          nextDraft.target = 'cuenta_bancaria';
          nextDraft.bankAccount = nextDraft.bankAccount || this.financialBankAccounts[0];
          nextDraft.creditCard = '';
        } else if (paymentMethod === 'efectivo' && ['cuenta_bancaria', 'tarjeta_credito'].includes(draft.target)) {
          nextDraft.target = 'caja_chica';
          nextDraft.bankAccount = '';
          nextDraft.creditCard = '';
        }
      }

      if (field === 'target') {
        const target = value as FinancialMovementTarget;
        if (target === 'cuenta_bancaria') {
          nextDraft.paymentMethod = 'transferencia';
          nextDraft.bankAccount = nextDraft.bankAccount || this.financialBankAccounts[0];
          nextDraft.creditCard = '';
        } else if (target === 'tarjeta_credito') {
          nextDraft.movementType = 'salida';
          nextDraft.paymentMethod = 'tarjeta_credito';
          nextDraft.creditCard = nextDraft.creditCard || this.financialCreditCards[0];
        }
      }

      if (field === 'movementType' && value === 'entrada' && draft.paymentMethod === 'tarjeta_credito') {
        nextDraft.paymentMethod = 'efectivo';
        nextDraft.target = 'caja_chica';
        nextDraft.creditCard = '';
      }

      return nextDraft;
    });
  }

  protected async saveFinancialMovement(): Promise<void> {
    const draft = this.financialMovementDraft();
    const amount = Number(draft.amount);
    const currentUser = this.currentUser();

    if (!Number.isFinite(amount) || amount <= 0) {
      this.financialMovementsError.set('Ingresa un monto valido.');
      return;
    }

    if (draft.movementType === 'salida' && !draft.description.trim()) {
      this.financialMovementsError.set('La descripcion es requerida para registrar una salida.');
      return;
    }

    this.financialMovementsSaving.set(true);
    this.financialMovementsError.set('');

    try {
      const payload = {
        date: draft.date,
        movementType: draft.movementType,
        paymentMethod: draft.paymentMethod,
        target: draft.target,
        category: draft.category,
        description: draft.description.trim(),
        amount,
        bankAccount: draft.bankAccount.trim(),
        creditCard: draft.creditCard.trim(),
        userId: currentUser?.id || null,
      };
      const response = this.desktopApi?.createFinancialMovement
        ? await this.desktopApi.createFinancialMovement(payload)
        : await firstValueFrom(this.http.post<{ movement: FinancialMovement }>('/api/financial-movements', payload));

      const period = String(response.movement.date || draft.date).slice(0, 7);
      this.selectedFinancialPeriod.set(period);
      this.financialMovementModalOpen.set(false);
      await this.loadFinancialMovements();
    } catch (error) {
      this.financialMovementsError.set(this.extractErrorMessage(error, 'No se pudo guardar el movimiento financiero.'));
    } finally {
      this.financialMovementsSaving.set(false);
    }
  }

  protected financialMovementTypeLabel(value: FinancialMovementType): string {
    return this.financialMovementTypes.find((item) => item.id === value)?.label || value;
  }

  protected financialPaymentMethodLabel(value: FinancialPaymentMethod): string {
    return this.financialPaymentMethods.find((item) => item.id === value)?.label || value;
  }

  protected financialTargetLabel(value: FinancialMovementTarget): string {
    return this.financialMovementTargets.find((item) => item.id === value)?.label || value;
  }

  protected toggleFinancialDay(key: string): void {
    this.expandedFinancialDayKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected toggleFinancialType(key: string): void {
    this.expandedFinancialTypeKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected toggleFinancialPayment(key: string): void {
    this.expandedFinancialPaymentKeys.update((keys) =>
      keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key],
    );
  }

  protected isFinancialDayExpanded(key: string): boolean {
    return this.expandedFinancialDayKeys().includes(key);
  }

  protected isFinancialTypeExpanded(key: string): boolean {
    return this.expandedFinancialTypeKeys().includes(key);
  }

  protected isFinancialPaymentExpanded(key: string): boolean {
    return this.expandedFinancialPaymentKeys().includes(key);
  }

  protected previousPettyCashPage(): void {
    this.pettyCashPage.update((page) => Math.max(1, page - 1));
  }

  protected nextPettyCashPage(): void {
    this.pettyCashPage.update((page) => Math.min(this.pettyCashPageCount(), page + 1));
  }

  protected openPettyCashModal(): void {
    this.pettyCashError.set('');
    this.pettyCashEditingId.set(null);
    this.pettyCashEditingCutId.set(null);
    this.pettyCashEditMode.set('new');
    this.pettyCashDraft.set({
      date: this.todayDateKey(),
      initialAmount: 1500,
      finalAmount: 0,
      turnBilling: 0,
      cashToPetty: 0,
      registerBalance: 1500,
      changeWallet: 0,
      pettyCashTotal: this.pettyCashAvailableBalance(),
      cashOut: 0,
      reason: '',
      realCashTotal: this.pettyCashAvailableBalance(),
      comments: '',
      dividendBenefit: 0,
      fourteenthBonus: 0,
    });
    this.pettyCashModalOpen.set(true);
  }

  protected canEditPettyCashRow(row: PettyCashRow): boolean {
    return true;
  }

  protected editPettyCashRow(row: PettyCashRow): void {
    const recordId = this.getPettyCashManualId(row);
    const cutId = this.getPettyCashCutId(row);

    this.pettyCashError.set('');
    this.pettyCashEditingId.set(recordId);
    this.pettyCashEditingCutId.set(cutId);
    this.pettyCashEditMode.set(recordId || cutId ? 'edit' : 'adjust');
    this.pettyCashDraft.set({
      date: row.date || this.todayDateKey(),
      initialAmount: row.initialAmount,
      finalAmount: row.finalAmount,
      turnBilling: row.turnBilling,
      cashToPetty: row.cashToPetty,
      registerBalance: row.registerBalance,
      changeWallet: row.changeWallet,
      pettyCashTotal: row.pettyCashTotal,
      cashOut: row.cashOut,
      reason: row.reason,
      realCashTotal: row.realCashTotal,
      comments: row.comments,
      dividendBenefit: row.dividendReserve,
      fourteenthBonus: row.fourteenthReserve,
    });
    this.pettyCashModalOpen.set(true);
  }

  protected openPettyCashDeleteModal(row: PettyCashRow): void {
    if (row.source === 'base') {
      this.pettyCashError.set('La fila base no se puede eliminar porque no es un registro de base de datos.');
      return;
    }

    this.pettyCashError.set('');
    this.pettyCashDeleteTarget.set(row);
  }

  protected closePettyCashDeleteModal(): void {
    if (this.pettyCashSaving()) {
      return;
    }

    this.pettyCashDeleteTarget.set(null);
  }

  protected async confirmDeletePettyCashRow(): Promise<void> {
    const row = this.pettyCashDeleteTarget();
    const currentUser = this.currentUser();

    if (!row) {
      return;
    }

    if (row.source === 'base') {
      this.pettyCashError.set('La fila base no se puede eliminar.');
      this.pettyCashDeleteTarget.set(null);
      return;
    }

    const recordId = this.getPettyCashManualId(row);
    const cutId = this.getPettyCashCutId(row);

    this.pettyCashSaving.set(true);
    this.pettyCashError.set('');

    try {
      if (recordId && this.desktopApi?.deletePettyCashRecord) {
        await this.desktopApi.deletePettyCashRecord({ id: recordId, userId: currentUser?.id || null });
      } else if (recordId) {
        await firstValueFrom(this.http.delete<{ id: number; deleted: boolean }>(
          `/api/petty-cash/${encodeURIComponent(recordId)}?userId=${encodeURIComponent(currentUser?.id || '')}`,
        ));
      } else if (cutId && this.desktopApi?.deleteDailyCutCashManagement) {
        await this.desktopApi.deleteDailyCutCashManagement({ id: cutId, userId: currentUser?.id || null });
      } else if (cutId) {
        await firstValueFrom(this.http.delete<{ id: number; deleted: boolean }>(
          `/api/daily-cuts/${encodeURIComponent(cutId)}/cash-management?userId=${encodeURIComponent(currentUser?.id || '')}`,
        ));
      } else {
        throw new Error('No se pudo identificar el registro a eliminar.');
      }

      if (recordId) {
        this.pettyCashManualRecords.update((records) => records.filter((record) => record.id !== recordId));
      }

      if (cutId) {
        this.pettyCashCuts.update((cuts) => cuts.filter((cut) => cut.id !== cutId));
      }

      this.pettyCashDeleteTarget.set(null);
      this.pettyCashPage.set(Math.min(this.pettyCashPage(), this.pettyCashPageCount()));
      await this.loadPettyCashData();
      this.scheduleVisibleChartsRefresh();
      this.showPettyCashToast('Registro de caja chica eliminado correctamente.');
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo eliminar el registro de caja chica.');
      this.pettyCashError.set(message);
      this.showPettyCashToast(message, 'error');
    } finally {
      this.pettyCashSaving.set(false);
    }
  }

  protected closePettyCashModal(): void {
    if (this.pettyCashSaving()) {
      return;
    }

    this.pettyCashModalOpen.set(false);
    this.pettyCashError.set('');
    this.pettyCashEditingId.set(null);
    this.pettyCashEditingCutId.set(null);
    this.pettyCashEditMode.set('new');
  }

  protected updatePettyCashDraftField(field: keyof PettyCashDraft, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const value = target.value;
    const numericFields = new Set([
      'initialAmount',
      'finalAmount',
      'turnBilling',
      'cashToPetty',
      'registerBalance',
      'changeWallet',
      'pettyCashTotal',
      'cashOut',
      'realCashTotal',
      'dividendBenefit',
      'fourteenthBonus',
    ]);

    this.pettyCashDraft.update((draft) => {
      const nextDraft = {
        ...draft,
        [field]: numericFields.has(String(field)) ? Number(value || 0) : value,
      } as PettyCashDraft;

      if (field === 'initialAmount' || field === 'finalAmount' || field === 'cashOut') {
        return this.calculatePettyCashDraftValues(nextDraft);
      }

      return nextDraft;
    });
  }

  protected calculatePettyCashDraft(): void {
    this.pettyCashDraft.update((draft) => this.calculatePettyCashDraftValues(draft));
  }

  private calculatePettyCashDraftValues(draft: PettyCashDraft): PettyCashDraft {
    const initialAmount = this.roundMoney(Number(draft.initialAmount || 0));
    const finalAmount = this.roundMoney(Number(draft.finalAmount || 0));
    const turnBilling = this.roundMoney(Math.max(finalAmount - initialAmount, 0));
    const cashToPetty = turnBilling;
    const dividendBenefit = this.roundMoney(turnBilling * 0.01);
    const fourteenthBonus = this.roundMoney(turnBilling * 0.01);
    const cashOut = this.roundMoney(Number(draft.cashOut || 0));
    const pettyCashTotal = this.roundMoney(this.pettyCashAvailableBalance() + cashToPetty - cashOut);

    return {
      ...draft,
      initialAmount,
      finalAmount,
      turnBilling,
      cashToPetty,
      registerBalance: initialAmount,
      dividendBenefit,
      fourteenthBonus,
      cashOut,
      pettyCashTotal,
      realCashTotal: pettyCashTotal,
    };
  }

  protected async savePettyCashRecord(): Promise<void> {
    const draft = this.pettyCashDraft();
    const currentUser = this.currentUser();
    const editingId = this.pettyCashEditingId();
    const editingCutId = this.pettyCashEditingCutId();
    const editMode = this.pettyCashEditMode();

    if (!draft.date) {
      const message = 'Selecciona la fecha del registro.';
      this.pettyCashError.set(message);
      this.showPettyCashToast(message, 'error');
      return;
    }

    this.pettyCashSaving.set(true);
    this.pettyCashError.set('');

    try {
      const payload = {
        ...draft,
        userId: currentUser?.id || null,
      };
      if (editingCutId) {
        const response = this.desktopApi?.updateDailyCutCashManagement
          ? await this.desktopApi.updateDailyCutCashManagement({ ...payload, id: editingCutId })
          : await firstValueFrom(this.http.put<DailyCutResponse>(`/api/daily-cuts/${encodeURIComponent(editingCutId)}/cash-management`, payload));

        this.pettyCashCuts.update((cuts) => cuts.map((cut) => cut.id === editingCutId ? response.cut : cut));
      } else {
        const response = editingId
          ? this.desktopApi?.updatePettyCashRecord
            ? await this.desktopApi.updatePettyCashRecord({ ...payload, id: editingId })
            : await firstValueFrom(this.http.put<{ record: PettyCashManualRecord }>(`/api/petty-cash/${encodeURIComponent(editingId)}`, payload))
          : this.desktopApi?.createPettyCashRecord
            ? await this.desktopApi.createPettyCashRecord(payload)
            : await firstValueFrom(this.http.post<{ record: PettyCashManualRecord }>('/api/petty-cash', payload));

        this.pettyCashManualRecords.update((records) =>
          editingId
            ? records.map((record) => record.id === editingId ? response.record : record)
            : [response.record, ...records],
        );
      }
      this.pettyCashPage.set(1);
      this.pettyCashModalOpen.set(false);
      this.pettyCashEditingId.set(null);
      this.pettyCashEditingCutId.set(null);
      this.pettyCashEditMode.set('new');
      await this.loadPettyCashData();
      this.scheduleVisibleChartsRefresh();
      this.showPettyCashToast(
        editingId || editingCutId
          ? 'Registro de caja chica actualizado correctamente.'
          : editMode === 'adjust'
            ? 'Correccion de caja chica guardada correctamente.'
            : 'Registro de caja chica guardado correctamente.',
      );
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo guardar el registro de caja chica.');
      this.pettyCashError.set(message);
      this.showPettyCashToast(message, 'error');
    } finally {
      this.pettyCashSaving.set(false);
    }
  }

  private getPettyCashManualId(row: PettyCashRow): number | null {
    if (row.source !== 'manual') {
      return null;
    }

    const id = Number(String(row.id).replace('manual-', ''));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private getPettyCashCutId(row: PettyCashRow): number | null {
    if (row.source !== 'cut') {
      return null;
    }

    const id = Number(String(row.id).replace('cut-', ''));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private mapPettyCashRow(cut: DailyCut): PettyCashRow {
    const initialCash = Math.max(Number(cut.initialCash || 0), 0);
    const physicalCash = Math.max(Number(cut.cashTotal || 0), 0);
    const turnBilling = Math.max(physicalCash - initialCash, 0);
    const fourteenthReserve = this.roundMoney(turnBilling * 0.01);
    const dividendReserve = this.roundMoney(turnBilling * 0.01);
    const totalReserve = this.roundMoney(fourteenthReserve + dividendReserve);
    const cashOut = Math.max(Number(cut.cashOut || 0), 0);
    const cashToPetty = this.roundMoney(turnBilling);
    const pettyCashTotal = this.roundMoney(cashToPetty - totalReserve - cashOut);

    return {
      id: `cut-${cut.id}`,
      date: String(cut.date || '').slice(0, 10),
      userName: cut.userName || 'Usuario sin nombre',
      initialAmount: initialCash,
      finalAmount: physicalCash,
      turnBilling: this.roundMoney(turnBilling),
      cashToPetty,
      registerBalance: Math.min(physicalCash, initialCash),
      changeWallet: 0,
      pettyCashTotal,
      fourteenthReserve,
      dividendReserve,
      totalReserve,
      cashOut,
      reason: '',
      realCashTotal: pettyCashTotal,
      comments: '',
      statusName: cut.statusName,
      source: 'cut',
    };
  }

  private mapPettyCashManualRow(record: PettyCashManualRecord): PettyCashRow {
    const dividendReserve = this.roundMoney(record.dividendBenefit || record.turnBilling * 0.01);
    const fourteenthReserve = this.roundMoney(record.fourteenthBonus || record.turnBilling * 0.01);

    return {
      id: `manual-${record.id}`,
      date: String(record.date || '').slice(0, 10),
      userName: record.userName || 'Registro manual',
      initialAmount: this.roundMoney(record.initialAmount),
      finalAmount: this.roundMoney(record.finalAmount),
      turnBilling: this.roundMoney(record.turnBilling),
      cashToPetty: this.roundMoney(record.cashToPetty),
      registerBalance: this.roundMoney(record.registerBalance),
      changeWallet: this.roundMoney(record.changeWallet),
      pettyCashTotal: this.roundMoney(record.pettyCashTotal),
      fourteenthReserve,
      dividendReserve,
      totalReserve: this.roundMoney(fourteenthReserve + dividendReserve),
      cashOut: this.roundMoney(record.cashOut),
      reason: record.reason || '',
      realCashTotal: this.roundMoney(record.realCashTotal),
      comments: record.comments || '',
      statusName: 'Manual',
      source: 'manual',
    };
  }

  private pettyCashBaselineRow(): PettyCashRow {
    return {
      id: 'base-2026-06-11',
      date: '2026-06-11',
      userName: 'Base cuadrada',
      initialAmount: 0,
      finalAmount: 0,
      turnBilling: 0,
      cashToPetty: 0,
      registerBalance: 0,
      changeWallet: 0,
      pettyCashTotal: 7426,
      fourteenthReserve: 0,
      dividendReserve: 0,
      totalReserve: 0,
      cashOut: 0,
      reason: 'Saldo cuadrado disponible',
      realCashTotal: 7426,
      comments: 'Ultimo saldo confirmado de caja chica del 11/06/2026',
      statusName: 'Base',
      source: 'base',
    };
  }

  private roundMoney(value: number): number {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  private parseLocalDate(value: string | null | undefined): Date {
    const [yearText, monthText, dayText] = String(value || '').slice(0, 10).split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return this.startOfDay(new Date());
    }

    return new Date(year, month - 1, day);
  }

  private pettyCashTrendKey(date: Date, period: PettyCashTrendPeriod): string {
    if (period === 'day') {
      return this.formatDateKey(date);
    }

    if (period === 'week') {
      return this.formatDateKey(this.startOfWeek(date));
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private pettyCashTrendLabel(date: Date, period: PettyCashTrendPeriod): string {
    if (period === 'day') {
      return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(date);
    }

    if (period === 'week') {
      return `Sem ${new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit' }).format(this.startOfWeek(date))}`;
    }

    return new Intl.DateTimeFormat('es-HN', { month: 'short', year: '2-digit' }).format(date);
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CALCULA EL CORTE DEL DIA SIN GUARDARLO EN dbo.CORTE_DIARIO.
  // LLAMA /api/daily-cuts/preview O window.electronAPI.previewDailyCut().
  protected async loadDailyCutPreview(date: string, userId?: number): Promise<DailyCut> {
    const resolvedUserId = userId;
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
      const resolvedUserId = userId;
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

  private async fetchProducts(clearCurrentCart = true): Promise<void> {
    this.productsLoading.set(true);
    this.productsError.set('');
    this.billingCatalogLoaded = false;

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getProducts()
        : await firstValueFrom(this.http.get<ProductsResponse>('/api/products'));

      this.products.set(
        response.products.map((product) => ({
          ...product,
          barcodes: product.barcodes || [],
          margin: this.productMarkupRatio(product.unitCost, product.salePrice),
        })),
      );
      if (clearCurrentCart) {
        this.cart.set([]);
        this.purchaseCosts.set({});
        this.salePrices.set({});
      }
      this.billingPage.set(1);
      this.costsPage.set(1);
      this.inventoryPage.set(1);
    } catch (error) {
      this.products.set([]);
      if (clearCurrentCart) {
        this.cart.set([]);
        this.purchaseCosts.set({});
        this.salePrices.set({});
      }
      this.productsError.set(this.extractErrorMessage(error, 'No se pudieron cargar los productos desde la base de datos.'));
    } finally {
      this.productsLoading.set(false);
    }
  }

  private async fetchBillingProducts(force = false): Promise<void> {
    if (!force && this.billingCatalogLoaded && this.products().length > 0) {
      return;
    }

    this.productsLoading.set(true);
    this.productsError.set('');

    try {
      const response = await this.facturacionApi.getBillingProducts();

      this.products.set(
        response.products.map((product) => ({
          ...product,
          barcodes: product.barcodes || [],
          description: product.description || null,
          supplier: null,
          previousMonthSales: 0,
          createdBy: product.createdBy || null,
          updatedBy: product.updatedBy || null,
          createdAt: product.createdAt || null,
          updatedAt: product.updatedAt || null,
          primaryLotNumber: null,
          primaryLotExpiryDate: null,
          activeLotCount: 0,
          activeLotNumbers: [],
          margin: this.productMarkupRatio(product.unitCost, product.salePrice),
        })),
      );
      this.billingPage.set(1);
      this.billingCatalogLoaded = true;
    } catch (error) {
      this.products.set([]);
      this.billingCatalogLoaded = false;
      this.productsError.set(this.extractErrorMessage(error, 'No se pudieron cargar los productos de facturacion.'));
    } finally {
      this.productsLoading.set(false);
    }
  }

  private createEmptyAssembledOfferDraft(): AssembledOfferDraft {
    return {
      code: '',
      name: '',
      description: '',
      imageUrl: '',
      salePrice: '',
      startsAt: this.currentDateTimeLocalValue(),
      endsAt: `${this.dateOffsetKey(30)}T23:59`,
      active: true,
      components: [],
    };
  }

  protected async openAssembledOfferModal(): Promise<void> {
    this.assembledOfferEditingId.set(null);
    this.assembledOfferDraft.set(this.createEmptyAssembledOfferDraft());
    this.assembledOfferError.set('');
    this.assembledOfferMessage.set('');
    this.assembledOfferModalOpen.set(true);

    if (this.products().length === 0) {
      await this.fetchProducts(false);
    }
  }

  protected closeAssembledOfferModal(): void {
    if (this.assembledOfferSaving()) {
      return;
    }

    this.assembledOfferModalOpen.set(false);
    this.assembledOfferError.set('');
    this.assembledOfferEditingId.set(null);
  }

  protected async openAssembledOffersListModal(): Promise<void> {
    this.assembledOffersListModalOpen.set(true);
    this.assembledOfferSearch.set('');
    await this.loadAssembledOffers();
  }

  protected closeAssembledOffersListModal(): void {
    this.assembledOffersListModalOpen.set(false);
    this.assembledOfferSearch.set('');
    this.selectedAssembledOffer.set(null);
    this.assembledOfferDetailModalOpen.set(false);
  }

  protected async loadAssembledOffers(): Promise<void> {
    this.assembledOfferLoading.set(true);
    this.assembledOfferError.set('');

    try {
      const response = this.desktopApi?.getAssembledOffers
        ? await this.desktopApi.getAssembledOffers()
        : await firstValueFrom(this.http.get<{ offers: AssembledOffer[] }>('/api/assembled-offers'));
      this.assembledOffers.set(response.offers || []);
    } catch (error) {
      this.assembledOfferError.set(this.extractErrorMessage(error, 'No se pudieron cargar los codigos armados.'));
    } finally {
      this.assembledOfferLoading.set(false);
    }
  }

  protected updateAssembledOfferSearch(event: Event): void {
    this.assembledOfferSearch.set((event.target as HTMLInputElement).value);
  }

  protected updateAssembledOfferDraft(field: keyof Omit<AssembledOfferDraft, 'components'>, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = field === 'active' ? input.checked : input.value;
    this.assembledOfferDraft.update((draft) => ({
      ...draft,
      [field]: value,
    }));
  }

  protected updateAssembledOfferComponent(
    index: number,
    field: 'productId' | 'quantity' | 'isGift',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const value = field === 'isGift'
      ? (input as HTMLInputElement).checked
      : field === 'productId'
        ? Number(input.value || 0) || null
        : input.value;

    this.assembledOfferDraft.update((draft) => ({
      ...draft,
      components: draft.components.map((component, componentIndex) =>
        componentIndex === index ? { ...component, [field]: value } : component,
      ),
    }));
  }

  protected openAssembledOfferProductPicker(): void {
    this.resetInventoryAuxTable('picker');
    this.assembledOfferProductPickerOpen.set(true);
  }

  protected closeAssembledOfferProductPicker(): void {
    this.assembledOfferProductPickerOpen.set(false);
  }

  protected selectAssembledOfferProduct(product: Product): void {
    if (this.assembledOfferDraft().components.some((component) => component.productId === product.id)) {
      this.assembledOfferError.set('Ese producto ya esta seleccionado en el codigo armado.');
      return;
    }

    this.assembledOfferDraft.update((draft) => ({
      ...draft,
      components: [
        ...draft.components,
        {
          productId: product.id,
          quantity: '1',
          isGift: false,
        },
      ],
    }));
    this.assembledOfferProductPickerOpen.set(false);
    this.assembledOfferError.set('');
  }

  protected removeAssembledOfferComponent(index: number): void {
    this.assembledOfferDraft.update((draft) => ({
      ...draft,
      components: draft.components.filter((_component, componentIndex) => componentIndex !== index),
    }));
  }

  protected openAssembledOfferDetail(offer: AssembledOffer): void {
    this.resetInventoryAuxTable('components');
    this.selectedAssembledOffer.set(offer);
    this.assembledOfferDetailModalOpen.set(true);
  }

  protected closeAssembledOfferDetail(): void {
    this.selectedAssembledOffer.set(null);
    this.assembledOfferDetailModalOpen.set(false);
  }

  protected async editAssembledOffer(offer: AssembledOffer): Promise<void> {
    this.assembledOfferEditingId.set(offer.id);
    this.assembledOfferDraft.set({
      code: offer.sku,
      name: offer.name,
      description: offer.description || '',
      imageUrl: offer.imageUrl || '',
      salePrice: String(offer.salePrice || ''),
      startsAt: this.toDateTimeLocalInputValue(offer.startsAt),
      endsAt: this.toDateTimeLocalInputValue(offer.endsAt),
      active: Boolean(offer.active),
      components: offer.components.map((component) => ({
        productId: component.productId,
        quantity: String(component.quantity || 1),
        isGift: Boolean(component.isGift),
      })),
    });
    this.assembledOfferError.set('');
    this.assembledOfferModalOpen.set(true);

    if (this.products().length === 0) {
      await this.fetchProducts(false);
    }
  }

  protected assembledOfferStatusClass(offer: AssembledOffer): string {
    return `assembled-offer-status-${String(offer.status || 'INACTIVO').toLowerCase().replace(/\s+/g, '-')}`;
  }

  protected offerComponentMaxOffers(component: AssembledOfferComponent): number {
    const quantity = Number(component.quantity || 0);
    return quantity > 0 ? Math.max(0, Math.floor(Number(component.stock || 0) / quantity)) : 0;
  }

  private toDateTimeLocalInputValue(value: string | null | undefined): string {
    const date = new Date(value || '');

    if (Number.isNaN(date.getTime())) {
      return this.currentDateTimeLocalValue();
    }

    return `${this.formatDateKey(date)}T${this.padDatePart(date.getHours())}:${this.padDatePart(date.getMinutes())}`;
  }

  protected async saveAssembledOffer(): Promise<void> {
    const draft = this.assembledOfferDraft();
    const currentUser = this.currentUser();
    const salePrice = Number(draft.salePrice);
    const components = draft.components.map((component) => ({
      productId: Number(component.productId || 0),
      quantity: Number(component.quantity || 0),
      isGift: Boolean(component.isGift),
    }));

    if (!currentUser) {
      this.assembledOfferError.set('Usuario requerido para guardar codigo armado.');
      return;
    }

    if (!this.assembledOfferEditingId() && !draft.code.trim()) {
      this.assembledOfferError.set('Codigo requerido.');
      return;
    }

    if (!draft.name.trim()) {
      this.assembledOfferError.set('Nombre requerido.');
      return;
    }

    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      this.assembledOfferError.set('Ingresa un precio final valido.');
      return;
    }

    if (components.length < 2 || components.some((component) => component.productId <= 0 || component.quantity <= 0)) {
      this.assembledOfferError.set('Selecciona al menos dos productos con cantidad mayor que cero.');
      return;
    }

    if (new Set(components.map((component) => component.productId)).size < components.length) {
      this.assembledOfferError.set('No dupliques productos dentro del mismo codigo armado.');
      return;
    }

    this.assembledOfferSaving.set(true);
    this.assembledOfferError.set('');

    try {
      const payload = {
        code: draft.code.trim(),
        name: draft.name.trim(),
        description: draft.description.trim(),
        imageUrl: draft.imageUrl.trim(),
        salePrice,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        active: draft.active,
        userId: currentUser.id,
        user: currentUser.nombre || currentUser.usuario,
        components,
      };
      const editingId = this.assembledOfferEditingId();
      const response = editingId
        ? this.desktopApi?.updateAssembledOffer
          ? await this.desktopApi.updateAssembledOffer({ ...payload, offerId: editingId })
          : await firstValueFrom(this.http.put<{ offer: AssembledOffer }>(`/api/assembled-offers/${editingId}`, payload))
        : this.desktopApi?.createAssembledOffer
          ? await this.desktopApi.createAssembledOffer(payload)
          : await firstValueFrom(this.http.post<{ offer: AssembledOffer }>('/api/assembled-offers', payload));

      this.assembledOffers.update((offers) => [response.offer, ...offers.filter((offer) => offer.id !== response.offer.id)]);
      this.assembledOfferModalOpen.set(false);
      this.assembledOfferEditingId.set(null);
      this.showInventorySuccess(`Codigo armado ${response.offer.sku} guardado correctamente.`);
      await this.fetchBillingProducts(true);
    } catch (error) {
      this.assembledOfferError.set(this.extractErrorMessage(error, 'No se pudo guardar el codigo armado.'));
    } finally {
      this.assembledOfferSaving.set(false);
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

  private showInventorySuccess(message: string, variant: 'success' | 'error' = 'success'): void {
    this.inventoryToastVariant.set(variant);
    this.inventorySuccessMessage.set(message);

    if (this.inventorySuccessTimeoutId !== null) {
      clearTimeout(this.inventorySuccessTimeoutId);
    }

    this.inventorySuccessTimeoutId = setTimeout(() => {
      this.inventorySuccessMessage.set('');
      this.inventoryToastVariant.set('success');
      this.inventorySuccessTimeoutId = null;
    }, 3000);
  }

  private showCreditPaymentSuccess(message: string): void {
    this.creditPaymentSuccess.set(message);

    if (this.creditPaymentSuccessTimeoutId !== null) {
      clearTimeout(this.creditPaymentSuccessTimeoutId);
    }

    this.creditPaymentSuccessTimeoutId = setTimeout(() => {
      this.creditPaymentSuccess.set('');
      this.creditPaymentSuccessTimeoutId = null;
    }, 3600);
  }

  private showPettyCashToast(message: string, variant: 'success' | 'error' = 'success'): void {
    this.pettyCashToastVariant.set(variant);
    this.pettyCashToastMessage.set(message);

    if (this.pettyCashToastTimeoutId !== null) {
      clearTimeout(this.pettyCashToastTimeoutId);
    }

    this.pettyCashToastTimeoutId = setTimeout(() => {
      this.pettyCashToastMessage.set('');
      this.pettyCashToastVariant.set('success');
      this.pettyCashToastTimeoutId = null;
    }, 3000);
  }

  private showPayrollToast(message: string, variant: 'success' | 'error' = 'success'): void {
    this.payrollToastVariant.set(variant);
    this.payrollToastMessage.set(message);

    if (this.payrollToastTimeoutId !== null) {
      clearTimeout(this.payrollToastTimeoutId);
    }

    this.payrollToastTimeoutId = setTimeout(() => {
      this.payrollToastMessage.set('');
      this.payrollToastVariant.set('success');
      this.payrollToastTimeoutId = null;
    }, 3200);
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
    this.closeInventoryTransientModals();
    this.activePage.set(page);

    if (persist) {
      this.saveActivePage(page);
    }

    if (page === 'attendance' || page === 'payroll') {
      this.selectLatestPayrollWeekWithData();
    }

    this.loadPageData(page);
    this.scheduleVisibleChartsRefresh();
  }

  private closeInventoryTransientModals(): void {
    this.inactiveProductsPanelOpen.set(false);
    this.productBarcodeModalOpen.set(false);
    this.productBarcodeTarget.set(null);
    this.productBarcodeDraft.set('');
    this.productBarcodeError.set('');
    this.productReactivationModalOpen.set(false);
    this.productReactivationConfirmOpen.set(false);
    this.selectedInactiveProduct.set(null);
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
      this.activeMode.set('sale');
      this.supplierModalOpen.set(false);
      void this.fetchBillingProducts();
      void this.loadExpiringProducts();
      void this.loadSalesDropAlert();
      void this.loadNextInvoiceNumber();
      void this.loadTodayInvoices();
      this.scheduleBillingSearchFocus();
      return;
    }

    if (page === 'invoices') {
      void this.loadInvoicesPageData();
      void this.loadDashboardSalesTrend();
      return;
    }

    if (page === 'purchases') {
      this.loadPurchaseWorkspace();
      void this.fetchProducts();
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
      void this.fetchProducts(false);
      void this.loadCostAnalysisData();
      return;
    }

    if (page === 'petty-cash') {
      void this.loadPettyCashData();
      return;
    }

    if (page === 'financial-movements') {
      void this.loadFinancialMovements();
      return;
    }

    if (page === 'sales-profitability') {
      void this.loadDashboardSalesTrend();
      if (!this.salesProfitabilityAnalytics()) {
        void this.loadSalesProfitabilityAnalytics();
      }
      return;
    }

    if (page === 'system-health') {
      void this.loadSystemHealth();
      return;
    }

    if (page === 'inventory-sheet' || page === 'inventory-out-of-stock') {
      void this.fetchProducts(false);
      return;
    }

    if (page === 'history') {
      void this.loadAuditHistory();
      return;
    }

    if (page === 'attendance' || page === 'payroll' || page === 'payroll-generate') {
      void this.loadAttendanceUsers().then(() => {
        if (page === 'attendance' || page === 'payroll') {
          this.selectLatestPayrollWeekWithData();
          this.scheduleVisibleChartsRefresh();
        }
      });
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
    const currentPayrollWeek = this.currentPayrollWeekInfo().week;

    if (currentPayrollWeek > 0) {
      availableWeeks.add(currentPayrollWeek);
    }

    for (const user of users) {
      for (const record of user.history) {
        if (record.weekNumber > 0) {
          availableWeeks.add(record.weekNumber);
        }
      }
    }

    for (const record of this.payrollDatabaseRecords()) {
      if (record.weekNumber > 0) {
        availableWeeks.add(record.weekNumber);
      }
    }

    for (const sourceWeek of imagePayrollWeeks) {
      if (sourceWeek.weekNumber > 0) {
        availableWeeks.add(sourceWeek.weekNumber);
      }
    }

    const sortedWeeks = [...availableWeeks].sort((a, b) => b - a);
    const currentSelectedWeek = this.selectedAttendanceWeek();
    const latestWeekWithData = this.latestPayrollWeekWithData(users);

    if (sortedWeeks.length === 0) {
      this.selectedAttendanceWeek.set(null);
    } else if (latestWeekWithData && (currentSelectedWeek === null || !availableWeeks.has(currentSelectedWeek))) {
      this.selectedAttendanceWeek.set(latestWeekWithData);
    } else if (currentSelectedWeek === null || !availableWeeks.has(currentSelectedWeek)) {
      this.selectedAttendanceWeek.set(sortedWeeks[0]);
    }
    this.payrollBonuses.set(this.buildPayrollBonusesState(users, sortedWeeks));
    this.payrollSchedules.set(this.buildPayrollScheduleState(users));
    this.restoreGeneratedPayrollHoursForWeek(this.selectedAttendanceWeek(), users);
  }

  private latestPayrollWeekWithData(users: AttendanceUser[] = this.attendanceUsers()): number | null {
    const weeks = new Set<number>();

    for (const user of users) {
      for (const record of user.history) {
        if (record.weekNumber > 0 && record.workedHours > 0) {
          weeks.add(record.weekNumber);
        }
      }
    }

    for (const record of this.payrollDatabaseRecords()) {
      const hasPayrollValue =
        record.totalHours > 0 ||
        record.salary > 0 ||
        record.bonus > 0 ||
        record.total > 0 ||
        record.normalHours > 0 ||
        record.extra1Hours > 0 ||
        record.extra2Hours > 0 ||
        record.extra3Hours > 0;

      if (record.weekNumber > 0 && hasPayrollValue) {
        weeks.add(record.weekNumber);
      }
    }

    return weeks.size ? Math.max(...weeks) : null;
  }

  private selectLatestPayrollWeekWithData(): void {
    const latestWeek = this.latestPayrollWeekWithData();

    if (!latestWeek || this.selectedAttendanceWeek() === latestWeek) {
      return;
    }

    this.selectedAttendanceWeek.set(latestWeek);
    this.selectedPayrollMonth.set('');
    this.restoreGeneratedPayrollHoursForWeek(latestWeek);
  }

  private buildPayrollScheduleState(users: AttendanceUser[]): PayrollScheduleMatrix {
    const persistedSchedules = this.readPayrollSchedulesFromStorage();
    const nextSchedules: PayrollScheduleMatrix = {};

    for (const user of users) {
      nextSchedules[user.id] = this.buildPayrollScheduleWeek(persistedSchedules[user.id]);
    }

    return nextSchedules;
  }

  private buildPayrollScheduleWeek(existing?: PayrollScheduleMatrix[number]): PayrollScheduleMatrix[number] {
    return {
      sunday: this.buildPayrollScheduleDay(existing?.sunday, false),
      monday: this.buildPayrollScheduleDay(existing?.monday, true),
      tuesday: this.buildPayrollScheduleDay(existing?.tuesday, true),
      wednesday: this.buildPayrollScheduleDay(existing?.wednesday, true),
      thursday: this.buildPayrollScheduleDay(existing?.thursday, true),
      friday: this.buildPayrollScheduleDay(existing?.friday, true),
      saturday: this.buildPayrollScheduleDay(existing?.saturday, false, '08:00', '12:00'),
    };
  }

  private buildPayrollScheduleDay(
    existing: Partial<PayrollScheduleDay> | undefined,
    enabled: boolean,
    entryTime = '08:00',
    exitTime = '17:00',
  ): PayrollScheduleDay {
    return {
      enabled: Boolean(existing?.enabled ?? enabled),
      entryTime: this.isValidTimeValue(existing?.entryTime) ? String(existing?.entryTime) : entryTime,
      exitTime: this.isValidTimeValue(existing?.exitTime) ? String(existing?.exitTime) : exitTime,
    };
  }

  private buildPayrollWeekRow(existing?: PayrollHoursMatrix[number]): PayrollHoursMatrix[number] {
    return {
      sunday: this.buildPayrollShiftRow(existing?.sunday),
      monday: this.buildPayrollShiftRow(existing?.monday),
      tuesday: this.buildPayrollShiftRow(existing?.tuesday),
      wednesday: this.buildPayrollShiftRow(existing?.wednesday),
      thursday: this.buildPayrollShiftRow(existing?.thursday),
      friday: this.buildPayrollShiftRow(existing?.friday),
      saturday: this.buildPayrollShiftRow(existing?.saturday),
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
    const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const year = value.getUTCFullYear();
    const firstWeekStart = this.firstSundayWeekStart(year);
    const week = Math.floor((value.getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;

    return { year, week: Math.max(1, week) };
  }

  private currentPayrollWeekInfo(): { year: number; week: number } {
    const today = new Date();
    const payrollDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

    return this.getAttendanceWeekInfo(payrollDate);
  }

  private firstSundayWeekStart(year: number): Date {
    const firstDay = new Date(Date.UTC(year, 0, 1));
    firstDay.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay());
    return firstDay;
  }

  private weekStartDate(year: number, week: number): Date {
    const startDate = this.firstSundayWeekStart(year);
    startDate.setUTCDate(startDate.getUTCDate() + (Math.max(week, 1) - 1) * 7);
    return startDate;
  }

  private payrollRecordDate(record: PayrollDatabaseRecord): Date {
    const match = String(record.day || '').match(/(\d{4}-\d{2}-\d{2})/);

    if (match) {
      return new Date(`${match[1]}T00:00:00Z`);
    }

    return this.weekStartDate(2026, record.weekNumber);
  }

  private buildPayrollUserGroupsFromDatabase(): PayrollUserLine[] {
    const recordsByUser = new Map<number, PayrollDatabaseRecord[]>();

    for (const record of this.payrollDatabaseRecords()) {
      if (!record.userId || !record.weekNumber) {
        continue;
      }

      const records = recordsByUser.get(record.userId) || [];
      records.push(record);
      recordsByUser.set(record.userId, records);
    }

    return [...recordsByUser.entries()]
      .map(([userId, userRecords]) => {
        const firstRecord = userRecords[0];
        const existingUser = this.attendanceUsers().find((user) => user.id === userId);
        const user: AttendanceUser =
          existingUser ||
          ({
            id: userId,
            name: firstRecord.userName,
            username: firstRecord.userLogin,
            role: firstRecord.userRole,
            area: firstRecord.userRole || 'Planilla',
            hourlyRate: payrollNormalRate,
            date: null,
            entryTime: '',
            exitTime: '',
            attendanceStatus: 'Sin registro',
            workedHours: 0,
            weeklyHours: 0,
            attendanceDays: 0,
            history: [],
          } as AttendanceUser);
        const recordsByWeek = new Map<number, PayrollDatabaseRecord[]>();

        for (const record of userRecords) {
          const records = recordsByWeek.get(record.weekNumber) || [];
          records.push(record);
          recordsByWeek.set(record.weekNumber, records);
        }

        const weeks = [...recordsByWeek.entries()]
          .map(([weekNumber, weekRecords]) => {
            const orderedRecords = [...weekRecords].sort(
              (a, b) => this.payrollRecordDate(a).getTime() - this.payrollRecordDate(b).getTime(),
            );
            const firstWeekRecord = orderedRecords[0];
            const startDate = this.payrollRecordDate(firstWeekRecord);
            const endDate = this.payrollRecordDate(orderedRecords[orderedRecords.length - 1]);
            const days = orderedRecords.map((record) => ({
              id: String(record.id),
              date: this.payrollRecordDate(record),
              weekNumber,
              dayName: String(record.day || '').replace(/\s+\d{4}-\d{2}-\d{2}.*/, '') || 'Dia',
              entryTime: '',
              exitTime: '',
              normalHours: record.normalHours,
              extra1Hours: record.extra1Hours,
              extra2Hours: record.extra2Hours,
              extra3Hours: record.extra3Hours,
              normalPay: Number((record.normalHours * payrollNormalRate).toFixed(2)),
              extra1Pay: Number((record.extra1Hours * payrollExtra1Rate).toFixed(2)),
              extra2Pay: Number((record.extra2Hours * payrollExtra3WeekdayRate).toFixed(2)),
              extra3Pay: Number((record.extra3Hours * payrollExtra3WeekendRate).toFixed(2)),
              totalHours: Number((record.normalHours + record.extra1Hours + record.extra2Hours + record.extra3Hours).toFixed(2)),
              totalPay: Number((
                record.normalHours * payrollNormalRate +
                record.extra1Hours * payrollExtra1Rate +
                record.extra2Hours * payrollExtra3WeekdayRate +
                record.extra3Hours * payrollExtra3WeekendRate
              ).toFixed(2)),
            }));
            const summaryRecord = orderedRecords.find((record) => record.totalHours || record.salary || record.total) || firstWeekRecord;
            const subtotalPay = Number((summaryRecord?.salary || 0).toFixed(2));
            const bonus = Number((summaryRecord?.bonus || 0).toFixed(2));
            const grandTotal = Number((summaryRecord?.total || subtotalPay + bonus).toFixed(2));
            const totalHours = Number((summaryRecord?.totalHours || days.reduce((total, day) => total + day.totalHours, 0)).toFixed(2));

            return {
              key: `${userId}-${weekNumber}`,
              weekNumber,
              label: `Semana ${weekNumber} (${this.payrollWeekRangeLabel(2026, weekNumber)})`,
              days,
              subtotalPay,
              bonus,
              grandTotal,
              totalHours,
            };
          })
          .sort((a, b) => b.weekNumber - a.weekNumber);
        const accumulatedSubtotal = Number(weeks.reduce((total, week) => total + week.subtotalPay, 0).toFixed(2));
        const accumulatedBonus = Number(weeks.reduce((total, week) => total + week.bonus, 0).toFixed(2));

        return {
          user,
          weeks,
          accumulatedSubtotal,
          accumulatedBonus,
          accumulatedTotal: Number((accumulatedSubtotal + accumulatedBonus).toFixed(2)),
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  protected selectedAttendanceWeekRangeLabel(): string {
    const week = this.selectedAttendanceWeek() || this.currentPayrollWeekInfo().week;
    const year = this.payrollDatabaseRecords().length > 0 ? 2026 : this.currentPayrollWeekInfo().year;

    return this.payrollWeekRangeLabel(year, week);
  }

  private payrollWeekRangeLabel(year: number, week: number): string {
    const startDate = this.weekStartDate(year, week);
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);

    return `${this.formatAttendanceDate(startDate)} - ${this.formatAttendanceDate(endDate)}`;
  }

  private sameUtcDate(firstDate: Date, secondDate: Date): boolean {
    return (
      firstDate.getUTCFullYear() === secondDate.getUTCFullYear() &&
      firstDate.getUTCMonth() === secondDate.getUTCMonth() &&
      firstDate.getUTCDate() === secondDate.getUTCDate()
    );
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
    const rawValue = (event.target as HTMLSelectElement).value;
    const value = Number(rawValue);
    if (!rawValue) {
      this.selectedPayrollMonth.set('');
    }
    this.setAttendanceWeek(Number.isFinite(value) && value > 0 ? value : null);
  }

  protected setAttendanceWeek(week: number | null): void {
    const nextWeek = week && week > 0 ? week : null;
    this.selectedAttendanceWeek.set(nextWeek);
    if (nextWeek !== null) {
      this.selectedPayrollMonth.set('');
    }
    this.restoreGeneratedPayrollHoursForWeek(nextWeek);
  }

  protected updatePayrollMonth(event: Event): void {
    const value = (event.target as HTMLSelectElement).value || '';
    this.selectedPayrollMonth.set(value);

    if (value) {
      this.selectedAttendanceWeek.set(null);
      this.restoreGeneratedPayrollHoursForWeek(null);
    }
  }

  protected selectedAttendanceWeekLabel(): string {
    const week = this.selectedAttendanceWeek();
    return week ? `Semana ${week} (${this.selectedAttendanceWeekRangeLabel()})` : 'Sin semana';
  }

  private formatPayrollMonthLabel(monthKey: string): string {
    const [yearText, monthText] = monthKey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return 'Mes no valido';
    }

    return new Intl.DateTimeFormat('es-HN', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));
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
        recordedById: currentUser.id,
      };
      const response = this.desktopApi?.saveAttendanceMark
        ? await this.desktopApi.saveAttendanceMark(payload)
        : await firstValueFrom(this.http.post<AttendanceMarkResponse>('/api/attendance/mark', payload));

      await this.loadAttendanceUsers(true);
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
      timeZone: 'UTC',
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

  protected isPayrollMonthExpanded(monthKey: string): boolean {
    return this.payrollExpandedMonthKeys().includes(monthKey);
  }

  protected togglePayrollMonth(monthKey: string): void {
    this.payrollExpandedMonthKeys.update((keys) =>
      keys.includes(monthKey) ? keys.filter((key) => key !== monthKey) : [...keys, monthKey],
    );
  }

  protected payrollMonthsForUser(group: PayrollUserLine): PayrollMonthLine[] {
    const monthsByKey = new Map<string, PayrollMonthLine>();

    for (const week of group.weeks) {
      const firstDay = week.days[0]?.date || this.weekStartDate(this.currentPayrollWeekInfo().year, week.weekNumber);
      const year = firstDay.getUTCFullYear();
      const month = firstDay.getUTCMonth();
      const key = `${group.user.id}-${year}-${String(month + 1).padStart(2, '0')}`;
      const existingMonth = monthsByKey.get(key);

      if (existingMonth) {
        existingMonth.weeks.push(week);
        existingMonth.subtotalPay = Number((existingMonth.subtotalPay + week.subtotalPay).toFixed(2));
        existingMonth.bonus = Number((existingMonth.bonus + week.bonus).toFixed(2));
        existingMonth.grandTotal = Number((existingMonth.grandTotal + week.grandTotal).toFixed(2));
        existingMonth.totalHours = Number((existingMonth.totalHours + week.totalHours).toFixed(2));
        continue;
      }

      monthsByKey.set(key, {
        key,
        label: this.capitalizeSentence(new Intl.DateTimeFormat('es-HN', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(firstDay)),
        weeks: [week],
        subtotalPay: Number(week.subtotalPay.toFixed(2)),
        bonus: Number(week.bonus.toFixed(2)),
        grandTotal: Number(week.grandTotal.toFixed(2)),
        totalHours: Number(week.totalHours.toFixed(2)),
        sortValue: year * 100 + month,
      });
    }

    return [...monthsByKey.values()]
      .map((month) => ({
        ...month,
        weeks: [...month.weeks].sort((a, b) => b.weekNumber - a.weekNumber),
      }))
      .sort((a, b) => b.sortValue - a.sortValue);
  }

  protected openPayrollScheduleModal(): void {
    this.payrollSchedules.update((schedules) => {
      const nextSchedules = { ...schedules };

      for (const user of this.attendanceUsers()) {
        nextSchedules[user.id] = this.buildPayrollScheduleWeek(nextSchedules[user.id]);
      }

      return nextSchedules;
    });
    this.payrollScheduleModalOpen.set(true);
  }

  protected closePayrollScheduleModal(): void {
    this.payrollScheduleModalOpen.set(false);
  }

  protected openPayrollHoursModal(): void {
    this.payrollHoursModalOpen.set(true);
  }

  protected closePayrollHoursModal(): void {
    this.payrollHoursModalOpen.set(false);
  }

  protected openPayrollImageModal(): void {
    this.selectedAttendanceWeek.set(this.nextPayrollWeekToGenerate());
    const sourceWeek = this.selectedImagePayrollSourceWeek();

    if (sourceWeek) {
      this.seedEditableImagePayrollRows(sourceWeek);
    }

    this.payrollImageExpandedRowKeys.set([]);
    this.payrollImageExpandedWeekKeys.set([]);
    this.payrollImageModalOpen.set(true);
  }

  protected closePayrollImageModal(): void {
    this.payrollImageModalOpen.set(false);
  }

  protected payrollImageRowKey(line: PayrollWeekMatrixLine, index: number): string {
    return `${line.user?.id || line.employeeName}-${index}`;
  }

  protected payrollImageWeekKey(line: PayrollWeekMatrixLine, index: number, weekNumber: number): string {
    return `${this.payrollImageRowKey(line, index)}-${weekNumber}`;
  }

  protected isPayrollImageRowExpanded(line: PayrollWeekMatrixLine, index: number): boolean {
    return this.payrollImageExpandedRowKeys().includes(this.payrollImageRowKey(line, index));
  }

  protected togglePayrollImageRow(line: PayrollWeekMatrixLine, index: number): void {
    const key = this.payrollImageRowKey(line, index);
    this.payrollImageExpandedRowKeys.update((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    );
  }

  protected isPayrollImageWeekExpanded(line: PayrollWeekMatrixLine, index: number, weekNumber: number): boolean {
    return this.payrollImageExpandedWeekKeys().includes(this.payrollImageWeekKey(line, index, weekNumber));
  }

  protected togglePayrollImageWeek(line: PayrollWeekMatrixLine, index: number, weekNumber: number): void {
    const key = this.payrollImageWeekKey(line, index, weekNumber);
    this.payrollImageExpandedWeekKeys.update((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    );
  }

  protected updateEditableImagePayrollHours(
    employeeName: string,
    dayId: PayrollDayId,
    field: 'normal' | 'extra1' | 'extra2' | 'extra3',
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.editableImagePayrollRows.update((rows) => {
      const sourceWeek = this.selectedImagePayrollSourceWeek();
      const sourceRow = sourceWeek?.rows.find((row) => row.name === employeeName);
      const currentDays = rows[employeeName] || sourceRow?.days;

      if (!currentDays) {
        return rows;
      }

      const nextDays = this.cloneImagePayrollDays(currentDays);

      nextDays[dayId] = {
        ...nextDays[dayId],
        [field]: Number(value.toFixed(2)),
      };

      return {
        ...rows,
        [employeeName]: nextDays,
      };
    });
  }

  protected updateEditableImagePayrollBonus(employeeName: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.editableImagePayrollBonuses.update((bonuses) => ({
      ...bonuses,
      [employeeName]: Number(value.toFixed(2)),
    }));
  }

  protected imagePayrollDayPay(day: PayrollWeekMatrixLine['days'][number]): number {
    return Number((
      day.normalHours * payrollNormalRate +
      day.extra1Hours * payrollExtra1Rate +
      day.extra2Hours * payrollExtra3WeekdayRate +
      day.extra3Hours * payrollExtra3WeekendRate
    ).toFixed(2));
  }

  protected openPayrollPlanWeekSelectorModal(): void {
    const options = this.payrollPlanEditWeekOptions();
    this.selectedPayrollPlanEditWeek.set(options[0]?.weekNumber || null);
    this.payrollPlanEditError.set('');
    this.payrollPlanWeekSelectorModalOpen.set(true);
  }

  protected closePayrollPlanWeekSelectorModal(): void {
    this.payrollPlanWeekSelectorModalOpen.set(false);
  }

  protected updateSelectedPayrollPlanEditWeek(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.selectedPayrollPlanEditWeek.set(Number.isFinite(value) && value > 0 ? value : null);
  }

  protected openSelectedPayrollPlanEditModal(): void {
    const selectedWeek = this.selectedPayrollPlanEditWeek();

    if (!selectedWeek) {
      this.payrollPlanEditError.set('Selecciona una semana para modificar.');
      return;
    }

    this.openPayrollPlanEditModal(selectedWeek);
  }

  protected openPayrollPlanEditModal(weekNumber: number): void {
    const draft = this.buildPayrollPlanEditDraft(weekNumber);

    if (!draft || draft.employees.length === 0) {
      this.payrollPlanEditError.set('La semana seleccionada no tiene planilla registrada.');
      return;
    }

    this.payrollPlanEditDraft.set(draft);
    this.payrollPlanEditError.set('');
    this.payrollPlanWeekSelectorModalOpen.set(false);
    this.payrollPlanEditModalOpen.set(true);
  }

  protected closePayrollPlanEditModal(): void {
    if (this.payrollPlanEditSaving()) {
      return;
    }

    this.payrollPlanEditModalOpen.set(false);
    this.payrollPlanEditDraft.set(null);
    this.payrollPlanEditError.set('');
  }

  protected payrollPlanEditWeekOptions(): PayrollPlanEditWeekOption[] {
    const weeksByNumber = new Map<number, PayrollPlanEditWeekOption>();

    for (const group of this.payrollUserGroups()) {
      for (const week of group.weeks) {
        const current = weeksByNumber.get(week.weekNumber);

        if (current) {
          current.employeeCount += 1;
          current.totalHours = Number((current.totalHours + week.totalHours).toFixed(2));
          current.salary = Number((current.salary + week.subtotalPay).toFixed(2));
          current.bonus = Number((current.bonus + week.bonus).toFixed(2));
          current.total = Number((current.total + week.grandTotal).toFixed(2));
          continue;
        }

        weeksByNumber.set(week.weekNumber, {
          weekNumber: week.weekNumber,
          label: week.label,
          employeeCount: 1,
          totalHours: Number(week.totalHours.toFixed(2)),
          salary: Number(week.subtotalPay.toFixed(2)),
          bonus: Number(week.bonus.toFixed(2)),
          total: Number(week.grandTotal.toFixed(2)),
        });
      }
    }

    return [...weeksByNumber.values()].sort((a, b) => b.weekNumber - a.weekNumber);
  }

  protected selectedPayrollPlanEditWeekOption(): PayrollPlanEditWeekOption | null {
    const selectedWeek = this.selectedPayrollPlanEditWeek();

    return this.payrollPlanEditWeekOptions().find((week) => week.weekNumber === selectedWeek) || null;
  }

  private buildPayrollPlanEditDraft(weekNumber: number): PayrollPlanEditDraft | null {
    const employees = this.payrollUserGroups()
      .map((group) => {
        const week = group.weeks.find((item) => item.weekNumber === weekNumber);

        if (!week) {
          return null;
        }

        return {
          userId: group.user.id,
          userName: group.user.name,
          userRole: group.user.role || group.user.area,
          weekNumber: week.weekNumber,
          weekLabel: week.label,
          bonus: Number((week.bonus || 0).toFixed(2)),
          days: week.days.map((day) => ({
            id: `${group.user.id}-${day.id}`,
            date: day.date.toISOString().slice(0, 10),
            dayName: day.dayName,
            normalHours: Number((day.normalHours || 0).toFixed(2)),
            extra1Hours: Number((day.extra1Hours || 0).toFixed(2)),
            extra2Hours: Number((day.extra2Hours || 0).toFixed(2)),
            extra3Hours: Number((day.extra3Hours || 0).toFixed(2)),
          })),
        };
      })
      .filter((employee): employee is PayrollPlanEditEmployee => Boolean(employee))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    if (employees.length === 0) {
      return null;
    }

    return {
      weekNumber,
      weekLabel: employees[0].weekLabel,
      employees,
    };
  }

  protected updatePayrollPlanEditHours(
    userId: number,
    dayId: string,
    field: 'normalHours' | 'extra1Hours' | 'extra2Hours' | 'extra3Hours',
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollPlanEditDraft.update((draft) => {
      if (!draft) {
        return draft;
      }

      return {
        ...draft,
        employees: draft.employees.map((employee) =>
          employee.userId === userId
            ? {
                ...employee,
                days: employee.days.map((day) =>
                  day.id === dayId
                    ? {
                        ...day,
                        [field]: Number(value.toFixed(2)),
                      }
                    : day,
                ),
              }
            : employee,
        ),
      };
    });
  }

  protected updatePayrollPlanEditBonus(userId: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollPlanEditDraft.update((draft) =>
      draft
        ? {
            ...draft,
            employees: draft.employees.map((employee) =>
              employee.userId === userId
                ? {
                    ...employee,
                    bonus: Number(value.toFixed(2)),
                  }
                : employee,
            ),
          }
        : draft,
    );
  }

  protected payrollPlanEditEmployeeTotals(employee: PayrollPlanEditEmployee): PayrollWeekEditTotals {
    return this.calculatePayrollEditTotals(employee.days, employee.bonus);
  }

  private calculatePayrollEditTotals(days: PayrollWeekEditDraftDay[], bonus: number): PayrollWeekEditTotals {
    const normalHours = Number(days.reduce((total, day) => total + day.normalHours, 0).toFixed(2));
    const extra1Hours = Number(days.reduce((total, day) => total + day.extra1Hours, 0).toFixed(2));
    const extra2Hours = Number(days.reduce((total, day) => total + day.extra2Hours, 0).toFixed(2));
    const extra3Hours = Number(days.reduce((total, day) => total + day.extra3Hours, 0).toFixed(2));
    const normalPay = Number((normalHours * payrollNormalRate).toFixed(2));
    const extra1Pay = Number((extra1Hours * payrollExtra1Rate).toFixed(2));
    const extra2Pay = Number((extra2Hours * payrollExtra3WeekdayRate).toFixed(2));
    const extra3Pay = Number((extra3Hours * payrollExtra3WeekendRate).toFixed(2));
    const salary = Number((normalPay + extra1Pay + extra2Pay + extra3Pay).toFixed(2));
    const normalizedBonus = Number((bonus || 0).toFixed(2));

    return {
      normalHours,
      extra1Hours,
      extra2Hours,
      extra3Hours,
      totalHours: Number((normalHours + extra1Hours + extra2Hours + extra3Hours).toFixed(2)),
      normalPay,
      extra1Pay,
      extra2Pay,
      extra3Pay,
      salary,
      bonus: normalizedBonus,
      total: Number((salary + normalizedBonus).toFixed(2)),
    };
  }

  protected async savePayrollPlanEdit(): Promise<void> {
    const draft = this.payrollPlanEditDraft();
    const currentUser = this.currentUser();

    if (!draft) {
      return;
    }

    if (!currentUser) {
      const message = 'Debes iniciar sesion para modificar la planilla.';
      this.payrollPlanEditError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const rows = draft.employees.flatMap((employee) => {
      const totals = this.payrollPlanEditEmployeeTotals(employee);

      return employee.days.map((day) => ({
        userId: employee.userId,
        day: `${day.dayName} ${day.date}`,
        normalHours: day.normalHours,
        extra1Hours: day.extra1Hours,
        extra2Hours: day.extra2Hours,
        extra3Hours: day.extra3Hours,
        normalPay: totals.normalPay,
        extra1Pay: totals.extra1Pay,
        extra2Pay: totals.extra2Pay,
        extra3Pay: totals.extra3Pay,
        totalHours: totals.totalHours,
        salary: totals.salary,
        bonus: totals.bonus,
        total: totals.total,
      }));
    });

    if (rows.length === 0) {
      const message = 'No hay registros para guardar en la planilla seleccionada.';
      this.payrollPlanEditError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    this.payrollPlanEditSaving.set(true);
    this.payrollPlanEditError.set('');

    try {
      const response = this.desktopApi?.savePayrollWeek
        ? await this.desktopApi.savePayrollWeek({
            weekNumber: draft.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          })
        : await firstValueFrom(this.http.post<{ inserted: number; attendanceSynced?: number }>('/api/payroll/week', {
            weekNumber: draft.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          }));
      const message = `Planilla semana ${draft.weekNumber} actualizada: ${response.inserted} registros guardados.`;

      this.payrollSaveMessage.set(message);
      this.showPayrollToast(message);
      this.payrollPlanEditModalOpen.set(false);
      this.payrollPlanEditDraft.set(null);
      await this.refreshPayrollAfterWeekSave(draft.weekNumber);
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo actualizar la planilla seleccionada.');
      this.payrollPlanEditError.set(message);
      this.showPayrollToast(message, 'error');
    } finally {
      this.payrollPlanEditSaving.set(false);
    }
  }

  protected openPayrollWeekEditModal(user: AttendanceUser, week: PayrollWeekLine): void {
    this.payrollWeekEditDraft.set({
      userId: user.id,
      userName: user.name,
      weekNumber: week.weekNumber,
      weekLabel: week.label,
      bonus: Number((week.bonus || 0).toFixed(2)),
      days: week.days.map((day) => ({
        id: day.id,
        date: day.date.toISOString().slice(0, 10),
        dayName: day.dayName,
        normalHours: Number((day.normalHours || 0).toFixed(2)),
        extra1Hours: Number((day.extra1Hours || 0).toFixed(2)),
        extra2Hours: Number((day.extra2Hours || 0).toFixed(2)),
        extra3Hours: Number((day.extra3Hours || 0).toFixed(2)),
      })),
    });
    this.payrollWeekEditError.set('');
    this.payrollWeekEditModalOpen.set(true);
  }

  protected closePayrollWeekEditModal(): void {
    if (this.payrollWeekEditSaving()) {
      return;
    }

    this.payrollWeekEditModalOpen.set(false);
    this.payrollWeekEditDraft.set(null);
    this.payrollWeekEditError.set('');
  }

  protected updatePayrollWeekEditHours(
    dayId: string,
    field: 'normalHours' | 'extra1Hours' | 'extra2Hours' | 'extra3Hours',
    event: Event,
  ): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollWeekEditDraft.update((draft) => {
      if (!draft) {
        return draft;
      }

      return {
        ...draft,
        days: draft.days.map((day) =>
          day.id === dayId
            ? {
                ...day,
                [field]: Number(value.toFixed(2)),
              }
            : day,
        ),
      };
    });
  }

  protected updatePayrollWeekEditBonus(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    this.payrollWeekEditDraft.update((draft) =>
      draft
        ? {
            ...draft,
            bonus: Number(value.toFixed(2)),
          }
        : draft,
    );
  }

  protected payrollWeekEditDayTotal(day: PayrollWeekEditDraftDay): number {
    return Number((
      day.normalHours * payrollNormalRate +
      day.extra1Hours * payrollExtra1Rate +
      day.extra2Hours * payrollExtra3WeekdayRate +
      day.extra3Hours * payrollExtra3WeekendRate
    ).toFixed(2));
  }

  protected async savePayrollWeekEdit(): Promise<void> {
    const draft = this.payrollWeekEditDraft();
    const currentUser = this.currentUser();

    if (!draft) {
      return;
    }

    if (!currentUser) {
      const message = 'Debes iniciar sesion para modificar una semana de planilla.';
      this.payrollWeekEditError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    if (!draft.days.length) {
      const message = 'La semana seleccionada no tiene dias para modificar.';
      this.payrollWeekEditError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const totals = this.payrollWeekEditTotals();
    const rows = draft.days.map((day) => ({
      userId: draft.userId,
      day: `${day.dayName} ${day.date}`,
      normalHours: day.normalHours,
      extra1Hours: day.extra1Hours,
      extra2Hours: day.extra2Hours,
      extra3Hours: day.extra3Hours,
      normalPay: totals.normalPay,
      extra1Pay: totals.extra1Pay,
      extra2Pay: totals.extra2Pay,
      extra3Pay: totals.extra3Pay,
      totalHours: totals.totalHours,
      salary: totals.salary,
      bonus: totals.bonus,
      total: totals.total,
    }));

    this.payrollWeekEditSaving.set(true);
    this.payrollWeekEditError.set('');

    try {
      const response = this.desktopApi?.savePayrollWeek
        ? await this.desktopApi.savePayrollWeek({
            weekNumber: draft.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          })
        : await firstValueFrom(this.http.post<{ inserted: number; attendanceSynced?: number }>('/api/payroll/week', {
            weekNumber: draft.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          }));
      const message = `Semana ${draft.weekNumber} actualizada para ${draft.userName}. ${response.inserted} registros guardados.`;

      this.payrollSaveMessage.set(message);
      this.showPayrollToast(message);
      this.payrollWeekEditModalOpen.set(false);
      this.payrollWeekEditDraft.set(null);
      await this.refreshPayrollAfterWeekSave(draft.weekNumber);
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo actualizar la semana de planilla.');
      this.payrollWeekEditError.set(message);
      this.showPayrollToast(message, 'error');
    } finally {
      this.payrollWeekEditSaving.set(false);
    }
  }

  protected imagePayrollWeekHours(payrollWeek: ImagePayrollWeekCard): number {
    return Number(payrollWeek.matrixRows.reduce((total, line) => total + line.totalHours, 0).toFixed(2));
  }

  protected imagePayrollWeekSalary(payrollWeek: ImagePayrollWeekCard): number {
    return Number(payrollWeek.matrixRows.reduce((total, line) => total + line.salary, 0).toFixed(2));
  }

  protected imagePayrollWeekBonus(payrollWeek: ImagePayrollWeekCard): number {
    return Number(payrollWeek.matrixRows.reduce((total, line) => total + line.bonus, 0).toFixed(2));
  }

  protected updatePayrollScheduleEnabled(userId: number, dayId: PayrollDayId, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updatePayrollScheduleDay(userId, dayId, { enabled: checked });
  }

  protected updatePayrollScheduleTime(
    userId: number,
    dayId: PayrollDayId,
    field: 'entryTime' | 'exitTime',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;

    if (!this.isValidTimeValue(value)) {
      return;
    }

    this.updatePayrollScheduleDay(userId, dayId, { [field]: value });
  }

  protected calculatePayrollFromSchedules(): void {
    const nextMatrix: PayrollHoursMatrix = {};

    for (const user of this.attendanceUsers()) {
      const scheduleWeek = this.buildPayrollScheduleWeek(this.payrollSchedules()[user.id]);
      const weekRow = this.buildPayrollWeekRow();

      for (const day of this.payrollDays) {
        weekRow[day.id] = this.calculateGeneratedShiftHours(scheduleWeek[day.id]);
      }

      nextMatrix[user.id] = weekRow;
    }

    this.payrollHours.set(nextMatrix);
    this.payrollScheduleModalOpen.set(false);
  }

  protected async generatePayrollFromModal(): Promise<void> {
    const currentUser = this.currentUser();
    const payrollWeek = this.editableImagePayrollWeekCard();

    if (!currentUser) {
      const message = 'No hay un usuario autenticado para registrar planilla.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    if (!payrollWeek) {
      const message = 'No hay una semana base de planilla para registrar.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const missingUsers = payrollWeek.matrixRows
      .filter((row) => !row.user && row.total > 0)
      .map((row) => row.employeeName);

    if (missingUsers.length > 0) {
      const message = `No se encontraron estos empleados en dbo.usuario: ${missingUsers.join(', ')}.`;
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const rows = this.buildPayrollSaveRowsFromImageWeek(payrollWeek);

    if (rows.length === 0) {
      const message = 'No hay filas validas para guardar la planilla.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    this.payrollSaving.set(true);
    this.payrollSaveError.set('');
    this.payrollSaveMessage.set('');

    let response!: { inserted: number; attendanceSynced?: number };

    try {
      response = this.desktopApi?.savePayrollWeek
        ? await this.desktopApi.savePayrollWeek({
            weekNumber: payrollWeek.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          })
        : await firstValueFrom(this.http.post<{ inserted: number; attendanceSynced?: number }>('/api/payroll/week', {
            weekNumber: payrollWeek.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          }));

      if (!response.inserted || response.inserted <= 0) {
        throw new Error('La base de datos no confirmo renglones insertados para la planilla.');
      }
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo generar y registrar la planilla.');
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    } finally {
      this.payrollSaving.set(false);
    }

    const message = `Planilla semana ${payrollWeek.weekNumber} generada exitosamente: ${response.inserted} renglones y ${response.attendanceSynced || 0} asistencias sincronizadas.`;
    this.payrollSaveMessage.set(message);
    this.payrollImageModalOpen.set(false);
    this.showPayrollToast(message);

    try {
      await this.refreshPayrollAfterWeekSave(payrollWeek.weekNumber);
    } catch (error) {
      this.payrollSaveError.set(this.extractErrorMessage(error, 'La planilla fue guardada, pero no se pudo refrescar la informacion en pantalla.'));
    }
  }

  protected async saveImagePayrollWeekToDatabase(weekNumber?: number): Promise<void> {
    const currentUser = this.currentUser();
    const payrollWeek = this.imagePayrollWeekCards().find((week) => week.weekNumber === weekNumber) || this.imagePayrollWeekCards().at(-1);

    if (!currentUser) {
      const message = 'No hay un usuario autenticado para registrar planilla.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    if (!payrollWeek) {
      const message = 'No hay una semana base de planilla para registrar.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const missingUsers = payrollWeek.matrixRows
      .filter((row) => !row.user && row.total > 0)
      .map((row) => row.employeeName);

    if (missingUsers.length > 0) {
      const message = `No se encontraron estos empleados en dbo.usuario: ${missingUsers.join(', ')}.`;
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    const rows = this.buildPayrollSaveRowsFromImageWeek(payrollWeek);

    if (rows.length === 0) {
      const message = 'No hay filas validas para guardar la planilla.';
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    }

    this.payrollSaving.set(true);
    this.payrollSaveError.set('');
    this.payrollSaveMessage.set('');

    let response!: { inserted: number; attendanceSynced?: number };

    try {
      response = this.desktopApi?.savePayrollWeek
        ? await this.desktopApi.savePayrollWeek({
            weekNumber: payrollWeek.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          })
        : await firstValueFrom(this.http.post<{ inserted: number; attendanceSynced?: number }>('/api/payroll/week', {
            weekNumber: payrollWeek.weekNumber,
            createdByUserId: currentUser.id,
            rows,
          }));

      if (!response.inserted || response.inserted <= 0) {
        throw new Error('La base de datos no confirmo renglones insertados para la planilla.');
      }
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo registrar la planilla en la base de datos.');
      this.payrollSaveError.set(message);
      this.showPayrollToast(message, 'error');
      return;
    } finally {
      this.payrollSaving.set(false);
    }

    const message = `Planilla semana ${payrollWeek.weekNumber} registrada exitosamente: ${response.inserted} renglones y ${response.attendanceSynced || 0} asistencias sincronizadas.`;
    this.payrollSaveMessage.set(message);
    this.showPayrollToast(message);

    try {
      await this.refreshPayrollAfterWeekSave(payrollWeek.weekNumber);
    } catch (error) {
      this.payrollSaveError.set(this.extractErrorMessage(error, 'La planilla fue guardada, pero no se pudo refrescar la informacion en pantalla.'));
    }
  }

  private async refreshPayrollAfterWeekSave(weekNumber: number): Promise<void> {
    const selectedWeek = Number(weekNumber || 0);

    if (selectedWeek > 0) {
      this.selectedAttendanceWeek.set(selectedWeek);
    }

    this.payrollDataLoaded = false;
    this.payrollDataLoadPromise = null;
    await this.loadAttendanceUsers(true);

    if (selectedWeek > 0) {
      this.selectedAttendanceWeek.set(selectedWeek);
      this.restoreGeneratedPayrollHoursForWeek(selectedWeek);
    }

    queueMicrotask(() => {
      this.updateAttendanceTrendChart();
      this.updatePayrollTrendChart();
      this.updateDashboardPayrollChart();
    });
  }

  protected payrollScheduleDay(userId: number, dayId: PayrollDayId): PayrollScheduleDay {
    return this.payrollSchedules()[userId]?.[dayId] || this.buildPayrollScheduleDay(undefined, false);
  }

  protected userWeeklyScheduleLabel(userId: number): string {
    const scheduleWeek = this.buildPayrollScheduleWeek(this.payrollSchedules()[userId]);
    const enabledDays = this.payrollDays.filter((day) => scheduleWeek[day.id].enabled);

    if (enabledDays.length === 0) {
      return 'Sin horario';
    }

    const firstDay = scheduleWeek[enabledDays[0].id];
    const sameRange = enabledDays.every((day) => {
      const scheduleDay = scheduleWeek[day.id];
      return scheduleDay.entryTime === firstDay.entryTime && scheduleDay.exitTime === firstDay.exitTime;
    });

    return sameRange
      ? `${enabledDays.length} dias ${firstDay.entryTime}-${firstDay.exitTime}`
      : `${enabledDays.length} dias con horario mixto`;
  }

  private seedEditableImagePayrollRows(sourceWeek: ImagePayrollSourceWeek): void {
    this.editableImagePayrollRows.set(
      sourceWeek.rows.reduce<ImagePayrollEditableRows>((rows, row) => {
        rows[row.name] = this.cloneImagePayrollDays(row.days);
        return rows;
      }, {}),
    );
    this.editableImagePayrollBonuses.set(
      sourceWeek.rows.reduce<Record<string, number>>((bonuses, row) => {
        bonuses[row.name] = Number(row.bonus.toFixed(2));
        return bonuses;
      }, {}),
    );
  }

  private latestDatabasePayrollWeekBefore(targetWeek: number): number | null {
    const weeks = this.payrollDatabaseRecords()
      .map((record) => record.weekNumber)
      .filter((weekNumber) => weekNumber > 0 && weekNumber < targetWeek);

    return weeks.length ? Math.max(...weeks) : null;
  }

  private buildDatabasePayrollSourceWeek(sourceWeek: number, targetWeek: number): ImagePayrollSourceWeek | null {
    const records = this.payrollDatabaseRecords().filter((record) => record.weekNumber === sourceWeek);

    if (!records.length) {
      return null;
    }

    const recordsByUser = new Map<number, PayrollDatabaseRecord[]>();

    for (const record of records) {
      const userRecords = recordsByUser.get(record.userId) || [];
      userRecords.push(record);
      recordsByUser.set(record.userId, userRecords);
    }

    const targetStartDate = this.weekStartDate(2026, targetWeek);
    const rows = [...recordsByUser.values()]
      .map((userRecords) => {
        const firstRecord = userRecords[0];
        const days = this.buildEmptyImagePayrollDays();

        for (const record of userRecords) {
          const date = this.payrollRecordDate(record);
          const day = this.payrollDays[date.getUTCDay()];

          if (!day) {
            continue;
          }

          days[day.id] = {
            normal: record.normalHours,
            extra1: record.extra1Hours,
            extra2: record.extra2Hours,
            extra3: record.extra3Hours,
          };
        }

        const summaryRecord = userRecords.find((record) => record.totalHours || record.salary || record.total) || firstRecord;

        return {
          name: firstRecord.userName,
          aliases: firstRecord.userLogin ? [firstRecord.userLogin] : [],
          bonus: Number((summaryRecord?.bonus || 0).toFixed(2)),
          days,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      year: targetStartDate.getUTCFullYear(),
      weekNumber: targetWeek,
      label: this.payrollWeekRangeLabel(targetStartDate.getUTCFullYear(), targetWeek),
      rows,
    };
  }

  private buildEmptyImagePayrollDays(): ImagePayrollSourceRow['days'] {
    return {
      sunday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      monday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      tuesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      wednesday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      thursday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      friday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
      saturday: { normal: 0, extra1: 0, extra2: 0, extra3: 0 },
    };
  }

  private cloneImagePayrollDays(days: ImagePayrollSourceRow['days']): ImagePayrollSourceRow['days'] {
    return {
      sunday: { ...days.sunday },
      monday: { ...days.monday },
      tuesday: { ...days.tuesday },
      wednesday: { ...days.wednesday },
      thursday: { ...days.thursday },
      friday: { ...days.friday },
      saturday: { ...days.saturday },
    };
  }

  private buildPayrollSaveRowsFromImageWeek(payrollWeek: ImagePayrollWeekCard) {
    return payrollWeek.matrixRows.filter((line) => !!line.user).flatMap((line) =>
      line.days.map((day) => ({
        userId: line.user?.id || 0,
        day: `${day.day.name} ${day.date.toISOString().slice(0, 10)}`,
        normalHours: day.normalHours,
        extra1Hours: day.extra1Hours,
        extra2Hours: day.extra2Hours,
        extra3Hours: day.extra3Hours,
        normalPay: line.normalPay,
        extra1Pay: line.extra1Pay,
        extra2Pay: line.extra2Pay,
        extra3Pay: line.extra3Pay,
        totalHours: line.totalHours,
        salary: line.salary,
        bonus: line.bonus,
        total: line.total,
      })),
    );
  }

  private findUserForImagePayrollRow(name: string, aliases: string[]): AttendanceUser | null {
    const candidates = [name, ...aliases].map((candidate) => this.normalizeText(candidate));

    return (
      this.attendanceUsers().find((user) => {
        const normalizedUserName = this.normalizeText(user.name);
        return candidates.some((candidate) => normalizedUserName === candidate || normalizedUserName.includes(candidate) || candidate.includes(normalizedUserName));
      }) || null
    );
  }

  private buildImagePayrollMatrixRows(sourceWeek: ImagePayrollSourceWeek): PayrollWeekMatrixLine[] {
    const startDate = this.weekStartDate(sourceWeek.year, sourceWeek.weekNumber);

    return sourceWeek.rows.map((sourceRow) => {
      const user = this.findUserForImagePayrollRow(sourceRow.name, sourceRow.aliases || []);
      const days = this.payrollDays.map((day, index) => {
        const date = new Date(startDate);
        date.setUTCDate(startDate.getUTCDate() + index);
        const sourceDay = sourceRow.days[day.id] || { normal: 0, extra1: 0, extra2: 0, extra3: 0 };

        return {
          day,
          date,
          normalHours: Number(sourceDay.normal || 0),
          extra1Hours: Number(sourceDay.extra1 || 0),
          extra2Hours: Number(sourceDay.extra2 || 0),
          extra3Hours: Number(sourceDay.extra3 || 0),
        };
      });
      const normalHours = Number(days.reduce((total, day) => total + day.normalHours, 0).toFixed(2));
      const extra1Hours = Number(days.reduce((total, day) => total + day.extra1Hours, 0).toFixed(2));
      const extra2Hours = Number(days.reduce((total, day) => total + day.extra2Hours, 0).toFixed(2));
      const extra3Hours = Number(days.reduce((total, day) => total + day.extra3Hours, 0).toFixed(2));
      const normalPay = Number((normalHours * payrollNormalRate).toFixed(2));
      const extra1Pay = Number((extra1Hours * payrollExtra1Rate).toFixed(2));
      const extra2Pay = Number((extra2Hours * payrollExtra3WeekdayRate).toFixed(2));
      const extra3Pay = Number((extra3Hours * payrollExtra3WeekendRate).toFixed(2));
      const salary = Number((normalPay + extra1Pay + extra2Pay + extra3Pay).toFixed(2));
      const bonus = Number(sourceRow.bonus.toFixed(2));

      return {
        user,
        employeeName: sourceRow.name,
        days,
        normalHours,
        extra1Hours,
        extra2Hours,
        extra3Hours,
        normalPay,
        extra1Pay,
        extra2Pay,
        extra3Pay,
        totalHours: Number((normalHours + extra1Hours + extra2Hours + extra3Hours).toFixed(2)),
        salary,
        bonus,
        total: Number((salary + bonus).toFixed(2)),
      };
    });
  }

  private updatePayrollScheduleDay(
    userId: number,
    dayId: PayrollDayId,
    changes: Partial<PayrollScheduleDay>,
  ): void {
    this.payrollSchedules.update((schedules) => {
      const userWeek = this.buildPayrollScheduleWeek(schedules[userId]);

      return {
        ...schedules,
        [userId]: {
          ...userWeek,
          [dayId]: {
            ...userWeek[dayId],
            ...changes,
          },
        },
      };
    });
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
    this.scheduleGeneratedPayrollAudit(userId, dayId, shiftId, value);
  }

  protected userWeeklyShiftHours(userId: number, shiftId: PayrollShiftId): number {
    return this.payrollDays.reduce(
      (total, day) => total + (this.payrollHours()[userId]?.[day.id]?.[shiftId] || 0),
      0,
    );
  }

  private scheduleGeneratedPayrollAudit(
    userId: number,
    dayId: PayrollDayId,
    shiftId: PayrollShiftId,
    hours: number,
  ): void {
    const currentUser = this.currentUser();

    if (!currentUser) {
      return;
    }

    if (this.payrollAuditTimer !== null) {
      window.clearTimeout(this.payrollAuditTimer);
    }

    this.payrollAuditTimer = window.setTimeout(() => {
      const user = this.attendanceUserById(userId);
      void this.createAuditHistoryRecord({
        tableName: 'dbo.planilla',
        action: 'PLANILLA',
        recordKey: `usuario=${userId}; semana=${this.selectedAttendanceWeek() || 'actual'}`,
        userId: currentUser.id,
        user: currentUser.nombre || currentUser.usuario,
        previousData: '',
        newData: `empleado=${user?.name || userId}; dia=${dayId}; jornada=${shiftId}; horas=${hours}; total_semana=${this.generatedWeeklyPay()}`,
      });
    }, 800);
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

  private calculateGeneratedShiftHours(scheduleDay: PayrollScheduleDay): Record<PayrollShiftId, number> {
    if (!scheduleDay.enabled || !this.isValidTimeValue(scheduleDay.entryTime) || !this.isValidTimeValue(scheduleDay.exitTime)) {
      return this.buildPayrollShiftRow();
    }

    return {
      morning: this.overlapTimeRangeHours(scheduleDay.entryTime, scheduleDay.exitTime, '08:00', '15:00'),
      afternoon: this.overlapTimeRangeHours(scheduleDay.entryTime, scheduleDay.exitTime, '15:00', '19:00'),
      night: this.overlapTimeRangeHours(scheduleDay.entryTime, scheduleDay.exitTime, '19:00', '23:00'),
    };
  }

  private overlapTimeRangeHours(entryTime: string, exitTime: string, startTime: string, endTime: string): number {
    const entryMinutes = this.timeToMinutes(entryTime);
    const exitMinutes = this.timeToMinutes(exitTime);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if ([entryMinutes, exitMinutes, startMinutes, endMinutes].some((value) => value === null)) {
      return 0;
    }

    const normalizedExit = exitMinutes! <= entryMinutes! ? exitMinutes! + 1440 : exitMinutes!;
    const normalizedStart = startMinutes! < entryMinutes! ? startMinutes! + 1440 : startMinutes!;
    const normalizedEnd = endMinutes! <= normalizedStart ? endMinutes! + 1440 : endMinutes!;
    const overlapStart = Math.max(entryMinutes!, normalizedStart);
    const overlapEnd = Math.min(normalizedExit, normalizedEnd);

    return overlapEnd > overlapStart ? Number(((overlapEnd - overlapStart) / 60).toFixed(2)) : 0;
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
    if (period === 'year') {
      const year = date.getFullYear();

      return {
        key: String(year),
        label: String(year),
        sortValue: year,
      };
    }

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

  private readPayrollSchedulesFromStorage(): PayrollScheduleMatrix {
    try {
      const raw = localStorage.getItem(payrollScheduleStorageKey);

      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as Record<string, Partial<Record<PayrollDayId, Partial<PayrollScheduleDay>>>>;
      const schedules: PayrollScheduleMatrix = {};

      for (const [userIdText, userWeek] of Object.entries(parsed || {})) {
        const userId = Number(userIdText);

        if (!Number.isFinite(userId) || userId <= 0) {
          continue;
        }

        schedules[userId] = this.buildPayrollScheduleWeek(userWeek as PayrollScheduleMatrix[number]);
      }

      return schedules;
    } catch {
      return {};
    }
  }

  private isValidTimeValue(value: unknown): value is string {
    return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
  }

  private timeToMinutes(value: string): number | null {
    if (!this.isValidTimeValue(value)) {
      return null;
    }

    const [hoursText, minutesText] = value.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return hours * 60 + minutes;
  }

  protected toggleThemeMenu(): void {
    this.themeMenuOpen.update((isOpen) => !isOpen);
  }

  protected openSettingsModal(): void {
    this.themeMenuOpen.set(false);
    this.settingsModalOpen.set(true);
    if (this.activeSettingsTab() === 'backup') {
      void this.loadDatabaseBackups();
    }
  }

  protected closeSettingsModal(): void {
    this.settingsModalOpen.set(false);
  }

  protected setSettingsTab(tabId: SettingsTabId): void {
    this.activeSettingsTab.set(tabId);
    if (tabId === 'backup') {
      void this.loadDatabaseBackups();
    }
  }

  protected async loadDatabaseBackups(): Promise<void> {
    this.databaseBackupLoading.set(true);
    this.databaseBackupError.set('');

    try {
      const response = this.desktopApi?.getDatabaseBackups
        ? await this.desktopApi.getDatabaseBackups()
        : await firstValueFrom(this.http.get<DatabaseBackupsResponse>('/api/database-backups'));

      this.databaseBackupConfig.set(response.config);
      this.databaseBackups.set(response.backups);
      this.databaseBackupLatest.set(response.latest);
    } catch (error) {
      this.databaseBackupError.set(this.extractErrorMessage(error, 'No se pudieron cargar los respaldos.'));
    } finally {
      this.databaseBackupLoading.set(false);
    }
  }

  protected async saveDatabaseBackupSettings(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser || !this.canManageDatabaseBackups()) {
      this.databaseBackupError.set('Solo usuarios administrativos pueden configurar respaldos.');
      return;
    }

    this.databaseBackupSaving.set(true);
    this.databaseBackupError.set('');
    this.databaseBackupMessage.set('');

    try {
      const payload = {
        config: this.databaseBackupConfig(),
        user: currentUser,
      };
      const response = this.desktopApi?.saveDatabaseBackupConfig
        ? await this.desktopApi.saveDatabaseBackupConfig(payload)
        : await firstValueFrom(this.http.put<{ config: DatabaseBackupConfig }>('/api/database-backups/config', payload));

      this.databaseBackupConfig.set(response.config);
      this.databaseBackupMessage.set('Configuracion de respaldos guardada.');
      await this.loadDatabaseBackups();
    } catch (error) {
      this.databaseBackupError.set(this.extractErrorMessage(error, 'No se pudo guardar la configuracion.'));
    } finally {
      this.databaseBackupSaving.set(false);
    }
  }

  protected updateDatabaseBackupConfig<K extends keyof DatabaseBackupConfig>(
    key: K,
    value: DatabaseBackupConfig[K],
  ): void {
    this.databaseBackupConfig.update((config) => ({
      ...config,
      [key]: value,
    }));
  }

  protected updateDatabaseBackupEnabled(event: Event): void {
    this.updateDatabaseBackupConfig('enabled', (event.target as HTMLInputElement).checked);
  }

  protected updateDatabaseBackupFrequency(event: Event): void {
    const frequency = (event.target as HTMLSelectElement).value === 'weekly' ? 'weekly' : 'daily';
    this.updateDatabaseBackupConfig('frequency', frequency);
  }

  protected updateDatabaseBackupTime(event: Event): void {
    this.updateDatabaseBackupConfig('time', (event.target as HTMLInputElement).value || '23:00');
  }

  protected updateDatabaseBackupMax(event: Event): void {
    const maxBackups = this.clampNumber(Number((event.target as HTMLInputElement).value), 3, 365, 15);
    this.updateDatabaseBackupConfig('maxBackups', maxBackups);
  }

  protected updateDatabaseBackupDir(event: Event): void {
    this.updateDatabaseBackupConfig('backupDir', (event.target as HTMLInputElement).value);
  }

  protected async generateDatabaseBackupNow(): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser || !this.canManageDatabaseBackups()) {
      this.databaseBackupError.set('Solo usuarios administrativos pueden generar respaldos.');
      return;
    }

    this.databaseBackupRunning.set(true);
    this.databaseBackupError.set('');
    this.databaseBackupMessage.set('Generando respaldo...');

    try {
      const response = this.desktopApi?.createDatabaseBackup
        ? await this.desktopApi.createDatabaseBackup({ user: currentUser })
        : await firstValueFrom(this.http.post<{ backup: DatabaseBackupRow; message: string }>('/api/database-backups/manual', { user: currentUser }));

      this.databaseBackupMessage.set(response.message || 'Respaldo generado correctamente.');
      await this.loadDatabaseBackups();
    } catch (error) {
      this.databaseBackupError.set(this.extractErrorMessage(error, 'No se pudo generar el respaldo.'));
    } finally {
      this.databaseBackupRunning.set(false);
    }
  }

  protected async runAutomaticDatabaseBackupTest(): Promise<void> {
    if (!this.canManageDatabaseBackups()) {
      this.databaseBackupError.set('Solo usuarios administrativos pueden ejecutar respaldos automaticos.');
      return;
    }

    this.databaseBackupRunning.set(true);
    this.databaseBackupError.set('');
    this.databaseBackupMessage.set('Ejecutando tarea automatica...');

    try {
      const response = this.desktopApi?.runAutomaticDatabaseBackup
        ? await this.desktopApi.runAutomaticDatabaseBackup()
        : await firstValueFrom(this.http.post<{ backup: DatabaseBackupRow | null; skipped: boolean }>('/api/database-backups/run-automatic', {}));

      this.databaseBackupMessage.set(response.skipped ? 'La tarea automatica no estaba pendiente.' : 'Respaldo automatico generado correctamente.');
      await this.loadDatabaseBackups();
    } catch (error) {
      this.databaseBackupError.set(this.extractErrorMessage(error, 'No se pudo ejecutar la tarea automatica.'));
    } finally {
      this.databaseBackupRunning.set(false);
    }
  }

  protected async restoreDatabaseBackup(backup: DatabaseBackupRow): Promise<void> {
    const currentUser = this.currentUser();

    if (!currentUser || !this.canManageDatabaseBackups()) {
      this.databaseBackupError.set('Solo usuarios administrativos pueden restaurar la base de datos.');
      return;
    }

    const firstConfirmation = window.confirm(
      `Restaurar base de datos desde ${backup.fileName}?\n\nEsta operacion reemplazara la base actual. Antes de restaurar se generara un respaldo de emergencia.`,
    );

    if (!firstConfirmation) {
      return;
    }

    const secondConfirmation = window.prompt(
      'Segunda confirmacion requerida. Escriba exactamente: CONFIRMO RESTAURAR',
      '',
    );

    if (secondConfirmation !== 'CONFIRMO RESTAURAR') {
      this.databaseBackupError.set('Restauracion cancelada: la segunda confirmacion no coincide.');
      return;
    }

    this.databaseBackupRestoring.set(true);
    this.databaseBackupError.set('');
    this.databaseBackupMessage.set('Validando respaldo y generando respaldo de emergencia...');

    try {
      const validation = this.desktopApi?.validateDatabaseBackup
        ? await this.desktopApi.validateDatabaseBackup(backup.fileName)
        : await firstValueFrom(this.http.post<DatabaseBackupValidationResponse>('/api/database-backups/validate', { fileName: backup.fileName }));

      if (!validation.compatible) {
        throw new Error('El respaldo no corresponde a la base de datos actual.');
      }

      const response = this.desktopApi?.restoreDatabaseBackup
        ? await this.desktopApi.restoreDatabaseBackup({ fileName: backup.fileName, confirmation: secondConfirmation, user: currentUser })
        : await firstValueFrom(this.http.post<{ restore: DatabaseBackupRow; message: string }>('/api/database-backups/restore', {
            fileName: backup.fileName,
            confirmation: secondConfirmation,
            user: currentUser,
          }));

      this.databaseBackupMessage.set(response.message || 'Base de datos restaurada correctamente.');
      await this.loadDatabaseBackups();
      await this.updateSystemFromDashboard();
    } catch (error) {
      this.databaseBackupError.set(this.extractErrorMessage(error, 'No se pudo restaurar la base de datos.'));
      await this.loadDatabaseBackups();
    } finally {
      this.databaseBackupRestoring.set(false);
    }
  }

  protected updateThemeFromSettings(event: Event): void {
    const themeId = (event.target as HTMLSelectElement).value as ThemeId;

    if (this.themes.some((theme) => theme.id === themeId)) {
      this.setTheme(themeId);
      this.themeMenuOpen.set(false);
    }
  }

  protected updateSystemFont(event: Event): void {
    const fontId = (event.target as HTMLSelectElement).value as SystemFontId;

    if (!this.systemFontOptions.some((font) => font.id === fontId)) {
      return;
    }

    this.systemFont.set(fontId);
    this.persistSystemSettings();
  }

  protected setInterfaceDensity(value: InterfaceDensity): void {
    this.interfaceDensity.set(value);
    this.persistSystemSettings();
  }

  protected updateSidebarCollapsed(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.setSidebarCollapsed(checked);
  }

  protected updateDefaultTableRows(event: Event): void {
    const rows = Number((event.target as HTMLSelectElement).value);
    this.defaultTableRows.set(this.clampNumber(rows, 10, 25, 10));
    this.persistSystemSettings();
  }

  protected updateInventoryExpiryAlertDays(event: Event): void {
    const days = Number((event.target as HTMLInputElement).value);
    this.inventoryExpiryAlertDays.set(this.clampNumber(days, 1, 365, 30));
    this.persistSystemSettings();
  }

  protected updateTextSetting(setting: 'dashboardDefaultRange' | 'profitabilityDefaultRange', event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (setting === 'dashboardDefaultRange') {
      this.dashboardDefaultRange.set(value);
    } else {
      this.profitabilityDefaultRange.set(value);
    }

    this.persistSystemSettings();
  }

  protected updateBooleanSetting(
    setting:
      | 'billingConfirmSale'
      | 'billingPrintAfterSale'
      | 'inventoryShowInactive'
      | 'notificationsVisual'
      | 'notificationsSound'
      | 'systemAutoRefresh',
    event: Event,
  ): void {
    const checked = (event.target as HTMLInputElement).checked;

    switch (setting) {
      case 'billingConfirmSale':
        this.billingConfirmSale.set(checked);
        break;
      case 'billingPrintAfterSale':
        this.billingPrintAfterSale.set(checked);
        break;
      case 'inventoryShowInactive':
        this.inventoryShowInactive.set(checked);
        break;
      case 'notificationsVisual':
        this.notificationsVisual.set(checked);
        break;
      case 'notificationsSound':
        this.notificationsSound.set(checked);
        break;
      case 'systemAutoRefresh':
        this.systemAutoRefresh.set(checked);
        break;
    }

    this.persistSystemSettings();
  }

  protected resetSystemSettings(): void {
    this.systemFont.set('inter');
    this.interfaceDensity.set('normal');
    this.defaultTableRows.set(10);
    this.dashboardDefaultRange.set('month');
    this.billingConfirmSale.set(true);
    this.billingPrintAfterSale.set(false);
    this.inventoryShowInactive.set(false);
    this.inventoryExpiryAlertDays.set(30);
    this.profitabilityDefaultRange.set('month');
    this.notificationsVisual.set(true);
    this.notificationsSound.set(false);
    this.systemAutoRefresh.set(false);
    this.setTheme('black-green');
    this.setPageZoom(100);
    this.persistSystemSettings();
  }

  protected toggleSidebar(): void {
    this.setSidebarCollapsed(!this.sidebarCollapsed());
  }

  private setSidebarCollapsed(value: boolean): void {
    this.sidebarCollapsed.set(value);

    try {
      localStorage.setItem('yahweh-rohi-sidebar-collapsed', value ? '1' : '0');
    } catch {
      return;
    }
  }

  protected showSidebarTooltipFromEvent(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest('.nav-item');

    if (!(item instanceof HTMLElement)) {
      this.hideSidebarTooltip();
      return;
    }

    const label = (item.textContent || '').replace(/\s+/g, ' ').trim();

    if (!label) {
      this.hideSidebarTooltip();
      return;
    }

    const rect = item.getBoundingClientRect();
    this.sidebarTooltip.set({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }

  protected hideSidebarTooltip(): void {
    this.sidebarTooltip.set(null);
  }

  protected decreasePageZoom(): void {
    this.setPageZoom(this.pageZoomPercent() - 10);
  }

  protected increasePageZoom(): void {
    this.setPageZoom(this.pageZoomPercent() + 10);
  }

  protected resetPageZoom(): void {
    this.setPageZoom(100);
  }

  private setPageZoom(value: number): void {
    const nextZoom = this.clampPageZoom(value);
    this.pageZoomPercent.set(nextZoom);

    try {
      localStorage.setItem('yahweh-rohi-page-zoom', String(nextZoom));
    } catch {
      return;
    }
  }

  private clampPageZoom(value: number): number {
    return Math.min(Math.max(Math.round(Number(value || 100) / 10) * 10, 80), 130);
  }

  private applyPageZoom(value: number): void {
    const zoom = this.clampPageZoom(value);

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--app-zoom', String(zoom / 100));
      document.body.style.zoom = String(zoom / 100);
    }

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.updateVisibleCharts();
      }, 60);
    }
  }

  private applySystemFont(fontId: SystemFontId): void {
    const selectedFont = this.systemFontOptions.find((font) => font.id === fontId) ?? this.systemFontOptions[0];

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--app-font-family', selectedFont.value);
    }
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

  private loadSystemSettings(): void {
    try {
      const rawSettings = localStorage.getItem('yahweh-rohi-system-settings');

      if (!rawSettings) {
        return;
      }

      const settings = JSON.parse(rawSettings) as Partial<{
        systemFont: SystemFontId;
        interfaceDensity: InterfaceDensity;
        defaultTableRows: number;
        dashboardDefaultRange: string;
        billingConfirmSale: boolean;
        billingPrintAfterSale: boolean;
        inventoryShowInactive: boolean;
        inventoryExpiryAlertDays: number;
        profitabilityDefaultRange: string;
        notificationsVisual: boolean;
        notificationsSound: boolean;
        systemAutoRefresh: boolean;
      }>;

      if (settings.systemFont && this.systemFontOptions.some((font) => font.id === settings.systemFont)) {
        this.systemFont.set(settings.systemFont);
      }

      if (settings.interfaceDensity && ['compact', 'normal', 'comfortable'].includes(settings.interfaceDensity)) {
        this.interfaceDensity.set(settings.interfaceDensity);
      }

      if (typeof settings.defaultTableRows === 'number') {
        this.defaultTableRows.set(this.clampNumber(settings.defaultTableRows, 10, 25, 10));
      }

      if (settings.dashboardDefaultRange) {
        this.dashboardDefaultRange.set(settings.dashboardDefaultRange);
      }

      if (typeof settings.billingConfirmSale === 'boolean') {
        this.billingConfirmSale.set(settings.billingConfirmSale);
      }

      if (typeof settings.billingPrintAfterSale === 'boolean') {
        this.billingPrintAfterSale.set(settings.billingPrintAfterSale);
      }

      if (typeof settings.inventoryShowInactive === 'boolean') {
        this.inventoryShowInactive.set(settings.inventoryShowInactive);
      }

      if (typeof settings.inventoryExpiryAlertDays === 'number') {
        this.inventoryExpiryAlertDays.set(this.clampNumber(settings.inventoryExpiryAlertDays, 1, 365, 30));
      }

      if (settings.profitabilityDefaultRange) {
        this.profitabilityDefaultRange.set(settings.profitabilityDefaultRange);
      }

      if (typeof settings.notificationsVisual === 'boolean') {
        this.notificationsVisual.set(settings.notificationsVisual);
      }

      if (typeof settings.notificationsSound === 'boolean') {
        this.notificationsSound.set(settings.notificationsSound);
      }

      if (typeof settings.systemAutoRefresh === 'boolean') {
        this.systemAutoRefresh.set(settings.systemAutoRefresh);
      }
    } catch {
      return;
    }
  }

  private persistSystemSettings(): void {
    try {
      localStorage.setItem(
        'yahweh-rohi-system-settings',
        JSON.stringify({
          systemFont: this.systemFont(),
          interfaceDensity: this.interfaceDensity(),
          defaultTableRows: this.defaultTableRows(),
          dashboardDefaultRange: this.dashboardDefaultRange(),
          billingConfirmSale: this.billingConfirmSale(),
          billingPrintAfterSale: this.billingPrintAfterSale(),
          inventoryShowInactive: this.inventoryShowInactive(),
          inventoryExpiryAlertDays: this.inventoryExpiryAlertDays(),
          profitabilityDefaultRange: this.profitabilityDefaultRange(),
          notificationsVisual: this.notificationsVisual(),
          notificationsSound: this.notificationsSound(),
          systemAutoRefresh: this.systemAutoRefresh(),
        }),
      );
    } catch {
      return;
    }
  }

  private clampNumber(value: number, min: number, max: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(Math.max(Math.round(value), min), max);
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.billingPage.set(1);
    this.inventoryPage.set(1);
  }

  protected scheduleBillingSearchFocus(): void {
    if (this.activePage() !== 'billing' || this.activeMode() !== 'sale') {
      return;
    }

    if (this.billingSearchFocusTimeoutId) {
      clearTimeout(this.billingSearchFocusTimeoutId);
    }

    this.billingSearchFocusTimeoutId = window.setTimeout(() => {
      this.billingSearchFocusTimeoutId = null;
      this.focusBillingSearchInput();
    }, 0);
  }

  private focusBillingSearchInput(): void {
    if (this.activePage() !== 'billing' || this.activeMode() !== 'sale' || this.billingFocusBlocked()) {
      return;
    }

    const input = this.billingSearchInput?.nativeElement;

    if (!input) {
      return;
    }

    const activeElement = document.activeElement;

    if (activeElement === input) {
      return;
    }

    if (
      this.isEditableElement(activeElement) ||
      Date.now() - this.lastEditablePointerDownAt < 500
    ) {
      return;
    }

    input.focus();
  }

  private isEditableElement(target: EventTarget | null | undefined): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();

    return (
      tagName === 'input' ||
      tagName === 'select' ||
      tagName === 'textarea' ||
      tagName === 'button' ||
      target.isContentEditable
    );
  }

  private billingFocusBlocked(): boolean {
    return (
      this.customerModalOpen() ||
      this.supplierModalOpen() ||
      this.orderInvoiceModalOpen() ||
      this.quoteModalOpen() ||
      this.dailySalesModalOpen() ||
      this.productCatalogModalOpen() ||
      this.cutModalOpen() ||
      this.openingCutModalOpen() ||
      this.logoutCutModalOpen() ||
      this.expiringProductsModalOpen() ||
      this.lowStockAlertModalOpen() ||
      this.salesDropAlertModalOpen() ||
      this.financialMovementModalOpen() ||
      this.inactiveProductsPanelOpen() ||
      this.productBarcodeModalOpen() ||
      this.productReactivationModalOpen()
    );
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO PERMITE LEER CODIGO DE BARRA DESDE EL BUSCADOR DE FACTURACION.
  // EL ESCANER ESCRIBE EL CODIGO EN EL INPUT Y NORMALMENTE ENVIA ENTER AL FINAL.
  // SI EL CODIGO COINCIDE CON EL SKU PRINCIPAL O UN CODIGO ALTERNO ACTIVO, LO AGREGA AL CARRITO.
  protected handleBillingSearchEnter(event: Event): void {
    event.preventDefault();

    const input = event.target as HTMLInputElement;
    const code = input.value.trim().toLowerCase();

    if (!code) {
      return;
    }

    const exactProduct = this.products().find((product) => this.productMatchesBarcode(product, code));

    if (!exactProduct) {
      return;
    }

    this.addToCart(exactProduct.id);
    this.searchTerm.set('');
    input.value = '';
    this.scheduleBillingSearchFocus();
  }

  private productMatchesSearch(product: Product, search: string): boolean {
    if (!search) {
      return true;
    }

    return (
      product.name.toLowerCase().includes(search) ||
      product.sku.toLowerCase().includes(search) ||
      (product.barcodes || []).some((barcode) => barcode.code.toLowerCase().includes(search))
    );
  }

  private productMatchesBarcode(product: Product, normalizedCode: string): boolean {
    const activeCodes = (product.barcodes || [])
      .filter((barcode) => barcode.active)
      .map((barcode) => barcode.code.trim().toLowerCase())
      .filter(Boolean);

    return product.sku.trim().toLowerCase() === normalizedCode || activeCodes.includes(normalizedCode);
  }

  protected updateCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
    this.billingPage.set(1);
    this.inventoryPage.set(1);
  }

  protected updateInventoryStatusFilter(event: Event): void {
    this.inventoryStatusFilter.set((event.target as HTMLSelectElement).value as InventoryOperationalStatus);
    this.inventoryPage.set(1);
  }

  protected updateInventoryExpiryFilter(event: Event): void {
    this.inventoryExpiryFilter.set((event.target as HTMLSelectElement).value as InventoryExpiryFilter);
    this.inventoryPage.set(1);
  }

  protected updateBillingPageSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (!this.billingPageSizeOptions.includes(size)) return;
    this.billingPageSize.set(size);
    this.billingPage.set(1);
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

  protected setInvoiceTableDensity(density: 'compact' | 'normal' | 'spacious'): void {
    this.invoiceTableDensity.set(density);
  }

  protected updateInvoiceSearch(event: Event): void {
    this.invoiceSearch.set((event.target as HTMLInputElement).value);
    this.invoicePage.set(1);
    this.closeInvoicePreview();
  }

  protected updateInvoicePaymentFilter(event: Event): void {
    this.invoicePaymentFilter.set((event.target as HTMLSelectElement).value);
    this.invoicePage.set(1);
    this.closeInvoicePreview();
  }

  protected updateInvoiceStatusFilter(event: Event): void {
    this.invoiceStatusFilter.set((event.target as HTMLSelectElement).value);
    this.invoicePage.set(1);
    this.closeInvoicePreview();
  }

  protected clearInvoiceFilters(): void {
    this.invoiceSearch.set('');
    this.invoiceCustomerFilter.set('');
    this.invoicePaymentFilter.set('');
    this.invoiceStatusFilter.set('');
    this.invoicePage.set(1);
    this.closeInvoicePreview();
  }

  protected invoiceMonthlyVariation(month: InvoiceMonthlySalesRow): number | null {
    const rows = this.invoiceMonthlySalesRows();
    const index = rows.findIndex((item) => item.key === month.key);
    const previous = rows[index + 1];
    if (!previous || previous.total <= 0) return null;
    return (month.total - previous.total) / previous.total;
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

  protected stockStatusClass(product: Product): string {
    if (product.stock === 0) {
      return 'danger';
    }

    if (product.stock <= product.minStock) {
      return 'low';
    }

    return 'available';
  }

  protected productExpiryStatus(product: Pick<Product, 'primaryLotExpiryDate'>): InventoryExpiryFilter {
    if (!product.primaryLotExpiryDate) {
      return 'Sin fecha';
    }

    const expiryDate = new Date(product.primaryLotExpiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      return 'Sin fecha';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / 86400000);

    if (daysRemaining < 0) {
      return 'Vencido';
    }

    return daysRemaining <= 30 ? 'Vence pronto' : 'Vigente';
  }

  protected expiryStatusClass(product: Pick<Product, 'primaryLotExpiryDate'>): string {
    const status = this.productExpiryStatus(product);

    if (status === 'Vencido') {
      return 'expired';
    }

    if (status === 'Vence pronto') {
      return 'soon';
    }

    if (status === 'Sin fecha') {
      return 'empty';
    }

    return 'valid';
  }

  protected productLotStatus(product: Product): string {
    const lotCount = Number(product.activeLotCount || 0);

    if (lotCount <= 0) {
      return 'Sin lote';
    }

    return lotCount === 1 ? '1 lote activo' : `${lotCount} lotes activos`;
  }

  protected lotExpiryDaysLabel(expiryDate: string | null): string {
    if (!expiryDate) {
      return 'Sin vencimiento';
    }

    const date = new Date(expiryDate);
    if (Number.isNaN(date.getTime())) {
      return 'Sin vencimiento';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const days = Math.ceil((date.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      return `Vencido hace ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
    }

    return `Vence en ${days} dia${days === 1 ? '' : 's'}`;
  }

  protected productProfitMargin(product: Product): number {
    return this.productMarkupRatio(product.unitCost, product.salePrice);
  }

  protected productGrossUtility(product: Product): number {
    return product.salePrice - product.unitCost;
  }

  protected inventoryDetailSectionExpanded(section: InventoryMovementSection): boolean {
    return this.inventoryDetailExpandedSections()[section];
  }

  protected toggleInventoryDetailSection(section: InventoryMovementSection): void {
    this.inventoryDetailExpandedSections.update((sections) => ({
      ...sections,
      [section]: !sections[section],
    }));
  }

  protected inventoryDetailSummaryMode(section: InventoryMovementSection): InventoryMovementSummaryMode {
    return this.inventoryDetailSummaryModes()[section];
  }

  protected setInventoryDetailSummaryMode(
    section: InventoryMovementSection,
    mode: InventoryMovementSummaryMode,
  ): void {
    this.inventoryDetailSummaryModes.update((modes) => ({
      ...modes,
      [section]: mode,
    }));
  }

  protected setInventoryDetailTab(tab: InventoryDetailTab): void {
    this.activeInventoryDetailTab.set(tab);
  }

  protected inventoryProductPurchaseRows(product: Product): PurchaseHistoryRow[] {
    return this.purchaseHistoryRows()
      .filter((purchase) => purchase.productId === product.id)
      .slice(0, 40);
  }

  protected inventoryProductChangeRows(product: Product): AuditHistoryRecord[] {
    const productId = String(product.id);
    const sku = this.normalizeSearchText(product.sku);
    const name = this.normalizeSearchText(product.name);

    return this.auditHistory()
      .filter((record) => {
        const haystack = this.normalizeSearchText([
          record.tableName,
          record.action,
          record.recordKey,
          record.previousData,
          record.newData,
        ].join(' '));

        return haystack.includes(`id producto ${productId}`)
          || haystack.includes(`id_producto ${productId}`)
          || haystack.includes(`productid ${productId}`)
          || haystack.includes(`product id ${productId}`)
          || (!!sku && haystack.includes(sku))
          || (!!name && haystack.includes(name));
      })
      .slice(0, 40);
  }

  protected inventoryProductChangeLabel(record: AuditHistoryRecord): string {
    return this.formatActivityAction(record.action, record.tableName);
  }

  protected openInventoryDetailPurchaseModal(product: Product): void {
    this.inventoryEditingProductId.set(product.id);
    this.quickInventoryPurchaseQuantity.set('');
    this.quickInventoryPurchaseUnitCost.set(product.unitCost > 0 ? String(product.unitCost) : '');
    this.quickInventoryPurchaseExpiryDate.set(this.dateOffsetKey(90));
    this.quickInventoryPurchaseError.set('');
    this.quickInventoryPurchaseModalOpen.set(true);
  }

  protected openInventoryDetailReductionModal(product: Product): void {
    this.inventoryEditingProductId.set(product.id);
    this.quickInventoryReductionQuantity.set('');
    this.quickInventoryReductionReason.set(this.quickInventoryReductionReasons[0]);
    this.quickInventoryReductionError.set('');
    this.quickInventoryReductionModalOpen.set(true);
  }

  protected inventoryMovementTotal(detail: ProductInventoryDetail, section: InventoryMovementSection): number {
    const field = section === 'entries' ? 'entry' : 'exit';
    return detail.movements.reduce((total, movement) => total + Number(movement[field] || 0), 0);
  }

  protected inventoryMovementSectionRows(
    detail: ProductInventoryDetail,
    section: InventoryMovementSection,
  ): InventoryMovementPeriodSummary[] {
    const mode = this.inventoryDetailSummaryMode(section);
    const field = section === 'entries' ? 'entry' : 'exit';
    const summaries = new Map<string, InventoryMovementPeriodSummary>();
    const annualMonths = new Map<string, Map<string, InventoryMovementPeriodSummary>>();

    detail.movements
      .filter((movement) => Number(movement[field] || 0) > 0)
      .forEach((movement) => {
        const date = this.parseInventoryMovementDate(movement.date);
        const key = this.inventoryMovementPeriodKey(date, mode);
        const current = summaries.get(key) || {
          key,
          label: this.inventoryMovementPeriodLabel(date, mode),
          quantity: 0,
          movements: 0,
          lastDate: null,
        };
        const movementTime = date?.getTime() ?? 0;
        const currentTime = current.lastDate ? new Date(current.lastDate).getTime() : 0;

        summaries.set(key, {
          ...current,
          quantity: current.quantity + Number(movement[field] || 0),
          movements: current.movements + 1,
          lastDate: movementTime >= currentTime ? movement.date : current.lastDate,
        });

        if (mode === 'annual') {
          const monthKey = this.inventoryMovementPeriodKey(date, 'monthly');
          const monthMap = annualMonths.get(key) || new Map<string, InventoryMovementPeriodSummary>();
          const currentMonth = monthMap.get(monthKey) || {
            key: monthKey,
            label: this.inventoryMovementPeriodLabel(date, 'monthly'),
            quantity: 0,
            movements: 0,
            lastDate: null,
          };
          const currentMonthTime = currentMonth.lastDate ? new Date(currentMonth.lastDate).getTime() : 0;

          monthMap.set(monthKey, {
            ...currentMonth,
            quantity: currentMonth.quantity + Number(movement[field] || 0),
            movements: currentMonth.movements + 1,
            lastDate: movementTime >= currentMonthTime ? movement.date : currentMonth.lastDate,
          });
          annualMonths.set(key, monthMap);
        }
      });

    return Array.from(summaries.values())
      .map((summary) => ({
        ...summary,
        months: Array.from(annualMonths.get(summary.key)?.values() || []).sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }

  protected inventoryStockCoverage(detail: ProductInventoryDetail): InventoryStockCoverage {
    const exits = detail.movements
      .map((movement) => ({
        quantity: Number(movement.exit || 0),
        date: this.parseInventoryMovementDate(movement.date),
      }))
      .filter((movement) => movement.quantity > 0 && movement.date);

    if (!exits.length) {
      return {
        label: 'Sin consumo historico',
        basis: 'No hay salidas recientes para proyectar',
        dailyAverage: 0,
        projectedDays: null,
        level: 'neutral',
      };
    }

    const latestTime = Math.max(...exits.map((movement) => movement.date!.getTime()));
    const periodStart = new Date(latestTime);
    periodStart.setDate(periodStart.getDate() - 29);
    periodStart.setHours(0, 0, 0, 0);
    const recentExits = exits.filter((movement) => movement.date!.getTime() >= periodStart.getTime());
    const relevantExits = recentExits.length ? recentExits : exits;
    const totalExit = relevantExits.reduce((total, movement) => total + movement.quantity, 0);
    const oldestTime = Math.min(...relevantExits.map((movement) => movement.date!.getTime()));
    const daysWindow = Math.max(1, Math.ceil((latestTime - oldestTime) / 86400000) + 1);
    const dailyAverage = totalExit / Math.min(30, daysWindow);

    if (dailyAverage <= 0) {
      return {
        label: 'Sin consumo historico',
        basis: 'No hay salidas recientes para proyectar',
        dailyAverage: 0,
        projectedDays: null,
        level: 'neutral',
      };
    }

    const projectedDays = Number(detail.product.stock || 0) / dailyAverage;
    const roundedDays = Math.max(0, Math.floor(projectedDays));
    const level = roundedDays <= 7 ? 'critical' : roundedDays <= 15 ? 'warning' : 'good';

    return {
      label: `${roundedDays} dia${roundedDays === 1 ? '' : 's'}`,
      basis: `Promedio ${dailyAverage.toFixed(2)} unidades/dia`,
      dailyAverage,
      projectedDays,
      level,
    };
  }

  private parseInventoryMovementDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private inventoryMovementPeriodKey(date: Date | null, mode: InventoryMovementSummaryMode): string {
    if (!date) {
      return 'sin-fecha';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    if (mode === 'annual') {
      return `${year}`;
    }

    if (mode === 'monthly') {
      return `${year}-${month}`;
    }

    if (mode === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return `${weekStart.getFullYear()}-${`${weekStart.getMonth() + 1}`.padStart(2, '0')}-${`${weekStart.getDate()}`.padStart(2, '0')}`;
    }

    return `${year}-${month}-${day}`;
  }

  private inventoryMovementPeriodLabel(date: Date | null, mode: InventoryMovementSummaryMode): string {
    if (!date) {
      return 'Sin fecha';
    }

    if (mode === 'annual') {
      return `${date.getFullYear()}`;
    }

    if (mode === 'monthly') {
      return new Intl.DateTimeFormat('es-HN', { month: 'long', year: 'numeric' }).format(date);
    }

    if (mode === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${this.formatInventoryShortDate(weekStart)} - ${this.formatInventoryShortDate(weekEnd)}`;
    }

    return this.formatInventoryShortDate(date);
  }

  private formatInventoryShortDate(date: Date): string {
    return new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  protected async openInventoryDetailModal(productId: number): Promise<void> {
    const product = this.products().find((item) => item.id === productId);

    this.inventoryDetailModalOpen.set(true);
    this.inventoryDetailLoading.set(true);
    this.inventoryDetailError.set('');
    this.activeInventoryDetailTab.set('photo');
    this.selectedInventoryDetail.set(
      product
        ? {
            product,
            lots: [],
            movements: [],
          }
        : null,
    );

    try {
      const response = this.desktopApi
        ? await this.desktopApi.getProductInventoryDetail(productId)
        : await firstValueFrom(this.http.get<ProductInventoryDetailResponse>(`/api/products/${productId}/inventory-detail`));
      const detailProduct = {
        ...response.product,
        imageUrl: response.product.imageUrl || product?.imageUrl || null,
        margin: this.productMarkupRatio(response.product.unitCost, response.product.salePrice),
      };

      this.selectedInventoryDetail.set({
        ...response,
        product: detailProduct,
      });
    } catch (error) {
      this.inventoryDetailError.set(this.extractErrorMessage(error, 'No se pudo cargar el detalle del producto.'));
    } finally {
      this.inventoryDetailLoading.set(false);
    }
  }

  protected closeInventoryDetailModal(): void {
    this.inventoryDetailModalOpen.set(false);
    this.inventoryDetailLoading.set(false);
    this.inventoryDetailError.set('');
    this.selectedInventoryDetail.set(null);
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
    const numericFields = ['stock', 'minStock', 'maxStock', 'unitCost', 'profitPercentage', 'salePrice'];
    const value = field === 'allowsDecimalQuantity'
      ? input.checked
      : numericFields.includes(field)
        ? Math.max(Number(input.value) || 0, 0)
        : field === 'imageUrl'
          ? this.normalizeProductImageInput(input.value)
          : input.value;

    this.inventoryDraft.update((draft) => {
      const nextDraft = { ...draft, [field]: value };

      if (field === 'profitPercentage') {
        const profitPercentage = Number(value || 0);
        nextDraft.salePrice = this.calculateInventorySalePrice(nextDraft.unitCost, profitPercentage);
      }

      if (field === 'unitCost' && nextDraft.profitPercentage > 0) {
        nextDraft.salePrice = this.calculateInventorySalePrice(Number(value || 0), nextDraft.profitPercentage);
      }

      if (field === 'salePrice') {
        nextDraft.profitPercentage = this.inventoryProfitPercentage(nextDraft.unitCost, Number(value || 0));
      }

      return nextDraft;
    });
  }

  private normalizeProductImageInput(value: string | null | undefined): string {
    const image = String(value || '').trim();

    if (!image) {
      return '';
    }

    if (
      image.includes('/') ||
      image.includes('\\') ||
      image.includes(':') ||
      image.toLowerCase().startsWith('assets/img/')
    ) {
      const normalized = image.replace(/\\/g, '/');
      const assetsIndex = normalized.toLowerCase().lastIndexOf('assets/img/');
      if (assetsIndex >= 0) {
        return normalized.slice(assetsIndex);
      }

      const invertedAssetsIndex = normalized.toLowerCase().lastIndexOf('img/assets/');
      if (invertedAssetsIndex >= 0) {
        return `assets/img/${normalized.slice(invertedAssetsIndex + 'img/assets/'.length)}`;
      }

      return normalized;
    }

    return `assets/img/${image}`;
  }

  protected quickInventoryProduct(): Product | null {
    const productId = this.inventoryEditingProductId();
    return productId === null ? null : this.products().find((product) => product.id === productId) || null;
  }

  protected openQuickInventoryPurchaseModal(): void {
    const product = this.quickInventoryProduct();

    if (!product) {
      this.productsError.set('Guarda el producto antes de agregar inventario rapido.');
      return;
    }

    this.quickInventoryPurchaseQuantity.set('');
    this.quickInventoryPurchaseUnitCost.set(product.unitCost > 0 ? String(product.unitCost) : '');
    this.quickInventoryPurchaseExpiryDate.set(this.dateOffsetKey(90));
    this.quickInventoryPurchaseError.set('');
    this.quickInventoryPurchaseModalOpen.set(true);
  }

  protected closeQuickInventoryPurchaseModal(): void {
    if (this.quickInventoryPurchaseSaving()) {
      return;
    }

    this.quickInventoryPurchaseModalOpen.set(false);
    this.quickInventoryPurchaseError.set('');
  }

  protected openQuickInventoryReductionModal(): void {
    const product = this.quickInventoryProduct();

    if (!product) {
      this.productsError.set('Guarda el producto antes de rebajar inventario.');
      return;
    }

    this.quickInventoryReductionQuantity.set('');
    this.quickInventoryReductionReason.set(this.quickInventoryReductionReasons[0]);
    this.quickInventoryReductionError.set('');
    this.quickInventoryReductionModalOpen.set(true);
  }

  protected closeQuickInventoryReductionModal(): void {
    if (this.quickInventoryReductionSaving()) {
      return;
    }

    this.quickInventoryReductionModalOpen.set(false);
    this.quickInventoryReductionError.set('');
  }

  protected updateQuickInventoryPurchaseQuantity(event: Event): void {
    this.quickInventoryPurchaseQuantity.set((event.target as HTMLInputElement).value);
  }

  protected updateQuickInventoryPurchaseUnitCost(event: Event): void {
    this.quickInventoryPurchaseUnitCost.set((event.target as HTMLInputElement).value);
  }

  protected updateQuickInventoryPurchaseExpiryDate(event: Event): void {
    this.quickInventoryPurchaseExpiryDate.set((event.target as HTMLInputElement).value);
  }

  protected updateQuickInventoryReductionQuantity(event: Event): void {
    this.quickInventoryReductionQuantity.set((event.target as HTMLInputElement).value);
  }

  protected updateQuickInventoryReductionReason(event: Event): void {
    this.quickInventoryReductionReason.set((event.target as HTMLSelectElement).value);
  }

  protected async saveQuickInventoryPurchase(): Promise<void> {
    const product = this.quickInventoryProduct();
    const currentUser = this.currentUser();
    const quantity = Number(this.quickInventoryPurchaseQuantity());
    const unitCost = Number(this.quickInventoryPurchaseUnitCost());

    if (!product) {
      this.quickInventoryPurchaseError.set('Producto requerido para ingreso rapido.');
      return;
    }

    if (!currentUser) {
      this.quickInventoryPurchaseError.set('Usuario requerido para registrar ingreso.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.quickInventoryPurchaseError.set('Ingresa una cantidad de stock valida.');
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      this.quickInventoryPurchaseError.set('Ingresa el costo de compra.');
      return;
    }

    this.quickInventoryPurchaseSaving.set(true);
    this.quickInventoryPurchaseError.set('');

    try {
      const payload = {
        productId: product.id,
        quantity,
        unitCost,
        expiryDate: this.quickInventoryPurchaseExpiryDate() || null,
        userId: currentUser.id,
      };
      const response = this.desktopApi?.createQuickInventoryPurchase
        ? await this.desktopApi.createQuickInventoryPurchase(payload)
        : await firstValueFrom(this.http.post<QuickInventoryPurchaseResponse>('/api/inventory/quick-purchase', payload));

      await this.fetchProducts();
      await this.loadPurchases();
      await this.loadDashboardSalesSummary();
      this.inventoryDraft.update((draft) => ({
        ...draft,
        stock: Math.round((Number(draft.stock || 0) + quantity) * 1000) / 1000,
        unitCost,
      }));
      this.quickInventoryPurchaseModalOpen.set(false);
      this.showInventorySuccess(`Inventario agregado como compra ${response.invoiceNumber}.`);
    } catch (error) {
      this.quickInventoryPurchaseError.set(this.extractErrorMessage(error, 'No se pudo registrar el ingreso rapido.'));
    } finally {
      this.quickInventoryPurchaseSaving.set(false);
    }
  }

  protected async saveQuickInventoryReduction(): Promise<void> {
    const product = this.quickInventoryProduct();
    const currentUser = this.currentUser();
    const quantity = Number(this.quickInventoryReductionQuantity());
    const reason = this.quickInventoryReductionReason();

    if (!product) {
      this.quickInventoryReductionError.set('Producto requerido para rebajar inventario.');
      return;
    }

    if (!currentUser) {
      this.quickInventoryReductionError.set('Usuario requerido para rebajar inventario.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.quickInventoryReductionError.set('Ingresa una cantidad de stock valida.');
      return;
    }

    if (quantity > Number(product.stock || 0)) {
      this.quickInventoryReductionError.set('La cantidad a rebajar supera el stock actual.');
      return;
    }

    if (!reason) {
      this.quickInventoryReductionError.set('Selecciona una razon para la rebaja.');
      return;
    }

    this.quickInventoryReductionSaving.set(true);
    this.quickInventoryReductionError.set('');

    try {
      const payload = {
        productId: product.id,
        quantity,
        reason,
        userId: currentUser.id,
      };
      const response = this.desktopApi?.createQuickInventoryReduction
        ? await this.desktopApi.createQuickInventoryReduction(payload)
        : await firstValueFrom(this.http.post<QuickInventoryReductionResponse>('/api/inventory/quick-reduction', payload));

      await this.fetchProducts();
      this.inventoryDraft.update((draft) => ({
        ...draft,
        stock: response.newStock,
      }));

      if (this.inventoryDetailModalOpen()) {
        await this.openInventoryDetailModal(product.id);
        this.activeInventoryDetailTab.set('exits');
      }

      this.quickInventoryReductionModalOpen.set(false);
      this.showInventorySuccess(`Inventario rebajado por ${response.reason}.`);
    } catch (error) {
      this.quickInventoryReductionError.set(this.extractErrorMessage(error, 'No se pudo rebajar inventario.'));
    } finally {
      this.quickInventoryReductionSaving.set(false);
    }
  }

  private calculateInventorySalePrice(unitCost: number, profitPercentage: number): number {
    const cost = Math.max(Number(unitCost || 0), 0);
    const percentage = Math.max(Number(profitPercentage || 0), 0);
    return Math.round(cost * (1 + percentage / 100) * 100) / 100;
  }

  private inventoryProfitPercentage(unitCost: number, salePrice: number): number {
    const cost = Number(unitCost || 0);

    if (!Number.isFinite(cost) || cost <= 0) {
      return 0;
    }

    return Math.round(((Number(salePrice || 0) - cost) / cost) * 10000) / 100;
  }

  private productMarkupRatio(unitCost: number, salePrice: number): number {
    return this.inventoryProfitPercentage(unitCost, salePrice) / 100;
  }

  protected openInventoryModal(): void {
    this.inventoryEditingProductId.set(null);
    const nextId = Math.max(...this.products().map((product) => product.id), 0) + 1;
    this.inventoryDraft.set({
      sku: `NVO-${String(nextId).padStart(3, '0')}`,
      name: '',
      imageUrl: '',
      category: 'Camisas',
      primaryLotExpiryDate: '',
      stock: 0,
      minStock: 5,
      maxStock: 0,
      unitCost: 0,
      profitPercentage: 0,
      salePrice: 0,
      unitMeasure: 'Unidad',
      allowsDecimalQuantity: false,
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
      primaryLotExpiryDate: product.primaryLotExpiryDate ? product.primaryLotExpiryDate.slice(0, 10) : '',
      stock: product.stock,
      minStock: product.minStock,
      maxStock: product.maxStock || 0,
      unitCost: product.unitCost,
      profitPercentage: this.inventoryProfitPercentage(product.unitCost, product.salePrice),
      salePrice: product.salePrice,
      unitMeasure: product.unitMeasure || 'Unidad',
      allowsDecimalQuantity: Boolean(product.allowsDecimalQuantity),
    });
    this.inventoryModalOpen.set(true);
  }

  protected closeInventoryModal(): void {
    this.inventoryModalOpen.set(false);
    this.inventoryEditingProductId.set(null);
  }

  protected async openInactiveProductsPanel(): Promise<void> {
    this.inactiveProductsPanelOpen.set(true);
    await this.fetchInactiveProducts();
  }

  protected closeInactiveProductsPanel(): void {
    this.inactiveProductsPanelOpen.set(false);
    this.inactiveProductsError.set('');
    this.inactiveProductSearch.set('');
    this.inactiveProductsPage.set(1);
    this.blurActiveElementIfRemoved();
  }

  private blurActiveElementIfRemoved(): void {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }
  }

  protected updateInactiveProductSearch(event: Event): void {
    this.inactiveProductSearch.set((event.target as HTMLInputElement).value);
    this.inactiveProductsPage.set(1);
  }

  protected previousInactiveProductsPage(): void {
    this.inactiveProductsPage.update((page) => Math.max(page - 1, 1));
  }

  protected nextInactiveProductsPage(): void {
    this.inactiveProductsPage.update((page) => Math.min(page + 1, this.inactiveProductsPageCount()));
  }

  protected openProductReactivationModal(product: InactiveProduct): void {
    if (!this.canReactivateInventoryProducts()) {
      this.showInventorySuccess('No tiene permisos de administracion de Inventario para reactivar productos.', 'error');
      return;
    }

    this.selectedInactiveProduct.set(product);
    this.productReactivationDraft.set({
      nuevoCosto: product.unitCost > 0 ? String(product.unitCost) : '',
      nuevoPrecioVenta: product.salePrice > 0 ? String(product.salePrice) : '',
      stockReingreso: '',
    });
    this.productReactivationConfirmOpen.set(false);
    this.productReactivationError.set('');
    this.productReactivationModalOpen.set(true);
  }

  protected closeProductReactivationModal(): void {
    if (this.productReactivationSaving()) {
      return;
    }

    this.productReactivationModalOpen.set(false);
    this.productReactivationConfirmOpen.set(false);
    this.productReactivationError.set('');
    this.selectedInactiveProduct.set(null);
  }

  protected updateProductReactivationDraft(field: keyof ProductReactivationDraft, event: Event): void {
    this.productReactivationDraft.update((draft) => ({
      ...draft,
      [field]: (event.target as HTMLInputElement).value,
    }));
    this.productReactivationConfirmOpen.set(false);
  }

  protected prepareProductReactivationConfirmation(): void {
    const validationMessage = this.validateProductReactivationDraft();

    if (validationMessage) {
      this.productReactivationError.set(validationMessage);
      return;
    }

    this.productReactivationError.set('');
    this.productReactivationConfirmOpen.set(true);
  }

  protected async confirmProductReactivation(): Promise<void> {
    const product = this.selectedInactiveProduct();
    const currentUser = this.currentUser();
    const validationMessage = this.validateProductReactivationDraft();

    if (!product) {
      this.productReactivationError.set('Producto inactivo requerido para reactivar.');
      return;
    }

    if (!currentUser) {
      this.productReactivationError.set('Usuario requerido para reactivar productos.');
      return;
    }

    if (!this.canReactivateInventoryProducts()) {
      this.productReactivationError.set('No tiene permisos de administracion de Inventario para reactivar productos.');
      return;
    }

    if (validationMessage) {
      this.productReactivationError.set(validationMessage);
      return;
    }

    const draft = this.productReactivationDraft();
    const payload = {
      productId: product.id,
      nuevoCosto: Number(draft.nuevoCosto),
      nuevoPrecioVenta: Number(draft.nuevoPrecioVenta),
      stockReingreso: Number(draft.stockReingreso),
      userId: currentUser.id,
      user: currentUser.nombre || currentUser.usuario,
    };

    this.productReactivationSaving.set(true);
    this.productReactivationError.set('');

    try {
      const response = await this.requestReactivateInventoryProduct(payload);
      const reactivatedProduct: Product = {
        ...response.product,
        margin: this.productMarkupRatio(response.product.unitCost, response.product.salePrice),
      };

      this.inactiveProducts.update((products) => products.filter((item) => item.id !== product.id));
      this.products.update((products) =>
        [...products.filter((item) => item.id !== reactivatedProduct.id), reactivatedProduct]
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      this.billingCatalogLoaded = false;
      this.closeProductReactivationModal();
      this.showInventorySuccess('Producto reactivado correctamente.');
      await this.loadExpiringProducts();
    } catch (error) {
      this.productReactivationError.set(this.extractErrorMessage(error, 'No se pudo reactivar el producto.'));
    } finally {
      this.productReactivationSaving.set(false);
    }
  }

  private validateProductReactivationDraft(): string {
    const draft = this.productReactivationDraft();
    const nuevoCosto = Number(draft.nuevoCosto);
    const nuevoPrecioVenta = Number(draft.nuevoPrecioVenta);
    const stockReingreso = Number(draft.stockReingreso);

    if (!draft.nuevoCosto || !Number.isFinite(nuevoCosto) || nuevoCosto <= 0) {
      return 'Nuevo costo es obligatorio y debe ser mayor que 0.';
    }

    if (!draft.nuevoPrecioVenta || !Number.isFinite(nuevoPrecioVenta) || nuevoPrecioVenta <= 0) {
      return 'Nuevo precio de venta es obligatorio y debe ser mayor que 0.';
    }

    if (!draft.stockReingreso || !Number.isFinite(stockReingreso) || stockReingreso <= 0) {
      return 'Stock de reingreso es obligatorio y debe ser mayor que 0.';
    }

    return '';
  }

  protected async openProductBarcodeModal(product: Product): Promise<void> {
    this.resetInventoryAuxTable('barcodes');
    this.productBarcodeTarget.set(product);
    this.productBarcodeDraft.set('');
    this.productBarcodeError.set('');
    this.productBarcodeModalOpen.set(true);
    await this.refreshProductBarcodes(product.id);
  }

  protected closeProductBarcodeModal(): void {
    if (this.productBarcodeSaving()) {
      return;
    }

    this.productBarcodeModalOpen.set(false);
    this.productBarcodeTarget.set(null);
    this.productBarcodeDraft.set('');
    this.productBarcodeError.set('');
    this.blurActiveElementIfRemoved();
  }

  protected updateProductBarcodeDraft(event: Event): void {
    this.productBarcodeDraft.set((event.target as HTMLInputElement).value);
    this.productBarcodeError.set('');
  }

  protected async addProductBarcode(): Promise<void> {
    const product = this.productBarcodeTarget();
    const code = this.productBarcodeDraft().trim();

    if (!product) {
      this.productBarcodeError.set('Producto requerido.');
      return;
    }

    if (!code) {
      this.productBarcodeError.set('Codigo de barra requerido.');
      return;
    }

    this.productBarcodeSaving.set(true);
    this.productBarcodeError.set('');

    try {
      const response = await this.requestCreateProductBarcode({
        productId: product.id,
        code,
        userId: this.currentUser()?.id || null,
        user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      });
      this.applyProductBarcodeResponse(product.id, response.barcodes, response.sku);
      this.productBarcodeDraft.set('');
      this.showInventorySuccess('Codigo de barra agregado correctamente.');
    } catch (error) {
      this.productBarcodeError.set(this.extractErrorMessage(error, 'No se pudo agregar el codigo de barra.'));
    } finally {
      this.productBarcodeSaving.set(false);
    }
  }

  protected async markProductBarcodePrimary(barcode: ProductBarcode): Promise<void> {
    const product = this.productBarcodeTarget();

    if (!product || barcode.isPrimary) {
      return;
    }

    this.productBarcodeSaving.set(true);
    this.productBarcodeError.set('');

    try {
      const response = await this.requestSetPrimaryProductBarcode({
        productId: product.id,
        barcodeId: barcode.id,
        userId: this.currentUser()?.id || null,
        user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      });
      this.applyProductBarcodeResponse(product.id, response.barcodes, response.sku);
      this.billingCatalogLoaded = false;
      this.showInventorySuccess('Codigo principal actualizado correctamente.');
    } catch (error) {
      this.productBarcodeError.set(this.extractErrorMessage(error, 'No se pudo marcar el codigo principal.'));
    } finally {
      this.productBarcodeSaving.set(false);
    }
  }

  protected async toggleProductBarcodeStatus(barcode: ProductBarcode): Promise<void> {
    const product = this.productBarcodeTarget();

    if (!product) {
      return;
    }

    this.productBarcodeSaving.set(true);
    this.productBarcodeError.set('');

    try {
      const response = await this.requestUpdateProductBarcodeStatus({
        productId: product.id,
        barcodeId: barcode.id,
        active: !barcode.active,
        userId: this.currentUser()?.id || null,
        user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      });
      this.applyProductBarcodeResponse(product.id, response.barcodes, response.sku);
      this.billingCatalogLoaded = false;
    } catch (error) {
      this.productBarcodeError.set(this.extractErrorMessage(error, 'No se pudo actualizar el codigo de barra.'));
    } finally {
      this.productBarcodeSaving.set(false);
    }
  }

  private async refreshProductBarcodes(productId: number): Promise<void> {
    this.productBarcodeLoading.set(true);

    try {
      const response = await this.requestProductBarcodes(productId);
      this.applyProductBarcodeResponse(productId, response.barcodes);
    } catch (error) {
      this.productBarcodeError.set(this.extractErrorMessage(error, 'No se pudieron cargar los codigos de barra.'));
    } finally {
      this.productBarcodeLoading.set(false);
    }
  }

  private applyProductBarcodeResponse(productId: number, barcodes: ProductBarcode[], sku?: string): void {
    this.products.update((products) =>
      products.map((product) =>
        product.id === productId
          ? {
              ...product,
              sku: sku || barcodes.find((barcode) => barcode.isPrimary)?.code || product.sku,
              barcodes,
            }
          : product,
      ),
    );

    const target = this.productBarcodeTarget();
    if (target?.id === productId) {
      this.productBarcodeTarget.set({
        ...target,
        sku: sku || barcodes.find((barcode) => barcode.isPrimary)?.code || target.sku,
        barcodes,
      });
    }
  }

  protected async saveInventoryProduct(): Promise<void> {
    const draft = this.inventoryDraft();
    const name = draft.name.trim();
    const sku = draft.sku.trim();

    if (!name || !sku) {
      const message = 'Codigo y nombre son requeridos para guardar el producto.';
      this.productsError.set(message);
      window.alert(message);
      return;
    }

    const numericFields: Array<[string, number]> = [
      ['stock', draft.stock],
      ['stock minimo', draft.minStock],
      ['stock maximo', draft.maxStock],
      ['costo', draft.unitCost],
      ['precio venta', draft.salePrice],
    ];
    const invalidField = numericFields.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0);

    if (invalidField) {
      const message = `El campo ${invalidField[0]} debe ser un numero valido mayor o igual a cero.`;
      this.productsError.set(message);
      window.alert(message);
      return;
    }

    if (draft.maxStock > 0 && draft.maxStock < draft.minStock) {
      const message = 'El stock maximo no puede ser menor que el stock minimo.';
      this.productsError.set(message);
      window.alert(message);
      return;
    }

    const editingProductId = this.inventoryEditingProductId();
    const normalizedImageUrl = this.normalizeProductImageInput(draft.imageUrl) || null;
    const normalizedPrimaryLotExpiryDate = draft.primaryLotExpiryDate || null;
    this.productsError.set('');

    try {
      if (editingProductId !== null) {
        const previousProduct = this.products().find((product) => product.id === editingProductId) || null;

        const response = await this.requestUpdateInventoryStock({
          productId: editingProductId,
          sku,
          name,
          imageUrl: normalizedImageUrl,
          category: draft.category.trim() || 'General',
          primaryLotExpiryDate: normalizedPrimaryLotExpiryDate,
          stock: draft.stock,
          minStock: draft.minStock,
          maxStock: draft.maxStock || null,
          unitCost: draft.unitCost,
          salePrice: draft.salePrice,
          unitMeasure: draft.unitMeasure.trim() || 'Unidad',
          allowsDecimalQuantity: draft.allowsDecimalQuantity,
          userId: this.currentUser()?.id || null,
          user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
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
              imageUrl: response.imageUrl || normalizedImageUrl,
              category: draft.category.trim() || 'General',
              primaryLotExpiryDate: response.primaryLotExpiryDate || normalizedPrimaryLotExpiryDate,
              stock: draft.stock,
              minStock: draft.minStock,
              maxStock: draft.maxStock || null,
              unitCost: draft.unitCost,
              salePrice: draft.salePrice,
              unitMeasure: draft.unitMeasure.trim() || 'Unidad',
              allowsDecimalQuantity: draft.allowsDecimalQuantity,
            };

            return {
              ...updated,
              margin: this.productProfitMargin(updated),
            };
          }),
        );
        await this.registerProductPriceChangeAlert(previousProduct, {
          productId: editingProductId,
          productName: name,
          imageUrl: normalizedImageUrl || previousProduct?.imageUrl || null,
          previousPrice: previousProduct?.salePrice || 0,
          newPrice: draft.salePrice,
        });
        await this.loadExpiringProducts();
        this.closeInventoryModal();
        this.showInventorySuccess('Cambio realizado correctamente.');
        return;
      }

      const activeDuplicate = this.products().find((product) => this.productMatchesBarcode(product, sku.toLowerCase()));
      if (activeDuplicate) {
        const message = `No se puede crear. Ya existe un producto activo con el codigo ${sku}.`;
        this.productsError.set(message);
        window.alert(message);
        return;
      }

      const inactiveMatches = await this.requestInactiveProducts(sku);
      const inactiveDuplicate = inactiveMatches.products
        .map((product) => ({ ...product, margin: this.productMarkupRatio(product.unitCost, product.salePrice) }))
        .find((product) => product.sku.toLowerCase() === sku.toLowerCase());

      if (inactiveDuplicate) {
        const shouldReactivate = window.confirm(
          `Este codigo corresponde a un producto inactivo.\n\nProducto: ${inactiveDuplicate.name}\nCodigo: ${inactiveDuplicate.sku}\n\nDesea reactivar producto?`,
        );

        this.inactiveProducts.update((products) =>
          [...products.filter((product) => product.id !== inactiveDuplicate.id), inactiveDuplicate]
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
        this.inactiveProductsPanelOpen.set(true);

        if (shouldReactivate) {
          this.closeInventoryModal();
          this.openProductReactivationModal(inactiveDuplicate);
        }

        return;
      }

      const response = await this.requestCreateInventoryProduct({
        sku,
        name,
        imageUrl: normalizedImageUrl,
        category: draft.category.trim() || 'General',
        primaryLotExpiryDate: normalizedPrimaryLotExpiryDate,
        stock: draft.stock,
        minStock: draft.minStock,
        maxStock: draft.maxStock || null,
        unitCost: draft.unitCost,
        salePrice: draft.salePrice,
        unitMeasure: draft.unitMeasure.trim() || 'Unidad',
        allowsDecimalQuantity: draft.allowsDecimalQuantity,
        userId: this.currentUser()?.id || null,
        user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      });

      const product: Product = {
        ...response.product,
        margin: this.productMarkupRatio(response.product.unitCost, response.product.salePrice),
      };
      const nextId = Math.max(product.id, ...this.products().map((item) => item.id)) + 1;

      this.products.update((products) =>
        [...products.filter((item) => item.id !== product.id), product].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.inventoryDraft.set({
        sku: `NVO-${String(nextId).padStart(3, '0')}`,
        name: '',
        imageUrl: '',
        category: 'Camisas',
        primaryLotExpiryDate: '',
        stock: 0,
        minStock: 5,
        maxStock: 0,
        unitCost: 0,
        profitPercentage: 0,
        salePrice: 0,
        unitMeasure: 'Unidad',
        allowsDecimalQuantity: false,
      });
      await this.loadExpiringProducts();
      this.closeInventoryModal();
      this.showInventorySuccess('Producto guardado correctamente en la base de datos.');
    } catch (error) {
      const message = this.extractErrorMessage(
        error,
        'No se pudo guardar el producto. La operacion fue cancelada y la conexion con la base de datos sigue disponible.',
      );
      this.productsError.set(message);
      window.alert(message);
    }
  }

  protected async deactivateInventoryProduct(product: Product): Promise<void> {
    const confirmed = await this.confirmInventoryUi(`Inactivar ${product.name}. Ya no se mostrará en facturación ni en inventario activo.`);

    if (!confirmed) {
      return;
    }

    try {
      await this.requestUpdateProductActiveStatus({
        productId: product.id,
        active: false,
        userId: this.currentUser()?.id || null,
        user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      });

      this.products.update((products) => products.filter((item) => item.id !== product.id));
      this.showInventorySuccess(`${product.name} fue inactivado correctamente.`);
    } catch (error) {
      const message = this.extractErrorMessage(error, 'No se pudo inactivar el producto.');
      this.productsError.set(message);
      this.showInventorySuccess(message, 'error');
    }
  }

  private async registerProductPriceChangeAlert(
    previousProduct: Product | null,
    change: {
      productId: number;
      productName: string;
      imageUrl: string | null;
      previousPrice: number;
      newPrice: number;
    },
  ): Promise<void> {
    const previousPrice = Number(change.previousPrice || 0);
    const newPrice = Number(change.newPrice || 0);

    if (!previousProduct || !Number.isFinite(previousPrice) || !Number.isFinite(newPrice) || previousPrice === newPrice) {
      return;
    }

    const changedAt = new Date().toISOString();
    await this.createAuditHistoryRecord({
      tableName: 'dbo.producto',
      action: 'CAMBIO_PRECIO',
      recordKey: `id_producto=${change.productId}`,
      userId: this.currentUser()?.id || null,
      user: this.currentUser()?.nombre || this.currentUser()?.usuario || null,
      previousData: JSON.stringify({
        productId: change.productId,
        productName: previousProduct.name,
        previousPrice,
      }),
      newData: JSON.stringify({
        productId: change.productId,
        productName: change.productName,
        imageUrl: change.imageUrl,
        previousPrice,
        newPrice,
        changedAt,
      }),
    });

    await this.loadAuditHistory();
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO MANDA A GUARDAR LOS CAMBIOS DE STOCK DEL MODAL DE INVENTARIO.
  // SI USA API HTTP, LLAMA PUT /api/products/:productId/inventory UBICADO EN server/server.js.
  // SI USA ELECTRON, LLAMA window.electronAPI.updateInventoryStockLevels() EXPUESTO EN electron/preload.js.
  // AMBOS FLUJOS TERMINAN EJECUTANDO updateInventoryStockLevels() EN server/data-access.js,
  // DONDE ESTA UBICADA LA CONSULTA UPDATE dbo.inventario.
  private async requestUpdateInventoryStock(payload: {
    productId: number;
    sku: string;
    name: string;
    imageUrl: string | null;
    category: string;
    primaryLotExpiryDate: string | null;
    stock: number;
    minStock: number;
    maxStock: number | null;
    unitCost: number;
    salePrice: number;
    unitMeasure: string;
    allowsDecimalQuantity: boolean;
    userId?: number | null;
    user?: string | null;
  }): Promise<InventoryStockUpdateResponse> {
    if (this.desktopApi) {
      return this.desktopApi.updateInventoryStockLevels(payload);
    }

    return firstValueFrom(
      this.http.put<InventoryStockUpdateResponse>(`/api/products/${payload.productId}/inventory`, payload),
    );
  }

  private async requestCreateInventoryProduct(payload: {
    sku: string;
    name: string;
    imageUrl: string | null;
    category: string;
    primaryLotExpiryDate: string | null;
    stock: number;
    minStock: number;
    maxStock: number | null;
    unitCost: number;
    salePrice: number;
    unitMeasure: string;
    allowsDecimalQuantity: boolean;
    userId?: number | null;
    user?: string | null;
  }): Promise<ProductCreateResponse> {
    if (this.desktopApi) {
      return this.desktopApi.createInventoryProduct(payload);
    }

    return firstValueFrom(this.http.post<ProductCreateResponse>('/api/products', payload));
  }

  private async requestProductBarcodes(productId: number): Promise<ProductBarcodesResponse> {
    if (this.desktopApi?.getProductBarcodes) {
      return this.desktopApi.getProductBarcodes(productId);
    }

    return firstValueFrom(
      this.http.get<ProductBarcodesResponse>(`/api/products/${encodeURIComponent(productId)}/barcodes`),
    );
  }

  private async requestCreateProductBarcode(payload: {
    productId: number;
    code: string;
    userId?: number | null;
    user?: string | null;
  }): Promise<ProductBarcodesResponse> {
    if (this.desktopApi?.createProductBarcode) {
      return this.desktopApi.createProductBarcode(payload);
    }

    return firstValueFrom(
      this.http.post<ProductBarcodesResponse>(`/api/products/${encodeURIComponent(payload.productId)}/barcodes`, payload),
    );
  }

  private async requestSetPrimaryProductBarcode(payload: {
    productId: number;
    barcodeId: number;
    userId?: number | null;
    user?: string | null;
  }): Promise<ProductBarcodesResponse> {
    if (this.desktopApi?.setPrimaryProductBarcode) {
      return this.desktopApi.setPrimaryProductBarcode(payload);
    }

    return firstValueFrom(
      this.http.put<ProductBarcodesResponse>(
        `/api/products/${encodeURIComponent(payload.productId)}/barcodes/${encodeURIComponent(payload.barcodeId)}/primary`,
        payload,
      ),
    );
  }

  private async requestUpdateProductBarcodeStatus(payload: {
    productId: number;
    barcodeId: number;
    active: boolean;
    userId?: number | null;
    user?: string | null;
  }): Promise<ProductBarcodesResponse> {
    if (this.desktopApi?.updateProductBarcodeStatus) {
      return this.desktopApi.updateProductBarcodeStatus(payload);
    }

    return firstValueFrom(
      this.http.put<ProductBarcodesResponse>(
        `/api/products/${encodeURIComponent(payload.productId)}/barcodes/${encodeURIComponent(payload.barcodeId)}/status`,
        payload,
      ),
    );
  }

  private async requestInactiveProducts(search = ''): Promise<InactiveProductsResponse> {
    if (this.desktopApi?.getInactiveProducts) {
      return this.desktopApi.getInactiveProducts(search);
    }

    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return firstValueFrom(this.http.get<InactiveProductsResponse>(`/api/products/inactive${query}`));
  }

  protected async fetchInactiveProducts(): Promise<void> {
    this.inactiveProductsLoading.set(true);
    this.inactiveProductsError.set('');

    try {
      const response = await this.requestInactiveProducts('');
      this.inactiveProducts.set(
        response.products.map((product) => ({
          ...product,
          margin: this.productMarkupRatio(product.unitCost, product.salePrice),
        })),
      );
      this.inactiveProductsPage.set(1);
    } catch (error) {
      this.inactiveProducts.set([]);
      this.inactiveProductsError.set(this.extractErrorMessage(error, 'No se pudieron cargar los productos inactivos.'));
    } finally {
      this.inactiveProductsLoading.set(false);
    }
  }

  private async requestReactivateInventoryProduct(payload: {
    productId: number;
    nuevoCosto: number;
    nuevoPrecioVenta: number;
    stockReingreso: number;
    userId: number;
    user: string;
  }): Promise<ProductReactivationResponse> {
    if (this.desktopApi?.reactivateInventoryProduct) {
      return this.desktopApi.reactivateInventoryProduct(payload);
    }

    return firstValueFrom(
      this.http.put<ProductReactivationResponse>(`/api/products/${payload.productId}/reactivate`, payload),
    );
  }

  private async requestUpdateProductActiveStatus(payload: {
    productId: number;
    active: boolean;
    userId?: number | null;
    user?: string | null;
  }): Promise<{ productId: number; active: boolean }> {
    if (this.desktopApi) {
      return this.desktopApi.updateProductActiveStatus(payload);
    }

    return firstValueFrom(
      this.http.put<{ productId: number; active: boolean }>(`/api/products/${payload.productId}/status`, payload),
    );
  }

  protected addToCart(productId: number): void {
    const product = this.products().find((item) => item.id === productId);
    if (!product) {
      this.scheduleBillingSearchFocus();
      return;
    }

    const quantityStep = this.cartQuantityStep(product);

    if (this.activeMode() === 'sale' && Number(product.stock || 0) <= 0) {
      this.showSaleSuccess('El articulo esta en cero y no puede ser facturado.', 'error');
      this.scheduleBillingSearchFocus();
      return;
    }

    this.cart.update((lines) => {
      const existing = lines.find((line) => line.productId === productId);
      if (existing) {
        const nextQuantity = this.normalizeCartQuantity(product, existing.quantity + quantityStep);

        if (this.activeMode() === 'sale' && nextQuantity > Number(product.stock || 0)) {
          this.showSaleSuccess('La cantidad supera el stock disponible.', 'error');
          return lines;
        }

        return lines.map((line) =>
          line.productId === productId ? { ...line, quantity: nextQuantity } : line,
        );
      }

      const initialQuantity = this.activeMode() === 'sale' && product.allowsDecimalQuantity
        ? Math.min(1, Number(product.stock || 0))
        : 1;
      return [
        { productId, quantity: this.normalizeCartQuantity(product, initialQuantity) },
        ...lines,
      ];
    });
    this.searchTerm.set('');
    this.billingPage.set(1);

    if (this.activeMode() === 'purchase') {
      this.purchaseCosts.update((costs) => ({
        ...costs,
        [productId]: costs[productId] ?? product.unitCost,
      }));
      return;
    }

    this.salePrices.update((prices) => ({
      ...prices,
      [productId]: prices[productId] ?? product.salePrice,
    }));
    this.scheduleBillingSearchFocus();
  }

  protected openCustomerDisplay(): void {
    const displayWindow = window.open('', 'yahweh-rohi-customer-display', 'width=980,height=720');

    if (!displayWindow) {
      this.showSaleSuccess('No se pudo abrir la pantalla del cliente. Revisa si el navegador bloqueo ventanas emergentes.', 'error');
      return;
    }

    this.customerDisplayWindow = displayWindow;
    this.syncCustomerDisplayWindow();
    displayWindow.focus();
  }

  private syncCustomerDisplayWindow(): void {
    if (!this.customerDisplayWindow || this.customerDisplayWindow.closed) {
      this.customerDisplayWindow = null;
      return;
    }

    this.customerDisplayWindow.document.open();
    this.customerDisplayWindow.document.write(this.customerDisplayHtml());
    this.customerDisplayWindow.document.close();
  }

  private customerDisplayHtml(): string {
    const lines = [...this.cartDetails()].reverse();
    const session = this.activeMode() + ':' + this.activeBillingInvoiceId();
    if (session !== this.customerDisplaySession) {
      this.customerDisplayPreviousItems.clear();
      this.customerDisplayHighlightId = null;
      this.customerDisplaySession = session;
    }
    const addedLine = lines.find(line => line.quantity > (this.customerDisplayPreviousItems.get(line.productId) ?? 0));
    if (addedLine) {
      this.customerDisplayHighlightId = addedLine.productId;
      this.customerDisplayHighlightUntil = Date.now() + 1600;
    }
    this.customerDisplayPreviousItems = new Map(lines.map(line => [line.productId, line.quantity]));
    const highlightRemaining = Math.max(0, this.customerDisplayHighlightUntil - Date.now());
    const customerDisplayLogoUrl = this.escapeHtml(
      new URL('assets/img/yahweh-rohi-customer-display-logo.png', window.location.href).href,
    );
    const rowsHtml = lines.length
      ? lines.map((line) => {
          const imageHtml = line.product.imageUrl
            ? `<span aria-hidden="true">${this.escapeHtml(line.product.name.slice(0, 2).toUpperCase())}</span><img src="${this.escapeHtml(this.printableImageUrl(line.product.imageUrl))}" alt="" onerror="this.remove()" />`
            : `<span>${this.escapeHtml(line.product.name.slice(0, 2).toUpperCase())}</span>`;
          return `
            <article class="line${line.productId === this.customerDisplayHighlightId && highlightRemaining > 0 ? ' recently-added' : ''}" style="--highlight-duration: ${highlightRemaining}ms">
              <div class="thumb">${imageHtml}</div>
              <div class="product">
                <strong>${this.escapeHtml(line.product.name)}</strong>
              </div>
              <div class="qty">x ${this.escapeHtml(this.formatCartQuantity(line.quantity))}</div>
              <div class="amount">${this.escapeHtml(this.formatCurrency(line.subtotal))}</div>
            </article>
          `;
        }).join('')
      : '<div class="empty"><span class="welcome-mark" aria-hidden="true">✓</span><h2>Bienvenido a Yahweh Rohi</h2><p>Estamos listos para atenderte.</p><small>Aquí podrás revisar los productos de tu compra.</small></div>';

    return `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Pantalla del cliente</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            :root { color-scheme: light; --yr-bg: #f2f5f7; --yr-surface: #fff; --yr-soft: #f5f8fa; --yr-border: #cbd8df; --yr-text: #20343f; --yr-muted: #536a76; --yr-primary: #087568; --yr-primary-soft: #e1f3ed; --yr-shadow: 0 6px 18px rgb(32 52 63 / 5%); }
            * { box-sizing: border-box; }
            body { margin: 0; background: var(--yr-bg); color: var(--yr-text); font-family: Arial, Helvetica, sans-serif; }
            main { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; height: 100dvh; min-height: 440px; gap: 16px; padding: 24px; }
            header { display: grid; grid-template-columns: minmax(90px, 130px) minmax(0, 1fr) minmax(140px, 190px); align-items: center; gap: 16px; padding: 12px 18px; border: 1px solid var(--yr-border); border-radius: 24px; background: var(--yr-surface); box-shadow: var(--yr-shadow); }
            .brand-logo { width: 100%; max-height: 64px; object-fit: contain; }
            .brand { min-width: 0; text-align: center; }
            h1 { margin: 0; color: var(--yr-primary); font-size: clamp(1.3rem, 2.4vw, 2rem); line-height: 1.1; letter-spacing: -.03em; }
            .customer { margin: 5px 0 0; color: var(--yr-text); font-size: clamp(1rem, 1.8vw, 1.3rem); font-weight: 600; overflow-wrap: anywhere; }
            .invoice { padding: 12px 16px; text-align: center; border: 1px solid var(--yr-border); border-radius: 16px; background: var(--yr-soft); }
            .invoice span, .total-card span, .change-card span { display: block; font-size: .85rem; font-weight: 600; color: var(--yr-muted); }
            .invoice strong { display: block; margin-top: 5px; color: var(--yr-primary); font-size: clamp(1rem, 1.7vw, 1.5rem); overflow-wrap: anywhere; }
            .list { display: grid; align-content: start; gap: 10px; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--yr-border) transparent; padding: 2px; }
            .line { display: grid; grid-template-columns: 74px minmax(0, 1fr) minmax(64px, auto) minmax(110px, auto); align-items: center; gap: 18px; padding: 12px 16px; border: 1px solid var(--yr-border); border-radius: 16px; background: var(--yr-surface); box-shadow: var(--yr-shadow); transition: border-color 180ms ease, background-color 180ms ease; }
            .line.recently-added { animation: customer-item-highlight var(--highlight-duration, 1600ms) ease-out both; }
            @keyframes customer-item-highlight { from { background: var(--yr-primary-soft); border-color: var(--yr-primary); } to { background: var(--yr-surface); border-color: var(--yr-border); } }
            .line:hover { border-color: var(--yr-primary); background: var(--yr-soft); }
            .thumb { display: grid; place-items: center; width: 74px; height: 74px; overflow: hidden; border: 1px solid var(--yr-border); border-radius: 12px; background: var(--yr-soft); color: var(--yr-muted); font-weight: 700; }
            .thumb img { width: 100%; height: 100%; object-fit: contain; }
            .product { display: grid; gap: 6px; min-width: 0; }
            .product strong { font-size: clamp(1.1rem, 2.2vw, 1.8rem); line-height: 1.25; overflow-wrap: anywhere; }
            .product span { color: var(--yr-muted); font-size: .85rem; }
            .qty, .amount { font-size: clamp(1.1rem, 2.2vw, 1.8rem); font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
            .qty { color: var(--yr-muted); }
            footer { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 14px; }
            .total-card, .change-card { display: grid; align-content: center; gap: 12px; padding: 20px 24px; border: 1px solid var(--yr-border); border-radius: 24px; box-shadow: var(--yr-shadow); }
            .total-card { background: var(--yr-primary-soft); border-color: #0875684d; color: var(--yr-primary); }
            .total-card span { color: var(--yr-primary); }
            .change-card { background: var(--yr-surface); color: var(--yr-text); }
            .total-card strong { font-size: clamp(2.2rem, 6vw, 5rem); line-height: 1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
            .change-card strong { font-size: clamp(1.6rem, 3.2vw, 2.8rem); line-height: 1; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
            .empty { display: grid; place-items: center; min-height: 180px; padding: 24px; margin: 0; border: 1px dashed var(--yr-border); border-radius: 16px; background: var(--yr-surface); color: var(--yr-muted); font-size: 1.1rem; text-align: center; }
            @media (max-width: 680px) {
              main { padding: 12px; gap: 12px; }
              header { grid-template-columns: 64px minmax(0, 1fr); padding: 14px; gap: 12px; }
              .invoice { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }
              .invoice strong { margin: 0; }
              .line { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; padding: 10px; }
              .thumb { width: 44px; height: 44px; }
              .amount { grid-column: 2 / -1; }
              .total-card, .change-card { padding: 14px; border-radius: 16px; }
              footer { gap: 8px; }
            }
            /* Customer-facing hierarchy: stable columns and quiet payment details. */
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
            main { max-width: 1800px; margin: auto; }
            header { border-radius: 18px; }
            .brand { text-align: left; }
            h1 { font-size: clamp(1.25rem, 2vw, 1.8rem); }
            .customer { font-weight: 500; color: var(--yr-muted); font-size: 1rem; }
            .purchase-detail { display: grid; grid-template-rows: auto auto minmax(0, 1fr); min-height: 0; overflow: hidden; padding: 18px; border: 1px solid var(--yr-border); border-radius: 20px; background: var(--yr-surface); }
            .purchase-detail:has(.empty) { grid-template-rows: auto minmax(0, 1fr); }
            .detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
            .detail-heading h2 { margin: 0; font-size: 1.1rem; font-weight: 650; }
            .detail-heading > span { background: var(--yr-soft); color: var(--yr-muted); padding: 5px 10px; border-radius: 20px; font-size: .8rem; }
            .columns, .line { grid-template-columns: 60px minmax(0, 1fr) 110px 170px; gap: 20px; }
            .columns { display: grid; padding: 0 14px 10px; color: var(--yr-muted); font-size: .75rem; font-weight: 600; }
            .columns span:first-child { grid-column: 1 / 3; }
            .columns span:not(:first-child) { text-align: right; }
            .list { gap: 8px; padding: 0; }
            .line { padding: 12px 14px; border-color: transparent; border-bottom-color: var(--yr-border); border-radius: 12px; box-shadow: none; }
            .thumb { position: relative; width: 60px; height: 60px; background: var(--yr-soft); }
            .thumb img { position: absolute; inset: 0; background: #fff; }
            .product strong { font-size: clamp(1rem, 1.8vw, 1.5rem); font-weight: 600; }
            .qty, .amount { font-size: clamp(1rem, 1.8vw, 1.5rem); }
            .qty { font-weight: 500; }
            .total-card { border-radius: 20px; box-shadow: none; }
            .total-card strong { font-weight: 700; letter-spacing: -.04em; }
            .payment-details { display: grid; align-content: center; gap: 14px; padding: 18px 22px; border: 1px solid var(--yr-border); border-radius: 20px; background: #fff; }
            .received-card, .change-card { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 0; border: 0; border-radius: 0; box-shadow: none; }
            .received-card { padding-bottom: 14px; border-bottom: 1px solid var(--yr-border); }
            .received-card span, .change-card span { color: var(--yr-muted); font-size: .9rem; font-weight: 500; }
            .received-card strong { font-size: clamp(1rem, 2vw, 1.6rem); font-variant-numeric: tabular-nums; }
            .change-card strong { font-size: clamp(1.2rem, 2.5vw, 2rem); }
            .empty { display: flex; flex-direction: column; justify-content: center; gap: 12px; border: 0; min-height: 240px; }
            .empty h2 { margin: 0; color: var(--yr-text); font-size: 1.5rem; }
            .empty p { margin: 0; }
            .empty small { font-size: .9rem; }
            .welcome-mark { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: var(--yr-primary-soft); color: var(--yr-primary); font-size: 1.6rem; margin-bottom: 8px; }
            @media (max-width: 680px) {
              .purchase-detail { padding: 12px; }
              .columns { display: none; }
              .purchase-detail { grid-template-rows: auto minmax(0, 1fr); }
              .line { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; padding: 10px 0; }
              .thumb { width: 44px; height: 44px; }
              .amount { grid-column: 2 / -1; }
              footer { grid-template-columns: 1fr; }
              .total-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
              .total-card strong { font-size: 2rem; }
              .payment-details { padding: 12px 14px; gap: 8px; }
              .received-card { padding-bottom: 8px; }
            }
            @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
          </style>
        </head>
        <body>
          <main>
            <header>
              <img class="brand-logo" src="${customerDisplayLogoUrl}" alt="Yahweh Rohi" />
              <div class="brand">
                <h1>Yahweh Rohi</h1>
                <p class="customer">${this.escapeHtml(this.selectedCustomer() || 'Cliente final')}</p>
              </div>
              <div class="invoice">
                <span>Factura</span>
                <strong>#${this.escapeHtml(String(this.nextInvoiceNumber() || '...'))}</strong>
              </div>
            </header>
            <section class="purchase-detail" aria-label="Detalle de tu compra">
              <div class="detail-heading"><h2>Tu compra</h2><span>${lines.length} ${lines.length === 1 ? 'producto' : 'productos'}</span></div>
              ${lines.length ? '<div class="columns" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Importe</span></div>' : ''}
              <div class="list">${rowsHtml}</div>
            </section>
            <footer>
              <div class="total-card">
                <span>Total a pagar</span>
                <strong>${this.escapeHtml(this.formatCurrency(this.cartTotal()))}</strong>
              </div>
              <div class="payment-details">
                <div class="received-card"><span>Recibido</span><strong>${this.escapeHtml(this.formatCurrency(Number(this.saleReceivedAmount()) || 0))}</strong></div>
                <div class="change-card"><span>Vuelto</span><strong>${this.escapeHtml(this.formatCurrency(this.saleChangeDue()))}</strong></div>
              </div>
            </footer>
          </main>
        </body>
      </html>
    `;
  }

  protected openOrderInvoiceWindow(): void {
    if (this.orderInvoiceSessions().length === 0) {
      this.createOrderInvoiceSession();
      return;
    }

    this.orderInvoiceModalOpen.set(true);
  }

  protected createOrderInvoiceSession(): void {
    const id = `order-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const sessionNumber = this.orderInvoiceSessions().length + 1;
    const session: OrderInvoiceSession = {
      id,
      title: `Factura ${sessionNumber}`,
      customerName: 'Cliente final',
      customerId: null,
      paymentMethod: 'efectivo',
      fileName: '',
      lines: [],
      receivedAmount: '',
      error: '',
      saving: false,
      createdAt: new Date().toISOString(),
    };

    this.orderInvoiceSessions.update((sessions) => [...sessions, session]);
    this.activeOrderInvoiceId.set(id);
    this.orderInvoiceModalOpen.set(true);
  }

  protected closeOrderInvoiceWindow(): void {
    this.orderInvoiceModalOpen.set(false);
  }

  protected selectOrderInvoiceSession(sessionId: string): void {
    this.activeOrderInvoiceId.set(sessionId);
  }

  protected closeOrderInvoiceSession(sessionId: string): void {
    const remaining = this.orderInvoiceSessions().filter((session) => session.id !== sessionId);
    this.orderInvoiceSessions.set(remaining);

    if (this.activeOrderInvoiceId() === sessionId) {
      this.activeOrderInvoiceId.set(remaining[remaining.length - 1]?.id || '');
    }

    if (remaining.length === 0) {
      this.orderInvoiceModalOpen.set(false);
    }
  }

  protected async importOrderCsvToWindow(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';

    if (!file) {
      return;
    }

    let session = this.activeOrderInvoice();
    if (!session) {
      this.createOrderInvoiceSession();
      session = this.activeOrderInvoice();
    }

    if (!session) {
      return;
    }

    this.updateOrderInvoiceSession(session.id, { error: '', fileName: file.name });
    this.orderCsvImporting.set(true);
    this.orderCsvFileName.set(file.name);

    try {
      const text = await this.readTextFile(file);
      const order = this.parseOrderCsv(text);

      if (this.products().length === 0) {
        await this.fetchProducts();
      }

      if (this.customerOptions().length === 0) {
        await this.loadCustomers();
      }

      const customerMatch = this.findCustomerByName(order.customerName);
      const lines = this.buildOrderInvoiceReviewLines(order.lines);
      const blocked = lines.filter((line) => line.status !== 'ready').length;

      this.updateOrderInvoiceSession(session.id, {
        title: order.customerName ? order.customerName : session.title,
        customerName: order.customerName || session.customerName,
        customerId: customerMatch?.id ?? null,
        paymentMethod: order.paymentMethod || session.paymentMethod,
        fileName: file.name,
        lines,
        error: blocked ? `${blocked} producto(s) requieren revision antes de facturar.` : '',
      });
    } catch (error) {
      this.updateOrderInvoiceSession(session.id, {
        error: this.extractErrorMessage(error, 'No se pudo cargar el pedido CSV.'),
      });
    } finally {
      this.orderCsvImporting.set(false);
    }
  }

  protected updateOrderInvoicePaymentMethod(event: Event): void {
    const session = this.activeOrderInvoice();
    if (!session) {
      return;
    }

    const paymentMethod = ((event.target as HTMLSelectElement).value || 'efectivo') as PaymentMethod;
    this.updateOrderInvoiceSession(session.id, { paymentMethod, error: '' });
  }

  protected updateOrderInvoiceReceivedAmount(event: Event): void {
    const session = this.activeOrderInvoice();
    if (!session) {
      return;
    }

    this.updateOrderInvoiceSession(session.id, { receivedAmount: (event.target as HTMLInputElement).value });
  }

  protected removeOrderInvoiceLine(lineId: string): void {
    const session = this.activeOrderInvoice();
    if (!session) {
      return;
    }

    const lines = session.lines.filter((line) => line.id !== lineId);
    const blocked = lines.filter((line) => line.status !== 'ready').length;
    this.updateOrderInvoiceSession(session.id, {
      lines,
      error: blocked ? `${blocked} producto(s) requieren revision antes de facturar.` : '',
    });
  }

  protected async completeOrderInvoiceSession(): Promise<void> {
    const session = this.activeOrderInvoice();
    const currentUser = this.currentUser();

    if (!session || !currentUser) {
      return;
    }

    if (session.lines.length === 0) {
      this.updateOrderInvoiceSession(session.id, { error: 'Carga un CSV o agrega productos antes de facturar.' });
      return;
    }

    if (this.activeOrderInvoiceBlockedLines().length > 0) {
      this.updateOrderInvoiceSession(session.id, { error: 'Elimina manualmente los productos marcados en rojo antes de facturar.' });
      return;
    }

    const readyLines = this.activeOrderInvoiceReadyLines();
    if (readyLines.length === 0) {
      this.updateOrderInvoiceSession(session.id, { error: 'No hay productos disponibles para facturar.' });
      return;
    }

    if (session.paymentMethod === 'credito' && !session.customerId) {
      this.updateOrderInvoiceSession(session.id, { error: 'Selecciona un cliente registrado para facturar al credito.' });
      return;
    }

    this.updateOrderInvoiceSession(session.id, { saving: true, error: '' });

    try {
      await this.requestCreateSale({
        user: currentUser.nombre || currentUser.usuario,
        userId: currentUser.id,
        paymentTypeId: this.paymentTypeIdFromMethod(session.paymentMethod),
        customerId: session.customerId,
        lines: readyLines.map((line) => ({
          productId: line.product!.id,
          quantity: line.quantity,
          unitCost: line.product!.unitCost,
          salePrice: line.salePrice,
        })),
        quoteId: null,
      });

      await this.fetchProducts();
      await this.loadNextInvoiceNumber();
      await this.loadDashboardSalesSummary();
      await this.loadDashboardSalesTrend();
      await this.loadSalesDropAlert();
      if (session.paymentMethod === 'credito') {
        await this.loadCredits();
        await this.loadCustomers();
      }
      if (this.activePage() === 'billing' || this.dailySalesModalOpen()) {
        await this.loadTodayInvoices();
      }
      if (this.cutModalOpen()) {
        await this.loadDailyCuts();
      }

      this.showSaleSuccess(`Factura CSV generada correctamente para ${session.customerName}.`);
      this.closeOrderInvoiceSession(session.id);
    } catch (error) {
      this.updateOrderInvoiceSession(session.id, {
        saving: false,
        error: this.extractErrorMessage(error, 'No se pudo registrar la factura CSV.'),
      });
    }
  }

  private updateOrderInvoiceSession(sessionId: string, patch: Partial<OrderInvoiceSession>): void {
    this.orderInvoiceSessions.update((sessions) =>
      sessions.map((session) => session.id === sessionId ? { ...session, ...patch } : session),
    );
  }

  private buildOrderInvoiceReviewLines(lines: OrderCsvLine[]): OrderCsvReviewLine[] {
    return lines.map((line, index) => {
      const product = this.findProductForOrderCsvLine(line, this.products());
      const quantity = this.normalizeCartQuantity(product, line.quantity);
      const salePrice = line.salePrice && line.salePrice > 0 ? this.roundMoney(line.salePrice) : product?.salePrice || 0;
      const stock = Number(product?.stock || 0);
      let status: OrderCsvReviewLine['status'] = 'ready';
      let issue = '';

      if (!product) {
        status = 'missing';
        issue = 'Producto no encontrado';
      } else if (quantity <= 0) {
        status = 'invalid';
        issue = 'Cantidad invalida';
      } else if (stock <= 0) {
        status = 'out-of-stock';
        issue = 'Producto en cero';
      } else if (quantity > stock) {
        status = 'insufficient-stock';
        issue = `Stock insuficiente: ${this.formatNumber(stock)} disponible`;
      }

      return {
        id: `${Date.now()}-${index}-${line.productCode || line.productName}`,
        product,
        productName: line.productName,
        productCode: line.productCode,
        quantity,
        salePrice,
        subtotal: salePrice * quantity,
        status,
        issue,
      };
    });
  }

  private findCustomerByName(customerName: string): CustomerOption | null {
    const normalizedCustomerName = this.normalizeSearchText(customerName);
    if (!normalizedCustomerName) {
      return null;
    }

    return this.customerOptions().find((option) => {
      const fullName = `${option.nombre || ''} ${option.apellido || ''}`;
      return this.normalizeSearchText(fullName) === normalizedCustomerName;
    }) || null;
  }

  private paymentTypeIdFromMethod(paymentMethod: PaymentMethod): number {
    return this.paymentMethodOptions.find((option) => option.id === paymentMethod)?.paymentTypeId || 1;
  }

  protected async importOrderCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';

    if (!file) {
      return;
    }

    this.orderCsvImporting.set(true);
    this.orderCsvFileName.set(file.name);
    this.checkoutError.set('');

    try {
      const text = await this.readTextFile(file);
      const order = this.parseOrderCsv(text);

      if (order.lines.length === 0) {
        this.checkoutError.set('El archivo CSV no contiene productos para cargar.');
        return;
      }

      if (this.products().length === 0) {
        await this.fetchProducts();
      }

      if (this.customerOptions().length === 0) {
        await this.loadCustomers();
      }

      const products = this.products();
      const importedLines: CartLine[] = [];
      const importedPrices: Record<number, number> = {};
      const errors: string[] = [];

      this.activeMode.set('sale');

      for (const line of order.lines) {
        const product = this.findProductForOrderCsvLine(line, products);

        if (!product) {
          errors.push(`No encontrado: ${line.productName || line.productCode}`);
          continue;
        }

        const quantity = this.normalizeCartQuantity(product, line.quantity);

        if (quantity <= 0) {
          errors.push(`Cantidad invalida: ${product.name}`);
          continue;
        }

        if (quantity > Number(product.stock || 0)) {
          errors.push(`Stock insuficiente: ${product.name} (${this.formatNumber(product.stock)} disponible)`);
          continue;
        }

        importedLines.push({ productId: product.id, quantity });
        importedPrices[product.id] = line.salePrice && line.salePrice > 0 ? this.roundMoney(line.salePrice) : product.salePrice;
      }

      if (importedLines.length === 0) {
        this.checkoutError.set(`No se cargo ningun producto. ${errors.slice(0, 4).join(' | ')}`);
        return;
      }

      this.mergeOrderCsvLinesIntoCart(importedLines);
      this.salePrices.update((prices) => ({ ...prices, ...importedPrices }));

      if (order.paymentMethod) {
        this.selectedPaymentMethod.set(order.paymentMethod);
      }

      if (order.customerName) {
        this.applyOrderCsvCustomer(order.customerName);
      }

      this.billingPage.set(1);
      this.searchTerm.set('');

      const warning = errors.length ? ` No cargados: ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? '...' : ''}` : '';
      this.showSaleSuccess(`Pedido CSV cargado: ${importedLines.length} producto(s).${warning}`, errors.length ? 'error' : 'success');
    } catch (error) {
      this.checkoutError.set(this.extractErrorMessage(error, 'No se pudo cargar el pedido CSV.'));
      this.showSaleSuccess('No se pudo cargar el pedido CSV.', 'error');
    } finally {
      this.orderCsvImporting.set(false);
    }
  }

  private readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo CSV.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  private parseOrderCsv(text: string): OrderCsvData {
    const rows = this.parseCsvRows(text);

    if (rows.length < 2) {
      return { customerName: '', paymentMethod: null, lines: [] };
    }

    const headers = rows[0].map((header) => this.normalizeCsvHeader(header));
    const dataRows = rows.slice(1);
    let customerName = '';
    let paymentMethod: PaymentMethod | null = null;
    const lines: OrderCsvLine[] = [];

    for (const row of dataRows) {
      const productName = this.csvCell(row, headers, ['producto', 'nombre_producto', 'product', 'name']);
      const productCode = this.csvCell(row, headers, ['codigo', 'codigo_barra', 'codigo_de_barra', 'sku', 'id_producto', 'producto_id']);
      const quantity = this.parseCsvNumber(this.csvCell(row, headers, ['cantidad', 'qty', 'quantity']));
      const salePrice = this.parseCsvOptionalNumber(this.csvCell(row, headers, ['precio_unitario_l', 'precio_unitario', 'precio', 'sale_price', 'precio_venta']));
      const rowCustomerName = this.csvCell(row, headers, ['cliente', 'customer', 'nombre_cliente']);
      const rowPaymentMethod = this.csvCell(row, headers, ['metodo_de_pago', 'metodo_pago', 'forma_de_pago', 'forma_pago', 'payment_method']);

      if (!customerName && rowCustomerName) {
        customerName = rowCustomerName;
      }

      if (!paymentMethod && rowPaymentMethod) {
        paymentMethod = this.mapOrderCsvPaymentMethod(rowPaymentMethod);
      }

      if (this.isOrderCsvTotalRow(row, productName, productCode)) {
        continue;
      }

      if ((!productName && !productCode) || quantity <= 0) {
        continue;
      }

      lines.push({ productName, productCode, quantity, salePrice });
    }

    return { customerName, paymentMethod, lines };
  }

  private parseCsvRows(text: string): string[][] {
    const delimiter = this.detectCsvDelimiter(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          index += 1;
        }

        row.push(cell.trim());
        if (row.some((value) => value.length > 0)) {
          rows.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }

    return rows;
  }

  private detectCsvDelimiter(text: string): string {
    const firstLine = String(text || '').split(/\r?\n/)[0] || '';
    const candidates = [',', ';', '\t'];
    let selected = ',';
    let selectedCount = -1;
    let inQuotes = false;
    const counts = new Map<string, number>(candidates.map((candidate) => [candidate, 0]));

    for (let index = 0; index < firstLine.length; index += 1) {
      const char = firstLine[index];

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && counts.has(char)) {
        counts.set(char, (counts.get(char) || 0) + 1);
      }
    }

    for (const candidate of candidates) {
      const count = counts.get(candidate) || 0;
      if (count > selectedCount) {
        selected = candidate;
        selectedCount = count;
      }
    }

    return selected;
  }

  private csvCell(row: string[], headers: string[], names: string[]): string {
    const indexes = names.map((name) => headers.indexOf(name)).filter((index) => index >= 0);
    const index = indexes[0];
    return index === undefined ? '' : String(row[index] || '').trim();
  }

  private normalizeCsvHeader(value: string): string {
    return this.normalizeText(value)
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private parseCsvNumber(value: string): number {
    const normalized = String(value || '').replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseCsvOptionalNumber(value: string): number | null {
    const parsed = this.parseCsvNumber(value);
    return parsed > 0 ? parsed : null;
  }

  private isOrderCsvTotalRow(row: string[], productName: string, productCode: string): boolean {
    const normalizedCells = row.map((cell) => this.normalizeText(cell));
    return (
      normalizedCells.some((cell) => cell === 'total' || cell === 'total:') ||
      this.normalizeText(productName) === 'total' ||
      this.normalizeText(productCode) === 'total'
    );
  }

  private mapOrderCsvPaymentMethod(value: string): PaymentMethod | null {
    const normalized = this.normalizeText(value);

    if (normalized.includes('credito')) {
      return 'credito';
    }

    if (normalized.includes('transfer')) {
      return 'transferencia';
    }

    if (normalized.includes('efectivo') || normalized.includes('cash')) {
      return 'efectivo';
    }

    return null;
  }

  private findProductForOrderCsvLine(line: OrderCsvLine, products: Product[]): Product | null {
    const normalizedCode = this.normalizeSearchText(line.productCode);
    const normalizedName = this.normalizeSearchText(line.productName);

    if (normalizedCode) {
      const byCode = products.find((product) =>
        this.normalizeSearchText(product.sku) === normalizedCode ||
        this.normalizeSearchText(String(product.id)) === normalizedCode ||
        this.normalizeSearchText(product.primaryLotNumber || '') === normalizedCode,
      );

      if (byCode) {
        return byCode;
      }
    }

    if (!normalizedName) {
      return null;
    }

    return (
      products.find((product) => this.normalizeSearchText(product.name) === normalizedName) ||
      products.find((product) => this.normalizeSearchText(product.sku) === normalizedName) ||
      products.find((product) => {
        const productName = this.normalizeSearchText(product.name);
        return productName.includes(normalizedName) || normalizedName.includes(productName);
      }) ||
      null
    );
  }

  private mergeOrderCsvLinesIntoCart(importedLines: CartLine[]): void {
    this.cart.update((lines) => {
      const quantities = new Map<number, number>();

      for (const line of lines) {
        quantities.set(line.productId, line.quantity);
      }

      for (const line of importedLines) {
        const product = this.products().find((item) => item.id === line.productId);
        const currentQuantity = quantities.get(line.productId) || 0;
        const nextQuantity = this.normalizeCartQuantity(product, currentQuantity + line.quantity);
        const limitedQuantity = product ? Math.min(nextQuantity, Number(product.stock || 0)) : nextQuantity;
        quantities.set(line.productId, limitedQuantity);
      }

      return [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity })).filter((line) => line.quantity > 0);
    });
  }

  private applyOrderCsvCustomer(customerName: string): void {
    const normalizedCustomerName = this.normalizeSearchText(customerName);
    const customer = this.customerOptions().find((option) => {
      const fullName = `${option.nombre || ''} ${option.apellido || ''}`;
      return this.normalizeSearchText(fullName) === normalizedCustomerName;
    });

    if (customer) {
      this.selectCustomer(customer);
      return;
    }

    this.selectedCustomer.set(customerName);
    this.selectedCustomerId.set(null);
  }

  protected updatePurchaseCost(productId: number, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    this.purchaseCosts.update((costs) => ({ ...costs, [productId]: value }));
  }

  protected updateSalePrice(productId: number, event: Event): void {
    event.stopPropagation();
    const value = Number((event.target as HTMLInputElement).value);
    this.setSalePrice(productId, value);
  }

  protected decreaseSalePrice(productId: number, event?: Event): void {
    event?.stopPropagation();
    const currentPrice = this.currentSalePrice(productId);
    this.setSalePrice(productId, currentPrice - 1);
  }

  protected increaseSalePrice(productId: number, event?: Event): void {
    event?.stopPropagation();
    const currentPrice = this.currentSalePrice(productId);
    this.setSalePrice(productId, currentPrice + 1);
  }

  protected currentSalePrice(productId: number): number {
    const product = this.products().find((item) => item.id === productId);
    return this.salePrices()[productId] ?? product?.salePrice ?? 0;
  }

  private setSalePrice(productId: number, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    this.salePrices.update((prices) => ({ ...prices, [productId]: Math.round(value * 100) / 100 }));
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
    this.scheduleBillingSearchFocus();
  }

  protected openCustomerModal(): void {
    this.modalTables.reset('customers');
    this.customerModalOpen.set(true);
    void this.loadCustomers();
  }

  protected closeCustomerModal(): void {
    this.customerModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected selectSupplier(supplierName: string): void {
    this.selectedSupplier.set(supplierName);
    this.supplierModalOpen.set(false);
  }

  protected openSupplierModal(): void {
    this.modalTables.reset('suppliers');
    this.supplierModalOpen.set(true);
    void this.loadSuppliers();
  }

  protected closeSupplierModal(): void {
    this.supplierModalOpen.set(false);
    this.scheduleBillingSearchFocus();
  }

  protected decreaseQuantity(productId: number): void {
    this.cart.update((lines) =>
      lines
        .map((line) => {
          if (line.productId !== productId) {
            return line;
          }

          const product = this.products().find((item) => item.id === productId);
          return { ...line, quantity: this.normalizeCartQuantity(product, line.quantity - this.cartQuantityStep(product)) };
        })
        .filter((line) => line.quantity > 0),
    );
  }

  protected updateCartQuantity(productId: number, event: Event): void {
    const product = this.products().find((item) => item.id === productId);
    const rawValue = Number((event.target as HTMLInputElement).value);
    const quantity = this.normalizeCartQuantity(product, rawValue);

    if (this.activeMode() === 'sale' && product && quantity > Number(product.stock || 0)) {
      this.showSaleSuccess('La cantidad supera el stock disponible.', 'error');
      return;
    }

    this.cart.update((lines) =>
      lines
        .map((line) => line.productId === productId ? { ...line, quantity } : line)
        .filter((line) => line.quantity > 0),
    );
  }

  protected cartQuantityStep(product?: Product | null): number {
    return this.activeMode() === 'sale' && product?.allowsDecimalQuantity ? 0.5 : 1;
  }

  protected cartQuantityInputStep(product?: Product | null): string {
    return this.activeMode() === 'sale' && product?.allowsDecimalQuantity ? '0.001' : '1';
  }

  protected formatCartQuantity(quantity: number): string {
    return Number(quantity || 0).toLocaleString('es-HN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }

  private normalizeCartQuantity(product: Product | undefined | null, quantity: number): number {
    const safeQuantity = Math.max(Number(quantity || 0), 0);

    if (this.activeMode() === 'sale' && product?.allowsDecimalQuantity) {
      return Math.round(safeQuantity * 1000) / 1000;
    }

    return Math.floor(safeQuantity);
  }

  protected removeFromCart(productId: number): void {
    this.cart.update((lines) => lines.filter((line) => line.productId !== productId));
    this.purchaseCosts.update((costs) => {
      const remaining = { ...costs };
      delete remaining[productId];
      return remaining;
    });
    this.salePrices.update((prices) => {
      const remaining = { ...prices };
      delete remaining[productId];
      return remaining;
    });
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO VALIDA SI LA OPERACION ES COMPRA O VENTA ANTES DE FINALIZAR.
  // EN VENTA MANDA A LLAMAR persistSale(), QUE TERMINA EJECUTANDO LA INSERCION EN SQL SERVER.
  protected completeTransaction(): void {
    if (this.checkoutLoading()) {
      return;
    }

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
      this.salePrices.set({});
      this.selectedSupplier.set('');
      return;
    }

    void this.persistSale();
  }

  protected resetCart(): void {
    this.cart.set([]);
    this.purchaseCosts.set({});
    this.salePrices.set({});
    this.saleReceivedAmount.set('');
    this.selectedPaymentMethod.set('efectivo');
    this.selectedCustomer.set('Cliente final');
    this.selectedCustomerId.set(null);
    this.selectedSupplier.set('');
    this.activeQuoteId.set(null);
    this.activeQuoteNumber.set('');
  }

  private closeActiveBillingInvoiceAfterSale(): void {
    const activeId = this.activeBillingInvoiceId();
    const remaining = this.billingInvoiceSessions().filter((session) => session.id !== activeId);

    if (remaining.length === 0) {
      const session = this.createBillingInvoiceSession('Factura pendiente 1');
      this.billingInvoiceSessions.set([session]);
      this.activeBillingInvoiceId.set(session.id);
      this.restoreBillingInvoiceSession(session);
      return;
    }

    this.billingInvoiceSessions.set(remaining);
    const nextSession = remaining[remaining.length - 1];
    this.activeBillingInvoiceId.set(nextSession.id);
    this.restoreBillingInvoiceSession(nextSession);
  }

  protected updateSaleReceivedAmount(event: Event): void {
    this.saleReceivedAmount.set((event.target as HTMLInputElement).value);
  }

  protected setQuickReceivedAmount(amount: number): void {
    this.saleReceivedAmount.set(String(amount));
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
        const newPrice = Math.ceil((weightedCost * (1 + Math.max(product.margin, 0))) / 5) * 5;

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

  private registerSaleMovement(): void {
    const now = new Date();

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
      await this.refreshBillingStockBeforeSale();
      const lines = this.salePayloadLines();

      const sale = await this.requestCreateSale({
        user: currentUser.nombre || currentUser.usuario,
        userId: currentUser.id,
        paymentTypeId,
        customerId: this.selectedCustomerId(),
        lines,
        quoteId: this.activeQuoteId(),
      });

      this.applySaleStockUpdates(sale.updatedProducts, lines);
      this.closeActiveBillingInvoiceAfterSale();
      this.nextInvoiceNumber.set((sale.invoiceId || this.nextInvoiceNumber() || 0) + 1);
      this.showSaleSuccess('Venta realizada correctamente.');
      this.checkoutLoading.set(false);
      this.scheduleBillingSearchFocus();
      void this.refreshAfterSale(paymentTypeId);
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error, 'No se pudo registrar la venta.');

      if (this.isInsufficientStockError(errorMessage)) {
        await this.refreshBillingStockAfterStockError();
      }

      this.checkoutError.set(this.formatSaleErrorMessage(errorMessage));
      this.checkoutLoading.set(false);
      this.scheduleBillingSearchFocus();
    }
  }

  private async refreshBillingStockBeforeSale(): Promise<void> {
    if (this.activeMode() !== 'sale') {
      return;
    }

    const productIds = [...new Set(
      this.cart()
        .map((line) => Number(line.productId || 0))
        .filter((productId) => Number.isInteger(productId) && productId !== 0),
    )];

    if (productIds.length === 0) {
      return;
    }

    const response = await this.facturacionApi.getBillingProductAvailability(productIds);
    const stockByProductId = new Map(
      (response.products || []).map((product) => [Number(product.productId), Number(product.stock || 0)]),
    );

    this.products.update((products) =>
      products.map((product) =>
        stockByProductId.has(product.id)
          ? { ...product, stock: stockByProductId.get(product.id)! }
          : product,
      ),
    );

    const issue = this.firstCartStockIssue();

    if (issue) {
      this.trimCartToAvailableStock();
      throw new Error(issue);
    }
  }

  private async refreshBillingStockAfterStockError(): Promise<void> {
    try {
      await this.fetchBillingProducts(true);
      this.trimCartToAvailableStock();
    } catch {
      // Preserve the original checkout error when the recovery refresh also fails.
    }
  }

  private firstCartStockIssue(): string {
    for (const line of this.cart()) {
      const product = this.products().find((item) => item.id === line.productId);

      if (!product) {
        return 'Uno de los productos del carrito ya no esta disponible para facturar. Se actualizo el catalogo.';
      }

      const stock = Number(product.stock || 0);
      const quantity = this.normalizeCartQuantity(product, line.quantity);

      if (stock <= 0) {
        return `${product.name} ya no tiene stock disponible. Se actualizo el catalogo.`;
      }

      if (quantity > stock) {
        return `${product.name} solo tiene ${this.formatNumber(stock)} disponible. Ajusta la cantidad para facturar.`;
      }
    }

    return '';
  }

  private trimCartToAvailableStock(): void {
    this.cart.update((lines) =>
      lines
        .map((line) => {
          const product = this.products().find((item) => item.id === line.productId);

          if (!product) {
            return null;
          }

          const stock = Number(product.stock || 0);

          if (stock <= 0) {
            return null;
          }

          return {
            ...line,
            quantity: this.normalizeCartQuantity(product, Math.min(line.quantity, stock)),
          };
        })
        .filter((line): line is CartLine => line !== null && line.quantity > 0),
    );
  }

  private isInsufficientStockError(message: string): boolean {
    return this.normalizeSearchText(message).includes('stock insuficiente');
  }

  private formatSaleErrorMessage(message: string): string {
    if (!this.isInsufficientStockError(message)) {
      return message;
    }

    const productIdMatch = message.match(/producto\s+(\d+)/i);
    const productId = productIdMatch ? Number(productIdMatch[1]) : 0;
    const product = productId > 0 ? this.products().find((item) => item.id === productId) : null;

    if (product) {
      const stock = Number(product.stock || 0);

      if (stock <= 0) {
        return `${product.name} esta en cero y no puede ser facturado. El catalogo se actualizo.`;
      }

      return `${product.name} tiene ${this.formatNumber(stock)} disponible. Ajusta la cantidad en el carrito.`;
    }

    return 'La cantidad supera el stock disponible. El catalogo se actualizo; revisa el carrito.';
  }

  private async refreshAfterSale(paymentTypeId: number): Promise<void> {
    const refreshes: Array<Promise<unknown>> = [];

    if (paymentTypeId === 2) {
      refreshes.push(this.loadCredits(), this.loadCustomers());
    }

    if (this.activePage() === 'billing' || this.dailySalesModalOpen()) {
      refreshes.push(this.loadTodayInvoices());
    }

    if (this.cutModalOpen()) {
      refreshes.push(this.loadDailyCuts());
    }

    await Promise.allSettled(refreshes);
  }

  private applySaleStockUpdates(
    updatedProducts: SaleResponse['updatedProducts'] | undefined,
    soldLines: Array<{ productId: number; quantity: number }>,
  ): void {
    const stockByProductId = new Map<number, number>();

    for (const product of updatedProducts || []) {
      const productId = Number(product.productId || 0);

      if (productId > 0 && Number.isFinite(Number(product.stock))) {
        stockByProductId.set(productId, Number(product.stock));
      }
    }

    if (stockByProductId.size === 0) {
      for (const line of soldLines) {
        const productId = Number(line.productId || 0);
        const product = this.products().find((item) => item.id === productId);

        if (product) {
          stockByProductId.set(productId, Math.max(product.stock - Number(line.quantity || 0), 0));
        }
      }
    }

    if (stockByProductId.size > 0) {
      this.products.update((products) =>
        products.map((product) =>
          stockByProductId.has(product.id)
            ? { ...product, stock: stockByProductId.get(product.id)! }
            : product,
        ),
      );
    }

    this.registerSaleMovement();
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
    quoteId?: number | null;
    lines: Array<{
      productId: number;
      quantity: number;
      unitCost: number;
      salePrice: number;
    }>;
  }): Promise<SaleResponse> {
    return this.facturacionApi.createSale(payload);
  }

  private salePayloadLines(): Array<{ productId: number; quantity: number; unitCost: number; salePrice: number }> {
    return this.cartDetails().map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      unitCost: line.product.unitCost,
      salePrice: line.unitPrice,
    }));
  }

  private async requestCreateQuote(payload: {
    user: string;
    userId: number;
    paymentTypeId: number;
    customerId: number | null;
    customerName: string;
    lines: Array<{
      productId: number;
      quantity: number;
      unitCost: number;
      salePrice: number;
    }>;
  }): Promise<QuoteDetailsResponse> {
    if (this.desktopApi) {
      return this.desktopApi.createQuote(payload);
    }

    return firstValueFrom(this.http.post<QuoteDetailsResponse>('/api/quotes', payload));
  }

  // PROCEDIMIENTO UBICADO EN src/app/app.ts
  // ESTE PROCEDIMIENTO CONVIERTE LA FORMA DE PAGO SELECCIONADA AL ID_TP DE dbo.TIPO_PAGO.
  // EL VALOR SE USA EN persistSale() Y SE INSERTA EN LA TABLA DE PAGO CORRECTA DESDE registerSale().
  private selectedPaymentTypeId(): number {
    return this.paymentMethodOptions.find((paymentMethod) => paymentMethod.id === this.selectedPaymentMethod())?.paymentTypeId || 1;
  }

  private paymentMethodFromTypeId(paymentTypeId: number): PaymentMethod {
    return this.paymentMethodOptions.find((paymentMethod) => paymentMethod.paymentTypeId === Number(paymentTypeId))?.id || 'efectivo';
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

  private updateProfitabilitySalesTrendChart(): void {
    if (!this.profitabilitySalesTrendCanvas) {
      return;
    }

    if (!this.profitabilitySalesTrendChart) {
      this.profitabilitySalesTrendChart = this.createSalesTrendChart(this.profitabilitySalesTrendCanvas.nativeElement, true);
    }

    if (!this.profitabilitySalesTrendChart) {
      return;
    }

    this.updateTrendChartData(this.profitabilitySalesTrendChart);
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

    if (page === 'credits') {
      this.updateCreditsTrendChart();
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

    if (page === 'attendance') {
      this.updateAttendanceTrendChart();
      return;
    }

    if (page === 'costs') {
      this.updateCostsDistributionChart();
      this.updateCostsEvolutionChart();
      this.updateCostsCategoryChart();
      return;
    }

    if (page === 'petty-cash') {
      this.updatePettyCashTrendChart();
      return;
    }

    if (page === 'financial-movements') {
      this.updateFinancialMovementsTrendChart();
      return;
    }

    if (page === 'sales-profitability') {
      this.updateProfitabilitySalesTrendChart();
      return;
    }

    if (page === 'history') {
      this.updateAuditUserTrendChart();
    }
  }

  private scheduleVisibleChartsRefresh(): void {
    queueMicrotask(() => {
      this.updateVisibleCharts();
      this.installChartExpandButtons();
      requestAnimationFrame(() => {
        this.updateVisibleCharts();
        this.installChartExpandButtons();
        setTimeout(() => {
          this.updateVisibleCharts();
          this.installChartExpandButtons();
        }, 0);
      });
    });
  }

  private installChartExpandButtons(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas[aria-label]'));

    for (const canvas of canvases) {
      if (canvas.dataset['chartExpandReady'] === '1' || canvas.closest('.expanded-chart-modal')) {
        continue;
      }

      const host = canvas.parentElement;

      if (!host) {
        continue;
      }

      const card = canvas.closest('article, section, .analytics-card, .payroll-card, .attendance-card');
      const heading = card?.querySelector<HTMLElement>('.analytics-heading');
      const selectorHost = heading?.querySelector<HTMLElement>('.trend-period-tabs, .purchase-year-tabs, .credit-history-period-tabs, .credit-history-year-tabs');
      const buttonHost = selectorHost || heading || host;
      buttonHost.classList.add(selectorHost ? 'chart-expand-selector-host' : heading ? 'chart-expand-heading' : 'chart-expand-host');
      canvas.dataset['chartExpandReady'] = '1';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = selectorHost || heading ? 'chart-expand-button chart-expand-heading-button' : 'chart-expand-button';
      button.setAttribute('aria-label', 'Abrir grafico en grande');
      button.title = 'Abrir grafico en grande';
      button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M8 3H3v5h2V6.41l4.3 4.29 1.4-1.4L6.41 5H8V3Zm8 0v2h1.59l-4.29 4.3 1.4 1.4L19 6.41V8h2V3h-5ZM5 15H3v6h6v-2H6.41l4.29-4.3-1.4-1.4L5 17.59V15Zm14 2.59-4.3-4.29-1.4 1.4 4.29 4.3H15v2h6v-6h-2v2.59Z"/></svg>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openExpandedChart(canvas);
      });
      buttonHost.appendChild(button);
    }
  }

  private openExpandedChart(canvas: HTMLCanvasElement): void {
    const imageUrl = this.captureChartCanvas(canvas);

    if (!imageUrl) {
      return;
    }

    const title = this.resolveChartTitle(canvas);
    this.expandedChartPreview.set({
      title,
      imageUrl,
      fileName: `${this.normalizeReportFileName(title)}-${this.formatDateKey(new Date())}.png`,
      background: this.resolveChartBackground(canvas),
    });
  }

  protected closeExpandedChart(): void {
    this.expandedChartPreview.set(null);
  }

  protected downloadExpandedChart(): void {
    const preview = this.expandedChartPreview();

    if (!preview) {
      return;
    }

    const link = document.createElement('a');
    link.href = preview.imageUrl;
    link.download = preview.fileName;
    link.click();
  }

  private captureChartCanvas(canvas: HTMLCanvasElement): string {
    try {
      return canvas.toDataURL('image/png', 1);
    } catch {
      return '';
    }
  }

  private resolveChartTitle(canvas: HTMLCanvasElement): string {
    const card = canvas.closest('article, section, .analytics-card, .payroll-card, .attendance-card');
    const heading = card?.querySelector('h1, h2, h3');
    const title = heading?.textContent?.replace(/\s+/g, ' ').trim();

    return title || canvas.getAttribute('aria-label') || 'Grafico';
  }

  private resolveChartBackground(canvas: HTMLCanvasElement): string {
    const candidates = [
      canvas.parentElement,
      canvas.closest<HTMLElement>('.chartjs-trend-shell, .dashboard-module-chart-shell, .history-trend-chart'),
      canvas.closest<HTMLElement>('article, section, .analytics-card, .payroll-card, .attendance-card'),
    ].filter((item): item is HTMLElement => Boolean(item));

    for (const element of candidates) {
      const style = getComputedStyle(element);
      const image = style.backgroundImage && style.backgroundImage !== 'none' ? style.backgroundImage : '';
      const color = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : '';

      if (image && color) {
        return `${image}, ${color}`;
      }

      if (image || color) {
        return image || color;
      }
    }

    return 'var(--panel)';
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

    // La gráfica puede existir antes de que el tema claro se aplique por HMR.
    // Reafirmamos sus colores para que ejes y leyenda nunca hereden el contraste oscuro.
    const options = this.invoicesSalesTrendChart.options;
    options.plugins!.legend!.labels!.color = '#536a76';
    options.scales!['x']!.ticks!.color = '#536a76';
    options.scales!['y']!.ticks!.color = '#536a76';
    options.scales!['x']!.grid!.color = 'rgb(83 106 118 / 16%)';
    options.scales!['y']!.grid!.color = 'rgb(83 106 118 / 16%)';

    const points = this.invoiceTrendPoints();
    this.invoicesSalesTrendChart.data.labels = points.map(([label]) => label);
    this.invoicesSalesTrendChart.data.datasets = [{
      label: 'Monto activo', data: points.map(([, total]) => total),
      borderColor: '#089a9f', backgroundColor: 'rgba(8,154,159,.10)',
      pointBackgroundColor: '#089a9f', pointBorderColor: '#ffffff',
      borderWidth: 2, pointRadius: 3, tension: .2, fill: true,
    }];
    this.invoicesSalesTrendChart.update();
  }

  private updateCreditHistoryTrendChart(): void {
    if (!this.creditHistoryTrendCanvas) {
      return;
    }

    if (!this.creditHistoryTrendChart) {
      this.creditHistoryTrendChart = this.createSalesTrendChart(this.creditHistoryTrendCanvas.nativeElement, true);
    }

    const trend = this.creditHistoryTrend();
    const [lineStyle] = this.chartLinePalette();
    const dataset = this.creditHistoryTrendChart.data.datasets[0];
    this.creditHistoryTrendChart.data.labels = trend.map((item) => item.label);
    this.creditHistoryTrendChart.data.datasets = [dataset];
    dataset.label = 'Abonos';
    dataset.data = trend.map((item) => this.roundMoney(item.total));
    dataset.borderColor = lineStyle.border;
    dataset.backgroundColor = lineStyle.background;
    dataset.pointBackgroundColor = lineStyle.border;
    dataset.borderDash = [];
    dataset.fill = 'origin';
    this.creditHistoryTrendChart.resize();
    this.creditHistoryTrendChart.update();
    queueMicrotask(() => this.installChartExpandButtons());
  }

  private updateCreditsTrendChart(): void {
    if (!this.creditsTrendCanvas) {
      return;
    }

    if (!this.creditsTrendChart) {
      this.creditsTrendChart = this.createPayrollTrendChart(this.creditsTrendCanvas.nativeElement);
    }

    const series = this.creditsTrendChartSeries();
    const palette = this.chartLinePalette();
    this.creditsTrendChart.data.labels = series.labels;
    this.creditsTrendChart.data.datasets = series.datasets.map((dataset, index) => {
      const style = palette[index] || palette[index % palette.length] || palette[0];

      return {
        label: dataset.label,
        data: dataset.data,
        borderColor: style.border,
        backgroundColor: style.background,
        borderWidth: 2.4,
        pointBackgroundColor: style.border,
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
      };
    });
    this.creditsTrendChart.resize();
    this.creditsTrendChart.update();
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

  private updateAttendanceTrendChart(): void {
    if (!this.attendanceTrendCanvas) {
      return;
    }

    if (!this.attendanceTrendChart) {
      this.attendanceTrendChart = this.createPayrollTrendChart(this.attendanceTrendCanvas.nativeElement, 'hours');
    }

    const trendSeries = this.attendanceTrendChartSeries();
    const chartPalette = this.chartLinePalette();
    this.attendanceTrendChart.data.labels = trendSeries.labels;
    this.attendanceTrendChart.data.datasets = trendSeries.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: chartPalette[index]?.border || '#22d3ee',
      backgroundColor: chartPalette[index]?.background || 'rgb(34 211 238 / 14%)',
      borderWidth: 2.4,
      pointBackgroundColor: chartPalette[index]?.border || '#22d3ee',
      pointBorderColor: '#0f172a',
      pointHoverRadius: 6,
      pointRadius: 4,
      tension: 0.38,
    }));
    this.attendanceTrendChart.resize();
    this.attendanceTrendChart.update();
  }

  private updatePettyCashTrendChart(): void {
    if (!this.pettyCashTrendCanvas) {
      return;
    }

    if (!this.pettyCashTrendChart) {
      this.pettyCashTrendChart = this.createPettyCashTrendChart(this.pettyCashTrendCanvas.nativeElement);
    }

    const trendData = this.pettyCashTrendData();
    const palette = this.chartLinePalette();
    this.pettyCashTrendChart.data.labels = trendData.map((item) => item.label);
    this.pettyCashTrendChart.data.datasets = [
      {
        label: 'Caja chica',
        data: trendData.map((item) => this.roundMoney(item.cashToPetty)),
        borderColor: palette[0]?.border || '#14b8a6',
        backgroundColor: palette[0]?.background || 'rgb(20 184 166 / 14%)',
        borderWidth: 2.6,
        pointBackgroundColor: palette[0]?.border || '#14b8a6',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
      {
        label: 'Reservas 2%',
        data: trendData.map((item) => this.roundMoney(item.reserves)),
        borderColor: palette[1]?.border || '#3b82f6',
        backgroundColor: palette[1]?.background || 'rgb(59 130 246 / 14%)',
        borderDash: [6, 5],
        borderWidth: 2.4,
        pointBackgroundColor: palette[1]?.border || '#3b82f6',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
      {
        label: 'Saldo neto',
        data: trendData.map((item) => this.roundMoney(item.netPettyCash)),
        borderColor: palette[2]?.border || '#f97316',
        backgroundColor: palette[2]?.background || 'rgb(249 115 22 / 14%)',
        borderDash: [10, 4],
        borderWidth: 2.4,
        pointBackgroundColor: palette[2]?.border || '#f97316',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
    ];
    this.pettyCashTrendChart.resize();
    this.pettyCashTrendChart.update();
  }

  private updateFinancialMovementsTrendChart(): void {
    if (!this.financialMovementsTrendCanvas) {
      return;
    }

    if (!this.financialMovementsTrendChart) {
      this.financialMovementsTrendChart = this.createPettyCashTrendChart(this.financialMovementsTrendCanvas.nativeElement);
    }

    const trendData = this.financialMovementsTrend();
    const palette = this.chartLinePalette();
    this.financialMovementsTrendChart.data.labels = trendData.map((item) => item.label);
    this.financialMovementsTrendChart.data.datasets = [
      {
        label: 'Entradas',
        data: trendData.map((item) => this.roundMoney(item.entradas)),
        borderColor: palette[0]?.border || '#14b8a6',
        backgroundColor: palette[0]?.background || 'rgb(20 184 166 / 14%)',
        borderWidth: 2.6,
        pointBackgroundColor: palette[0]?.border || '#14b8a6',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
      {
        label: 'Salidas',
        data: trendData.map((item) => this.roundMoney(item.salidas)),
        borderColor: '#f97316',
        backgroundColor: 'rgb(249 115 22 / 14%)',
        borderWidth: 2.4,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
      {
        label: 'Tarjeta credito',
        data: trendData.map((item) => this.roundMoney(item.tarjeta)),
        borderColor: '#60a5fa',
        backgroundColor: 'rgb(96 165 250 / 14%)',
        borderDash: [8, 5],
        borderWidth: 2.4,
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
        fill: false,
      },
    ];
    this.financialMovementsTrendChart.resize();
    this.financialMovementsTrendChart.update();
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
    this.costsDistributionChart.data.datasets[0].backgroundColor = this.chartLinePalette().map((item) => item.border);
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

    const trend = this.operationalCostWeeklyTrend();
    const [lineStyle] = this.chartLinePalette();
    this.costsEvolutionChart.data.labels = trend.map((item) => item.label);
    this.costsEvolutionChart.data.datasets[0].borderColor = lineStyle.border;
    this.costsEvolutionChart.data.datasets[0].backgroundColor = lineStyle.background;
    this.costsEvolutionChart.data.datasets[0].pointBackgroundColor = lineStyle.border;
    this.costsEvolutionChart.data.datasets[0].label = 'Costos extras';
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
    this.costsCategoryChart.data.datasets[0].backgroundColor = categoryPalette[0]?.border || 'rgb(34 197 94 / 84%)';
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
      this.dashboardPayrollChart = this.createPayrollTrendChart(this.dashboardPayrollChartCanvas.nativeElement);
    }

    const series = this.dashboardPayrollChartSeries();
    const palette = this.chartLinePalette();

    this.dashboardPayrollChart.data.labels = series.labels;
    this.dashboardPayrollChart.data.datasets = series.datasets.map((dataset, index) => {
      const { border: borderColor, background: backgroundColor } = palette[index] || palette[index % palette.length] || palette[0];

      return {
        label: dataset.label,
        data: dataset.data,
        borderColor,
        backgroundColor,
        borderWidth: 2.4,
        fill: false,
        pointBackgroundColor: borderColor,
        pointBorderColor: '#0f172a',
        pointHoverRadius: 6,
        pointRadius: 4,
        tension: 0.38,
      };
    });
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
    const imageThemePalettes: Partial<Record<ThemeId, Array<{ border: string; background: string }>>> = {
      'combo-mono': [
        { border: '#2f2f33', background: 'rgb(47 47 51 / 14%)' },
        { border: '#6b7280', background: 'rgb(107 114 128 / 12%)' },
        { border: '#f5f6f7', background: 'rgb(245 246 247 / 10%)' },
        { border: '#9ca3af', background: 'rgb(156 163 175 / 10%)' },
        { border: '#111827', background: 'rgb(17 24 39 / 10%)' },
      ],
      'soft-blue': [
        { border: '#addff1', background: 'rgb(173 223 241 / 16%)' },
        { border: '#003152', background: 'rgb(0 49 82 / 14%)' },
        { border: '#38bdf8', background: 'rgb(56 189 248 / 12%)' },
        { border: '#e0f7ff', background: 'rgb(224 247 255 / 10%)' },
        { border: '#0f4c75', background: 'rgb(15 76 117 / 10%)' },
      ],
      'deep-onyx': [
        { border: '#02f5a1', background: 'rgb(2 245 161 / 14%)' },
        { border: '#07191e', background: 'rgb(7 25 30 / 18%)' },
        { border: '#2fffc3', background: 'rgb(47 255 195 / 10%)' },
        { border: '#0ea572', background: 'rgb(14 165 114 / 10%)' },
        { border: '#b7ffe8', background: 'rgb(183 255 232 / 8%)' },
      ],
      'monaco-orange': [
        { border: '#ee7900', background: 'rgb(238 121 0 / 16%)' },
        { border: '#ffedcb', background: 'rgb(255 237 203 / 12%)' },
        { border: '#ff9f1c', background: 'rgb(255 159 28 / 12%)' },
        { border: '#111111', background: 'rgb(17 17 17 / 14%)' },
        { border: '#ffd08a', background: 'rgb(255 208 138 / 10%)' },
      ],
      'uniform-yellow': [
        { border: '#fbfc09', background: 'rgb(251 252 9 / 16%)' },
        { border: '#122837', background: 'rgb(18 40 55 / 16%)' },
        { border: '#fff86b', background: 'rgb(255 248 107 / 12%)' },
        { border: '#38bdf8', background: 'rgb(56 189 248 / 10%)' },
        { border: '#d9dc00', background: 'rgb(217 220 0 / 10%)' },
      ],
      'red-combo': [
        { border: '#fb3640', background: 'rgb(251 54 64 / 16%)' },
        { border: '#000f08', background: 'rgb(0 15 8 / 18%)' },
        { border: '#ff6b72', background: 'rgb(255 107 114 / 12%)' },
        { border: '#c1121f', background: 'rgb(193 18 31 / 10%)' },
        { border: '#fca5a5', background: 'rgb(252 165 165 / 8%)' },
      ],
      'coral-black': [
        { border: '#f95c4b', background: 'rgb(249 92 75 / 16%)' },
        { border: '#171616', background: 'rgb(23 22 22 / 18%)' },
        { border: '#ff8678', background: 'rgb(255 134 120 / 12%)' },
        { border: '#c24135', background: 'rgb(194 65 53 / 10%)' },
        { border: '#ffd0ca', background: 'rgb(255 208 202 / 8%)' },
      ],
    };
    const imagePalette = imageThemePalettes[this.activeThemeId()];

    if (imagePalette) {
      return imagePalette;
    }

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
    const lightInvoiceChart = this.activePage() === 'invoices';
    const chartText = lightInvoiceChart ? '#536a76' : 'rgb(203 213 225 / 70%)';
    const chartGrid = lightInvoiceChart ? 'rgb(83 106 118 / 16%)' : 'rgb(148 163 184 / 12%)';
    const chartBorder = lightInvoiceChart ? 'rgb(83 106 118 / 26%)' : 'rgb(148 163 184 / 24%)';
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
              color: chartText,
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
              color: chartBorder,
            },
            grid: {
              color: chartGrid,
            },
            ticks: {
              color: chartText,
              font: {
                size: 10,
                weight: 800,
              },
            },
          },
          y: {
            beginAtZero: true,
            border: {
              color: chartBorder,
            },
            grid: {
              color: chartGrid,
            },
            ticks: {
              color: chartText,
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
            backgroundColor: this.chartLinePalette()[0]?.border || 'rgb(34 197 94 / 84%)',
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
            backgroundColor: this.chartLinePalette().map((item) => item.border),
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

  private createPayrollTrendChart(
    canvas: HTMLCanvasElement,
    valueType: 'currency' | 'hours' = 'currency',
  ): Chart<'line', number[], string> {
    const formatTrendValue = (value: number): string =>
      valueType === 'hours' ? `${this.formatNumber(value)} H` : this.formatCurrency(value);
    const formatTrendTick = (value: number): string =>
      valueType === 'hours' ? `${this.formatNumber(value)} H` : this.formatCompactCurrency(value);

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
              label: (context) => `${context.dataset.label}: ${formatTrendValue(Number(context.raw || 0))}`,
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
              callback: (value) => formatTrendTick(Number(value)),
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

  private createPettyCashTrendChart(canvas: HTMLCanvasElement): Chart<'line', number[], string> {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        animation: { duration: 450 },
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
              color: 'rgb(203 213 225 / 72%)',
              font: { size: 11, weight: 800 },
            },
            position: 'top',
          },
          tooltip: {
            backgroundColor: 'rgb(15 23 42 / 94%)',
            borderColor: 'rgb(148 163 184 / 22%)',
            borderWidth: 1,
            callbacks: {
              label: (context) => {
                const valueLine = `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`;
                const category = String(context.label || '');
                const seriesItem = this.costCategoryComparisonSeries().find((item) => item.category === category);

                if (!seriesItem) {
                  return valueLine;
                }

                return [
                  valueLine,
                  `Movimiento: ${this.formatNumber(Number(seriesItem.quantity || 0))} unidades`,
                  `Costo: ${this.formatCurrency(seriesItem.costTotal)}`,
                  `Venta: ${this.formatCurrency(seriesItem.saleTotal)}`,
                  `Utilidad: ${this.formatCurrency(Number(seriesItem.utilityTotal || 0))}`,
                ];
              },
            },
            padding: 12,
            titleColor: '#f8fafc',
          },
        },
        scales: {
          x: {
            grid: { color: 'rgb(148 163 184 / 8%)' },
            ticks: {
              color: 'rgb(203 213 225 / 70%)',
              font: { size: 10, weight: 800 },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgb(148 163 184 / 10%)' },
            ticks: {
              color: 'rgb(203 213 225 / 72%)',
              callback: (value) => this.formatCompactCurrency(Number(value)),
              font: { size: 10, weight: 800 },
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
