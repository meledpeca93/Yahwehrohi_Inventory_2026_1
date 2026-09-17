interface DesktopLoginResponse {
  user: {
    id: number;
    nombre: string;
    usuario: string;
    rol: string;
  };
}

interface DesktopProductsResponse {
  products: Array<{
    id: number;
    sku: string;
    barcodes?: DesktopProductBarcode[];
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    category: string;
    primaryLotExpiryDate?: string | null;
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
    margin?: number;
  }>;
}

interface DesktopProductBarcode {
  id: number;
  productId: number;
  code: string;
  isPrimary: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface DesktopUsersResponse {
  users: Array<{
    id: number;
    nombre: string;
    usuario: string;
    rol: string;
  }>;
}

interface DesktopAttendanceUsersResponse {
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

interface DesktopAttendanceMarkResponse {
  mark: {
    id: number;
    employeeId: number;
    date: string | null;
    entryTime: string;
    exitTime: string;
    status: string;
  };
}

interface DesktopProductInventoryDetailResponse {
  product: {
    id: number;
    sku: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    category: string;
    primaryLotExpiryDate?: string | null;
    stock: number;
    minStock: number;
    maxStock?: number | null;
    unitCost: number;
    salePrice: number;
    wholesalePrice?: number | null;
    unitMeasure?: string | null;
    allowsDecimalQuantity?: boolean;
    supplier?: string | null;
    createdBy?: string | null;
    updatedBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  lots: Array<{
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
  }>;
  movements: Array<{
    id: number;
    date: string | null;
    document: string;
    movementType: string;
    entry: number;
    exit: number;
    unitCost: number;
    userName: string;
  }>;
}

interface DesktopPayrollWeekPayload {
  weekNumber: number;
  createdByUserId: number;
  rows: Array<{
    userId: number;
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
  }>;
}

interface DesktopPayrollRecord {
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

interface DesktopPayrollRecordsResponse {
  records: DesktopPayrollRecord[];
}

interface DesktopAuditHistoryRecord {
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

interface DesktopAuditHistoryResponse {
  history: DesktopAuditHistoryRecord[];
}

interface DesktopCustomersResponse {
  customers: Array<{
    id: number;
    nombre: string;
    apellido: string | null;
    telefono: string | null;
    direccion: string | null;
    creditosAbiertos: number;
    fechaHora: string | null;
    saldo: number;
  }>;
}

interface DesktopSuppliersResponse {
  suppliers: Array<{
    id: number;
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    creditoAbierto: number;
    comprasRealizadas: number;
    fechaHora: string | null;
  }>;
}

interface DesktopExpiringProductsResponse {
  alerts: Array<{
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
  }>;
}

interface DesktopPurchasesResponse {
  purchases: Array<{
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
  }>;
}

interface DesktopCreditsResponse {
  credits: Array<{
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
  }>;
}

interface DesktopDashboardSalesSummaryResponse {
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

interface DesktopDashboardSalesTrendResponse {
  trend: Array<{
    period: string;
    periodStart: string;
    efectivo: number;
    credito: number;
    transferencia: number;
  }>;
}

interface DesktopSalesDropAlertResponse {
  alert: {
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
  };
}

interface DesktopCostSalesPeriodSummary {
  year: number;
  month: number;
  total: number;
}

interface DesktopCostSalesByCategoryResponse {
  year: number;
  month: number;
  categories: Array<{
    category: string;
    total: number;
  }>;
}

interface DesktopCostIncreaseAlertsResponse {
  period: {
    year: number;
    month: number;
  } | null;
  rows: Array<{
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
  }>;
}

interface DesktopOperationalCostsResponse {
  year: number;
  month: number;
  total: number;
  rows: Array<{
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
  }>;
}

interface DesktopInvoiceRow {
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

interface DesktopDailyCut {
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

interface DesktopPettyCashRecord {
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

interface DesktopCreditPayment {
  id: number;
  description: string;
  amount: number;
  paymentMethod: 'efectivo' | 'transferencia';
  customerId: number;
  customerName: string;
  invoiceId: number;
  userId: number;
  userName: string;
  createdAt: string;
}

interface DesktopFinancialMovement {
  id: number;
  date: string;
  movementType: 'entrada' | 'salida';
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta_credito';
  target: 'corte_dia' | 'caja_chica' | 'cuenta_bancaria' | 'tarjeta_credito';
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

interface DesktopFinancialMovementsResponse {
  year: number;
  month: number;
  movements: DesktopFinancialMovement[];
}

interface DesktopCreditPaymentAllocationResponse {
  customerId: number;
  amount: number;
  paymentMethod: 'efectivo' | 'transferencia';
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

interface DesktopInvoiceLine {
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

interface DesktopInvoicesSummaryResponse {
  invoiceCount: number;
  activeTotal: number;
  annulledCount: number;
  creditTotal: number;
}

interface DesktopSaleResponse {
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

interface DesktopQuoteRow {
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

interface DesktopQuoteLine {
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

interface DesktopQuoteDetailsResponse {
  quote: DesktopQuoteRow;
  lines: DesktopQuoteLine[];
}

interface DesktopSystemHealthResponse {
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

interface DesktopDatabaseBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time: string;
  maxBackups: number;
  backupDir: string;
  lastAutomaticRunKey?: string;
}

interface DesktopDatabaseBackupRow {
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

interface DesktopDatabaseBackupsResponse {
  config: DesktopDatabaseBackupConfig;
  backups: DesktopDatabaseBackupRow[];
  latest: DesktopDatabaseBackupRow | null;
}

interface DesktopDatabaseBackupValidationResponse {
  ok: boolean;
  fileName: string;
  filePath: string;
  size: number;
  freeBytes: number | null;
  databaseName: string | null;
  compatible: boolean;
}

interface Window {
  electronAPI?: {
    health: () => Promise<{ ok: boolean; database?: string; message?: string }>;
    getSystemHealth: () => Promise<DesktopSystemHealthResponse>;
    getDatabaseBackups: () => Promise<DesktopDatabaseBackupsResponse>;
    saveDatabaseBackupConfig: (payload: {
      config: Partial<DesktopDatabaseBackupConfig>;
      user: DesktopLoginResponse['user'];
    }) => Promise<{ config: DesktopDatabaseBackupConfig }>;
    createDatabaseBackup: (payload: { user: DesktopLoginResponse['user'] }) => Promise<{
      backup: DesktopDatabaseBackupRow;
      message: string;
    }>;
    runAutomaticDatabaseBackup: () => Promise<{ backup: DesktopDatabaseBackupRow | null; skipped: boolean }>;
    validateDatabaseBackup: (fileName: string) => Promise<DesktopDatabaseBackupValidationResponse>;
    restoreDatabaseBackup: (payload: {
      fileName: string;
      confirmation: string;
      user: DesktopLoginResponse['user'];
    }) => Promise<{
      restore: DesktopDatabaseBackupRow & { emergencyBackup?: DesktopDatabaseBackupRow };
      message: string;
    }>;
    login: (credentials: { usuario: string; pass: string }) => Promise<DesktopLoginResponse>;
    getUsers: () => Promise<DesktopUsersResponse>;
    getAttendanceUsers: () => Promise<DesktopAttendanceUsersResponse>;
    saveAttendanceMark: (payload: {
      employeeId: number;
      date: string;
      entryTime: string;
      exitTime: string;
      recordedBy: string;
      recordedById?: number;
      observation?: string;
    }) => Promise<DesktopAttendanceMarkResponse>;
    savePayrollWeek: (payload: DesktopPayrollWeekPayload) => Promise<{ inserted: number; attendanceSynced?: number }>;
    getPayrollRecords: () => Promise<DesktopPayrollRecordsResponse>;
    getCustomers: () => Promise<DesktopCustomersResponse>;
    getSuppliers: () => Promise<DesktopSuppliersResponse>;
    getExpiringProducts: () => Promise<DesktopExpiringProductsResponse>;
    getPurchases: () => Promise<DesktopPurchasesResponse>;
    getCredits: () => Promise<DesktopCreditsResponse>;
    createCreditPayment: (payload: {
      customerId: number;
      amount: number;
      userId: number;
      paymentMethod?: 'efectivo' | 'transferencia';
      description?: string;
    }) => Promise<{ payment: DesktopCreditPaymentAllocationResponse }>;
    getCreditPaymentHistory: (customerId: number) => Promise<{ payments: DesktopCreditPayment[] }>;
    getNextInvoiceNumber: () => Promise<{ nextInvoiceNumber: number }>;
    getInvoices: () => Promise<{ invoices: DesktopInvoiceRow[] }>;
    getTodayInvoices: () => Promise<{ invoices: DesktopInvoiceRow[] }>;
    getDailyCuts: (dateFrom?: string, dateTo?: string, userId?: number) => Promise<{ cuts: DesktopDailyCut[] }>;
    previewDailyCut: (date?: string, userId?: number) => Promise<{ cut: DesktopDailyCut }>;
    createDailyCut: (payload: { date: string; physicalCashCount?: number; userId: number }) => Promise<{ cut: DesktopDailyCut }>;
    createOpeningCut: (payload: { date: string; initialCash: number; userId: number }) => Promise<{ cut: DesktopDailyCut }>;
    updateDailyCutCashManagement: (payload: Partial<DesktopPettyCashRecord> & { id: number; userId?: number | null }) => Promise<{ cut: DesktopDailyCut }>;
    deleteDailyCutCashManagement: (payload: { id: number; userId?: number | null }) => Promise<{ id: number; deleted: boolean }>;
    getPettyCashRecords: () => Promise<{ records: DesktopPettyCashRecord[] }>;
    createPettyCashRecord: (payload: Partial<DesktopPettyCashRecord> & { userId?: number | null }) => Promise<{ record: DesktopPettyCashRecord }>;
    updatePettyCashRecord: (payload: Partial<DesktopPettyCashRecord> & { id: number; userId?: number | null }) => Promise<{ record: DesktopPettyCashRecord }>;
    deletePettyCashRecord: (payload: { id: number; userId?: number | null }) => Promise<{ id: number; deleted: boolean }>;
    getFinancialMovements: (year?: number, month?: number) => Promise<DesktopFinancialMovementsResponse>;
    createFinancialMovement: (payload: {
      date: string;
      movementType: 'entrada' | 'salida';
      paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta_credito';
      target: 'corte_dia' | 'caja_chica' | 'cuenta_bancaria' | 'tarjeta_credito';
      category?: string;
      description?: string;
      amount: number;
      bankAccount?: string;
      creditCard?: string;
      userId?: number | null;
    }) => Promise<{ movement: DesktopFinancialMovement }>;
    getCreditPayments: (date?: string, userId?: number) => Promise<{ payments: DesktopCreditPayment[] }>;
    getCreditPaymentsHistory: (limit?: number) => Promise<{ payments: DesktopCreditPayment[] }>;
    closeApp: () => Promise<void>;
    updateSystem: () => Promise<{ ok: boolean; mode?: 'development' | 'production'; message?: string }>;
    exportHtmlPdf: (payload: { html: string; defaultFileName?: string }) => Promise<{
      canceled?: boolean;
      filePath?: string;
      size?: number;
    }>;
    getInvoicesSummary: () => Promise<DesktopInvoicesSummaryResponse>;
    getInvoiceDetails: (invoiceId: number) => Promise<{ lines: DesktopInvoiceLine[] }>;
    annulInvoice: (payload: { invoiceId: number; userId?: number | null }) => Promise<{
      invoiceId: number;
      restoredLines: number;
      restoredQuantity: number;
      saleTable: string;
    }>;
    activateInvoice: (payload: { invoiceId: number; userId?: number | null }) => Promise<{
      invoiceId: number;
      activatedLines: number;
      deductedQuantity: number;
      saleTable: string;
      saleStatusId: number;
    }>;
    getDashboardSalesSummary: () => Promise<DesktopDashboardSalesSummaryResponse>;
    getSalesProfitabilityAnalytics: (period?: { year?: number; month?: number }) => Promise<any>;
    getDashboardSalesTrend: (period: 'day' | 'week' | 'month' | 'year') => Promise<DesktopDashboardSalesTrendResponse>;
    getSalesDropAlert: () => Promise<DesktopSalesDropAlertResponse>;
    getCostSalesPeriodTotal: (year: number, month: number) => Promise<DesktopCostSalesPeriodSummary>;
    getCostSalesByCategory: (year: number, month: number) => Promise<DesktopCostSalesByCategoryResponse>;
    getCostIncreaseAlerts: () => Promise<DesktopCostIncreaseAlertsResponse>;
    getOperationalCosts: (year: number, month: number) => Promise<DesktopOperationalCostsResponse>;
    createOperationalCost: (payload: {
      date: string;
      type: string;
      description: string;
      amount: number;
      userId: number | null;
      invoiceId: number | null;
      invoiceNumber: string;
      purchaseId: number;
      purchaseType: string;
      appliesTo: string;
      reference: string;
    }) => Promise<{ id: number; date: string; type: string; amount: number }>;
    getAuditHistory: (limit?: number) => Promise<DesktopAuditHistoryResponse>;
    createAuditHistoryRecord: (payload: {
      tableName: string;
      action: string;
      recordKey?: string;
      userId?: number | null;
      user?: string | null;
      previousData?: string;
      newData?: string;
    }) => Promise<{ ok: boolean }>;
    getProducts: () => Promise<DesktopProductsResponse>;
    getBillingProducts: () => Promise<DesktopProductsResponse>;
    getBillingProductAvailability: (productIds: number[]) => Promise<{
      products: Array<{
        productId: number;
        stock: number;
        available: boolean;
      }>;
    }>;
    getAssembledOffers: () => Promise<{
      offers: Array<{
        id: number;
        virtualProductId: number;
        sku: string;
        name: string;
        description: string;
        salePrice: number;
        startsAt: string | null;
        endsAt: string | null;
        active: boolean;
        status: string;
        stock: number;
        visibilityReason?: string;
        createdAt?: string | null;
        components: Array<{
          productId: number;
          sku?: string;
          name?: string;
          quantity: number;
          isGift: boolean;
          stock?: number;
          unitCost?: number;
          salePrice?: number;
        }>;
      }>;
    }>;
    createAssembledOffer: (payload: {
      code: string;
      name: string;
      description?: string;
      salePrice: number;
      startsAt: string;
      endsAt: string;
      active?: boolean;
      userId?: number | null;
      user?: string | null;
      components: Array<{
        productId: number;
        quantity: number;
        isGift: boolean;
      }>;
    }) => Promise<{
      offer: {
        id: number;
        virtualProductId: number;
        sku: string;
        name: string;
        description: string;
        salePrice: number;
        startsAt: string | null;
        endsAt: string | null;
        active: boolean;
        status: string;
        stock: number;
        visibilityReason?: string;
        createdAt?: string | null;
        components: Array<{
          productId: number;
          sku?: string;
          name?: string;
          quantity: number;
          isGift: boolean;
          stock?: number;
          unitCost?: number;
          salePrice?: number;
        }>;
      };
    }>;
    updateAssembledOffer: (payload: {
      offerId: number;
      code?: string;
      name: string;
      description?: string;
      salePrice: number;
      startsAt: string;
      endsAt: string;
      active?: boolean;
      userId?: number | null;
      user?: string | null;
      components: Array<{
        productId: number;
        quantity: number;
        isGift: boolean;
      }>;
    }) => ReturnType<NonNullable<Window['electronAPI']>['createAssembledOffer']>;
    createInventoryProduct: (payload: {
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
    }) => Promise<{ product: DesktopProductsResponse['products'][number] }>;
    getProductBarcodes: (productId: number) => Promise<{ barcodes: DesktopProductBarcode[] }>;
    createProductBarcode: (payload: {
      productId: number;
      code: string;
      userId?: number | null;
      user?: string | null;
    }) => Promise<{ productId: number; sku?: string; barcodes: DesktopProductBarcode[] }>;
    setPrimaryProductBarcode: (payload: {
      productId: number;
      barcodeId: number;
      userId?: number | null;
      user?: string | null;
    }) => Promise<{ productId: number; sku?: string; barcodes: DesktopProductBarcode[] }>;
    updateProductBarcodeStatus: (payload: {
      productId: number;
      barcodeId: number;
      active: boolean;
      userId?: number | null;
      user?: string | null;
    }) => Promise<{ productId: number; sku?: string; barcodes: DesktopProductBarcode[] }>;
    getInactiveProducts: (search?: string) => Promise<{
      products: Array<DesktopProductsResponse['products'][number] & {
        deactivatedAt?: string | null;
      }>;
    }>;
    getProductInventoryDetail: (productId: number) => Promise<DesktopProductInventoryDetailResponse>;
    updateInventoryStockLevels: (payload: {
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
    }) => Promise<{
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
      affectedRows: number;
    }>;
    updateProductActiveStatus: (payload: {
      productId: number;
      active: boolean;
      userId?: number | null;
      user?: string | null;
    }) => Promise<{
      productId: number;
      active: boolean;
    }>;
    reactivateInventoryProduct: (payload: {
      productId: number;
      nuevoCosto: number;
      nuevoPrecioVenta: number;
      stockReingreso: number;
      userId: number;
      user: string;
    }) => Promise<{
      productId: number;
      previousCost: number;
      newCost: number;
      previousSalePrice: number;
      newSalePrice: number;
      previousStock: number;
      newStock: number;
      movementType: string;
      product: DesktopProductsResponse['products'][number];
    }>;
    createSale: (payload: {
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
    }) => Promise<DesktopSaleResponse>;
    getQuotes: (status?: string) => Promise<{ quotes: DesktopQuoteRow[] }>;
    getQuoteDetails: (quoteId: number) => Promise<DesktopQuoteDetailsResponse>;
    createQuote: (payload: {
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
    }) => Promise<DesktopQuoteDetailsResponse>;
    createPurchase: (payload: {
      userId: number;
      paymentTypeId: number;
      supplierId: number;
      invoiceNumber: string;
      purchaseDate?: string;
      transportCost?: number;
      otherDirectCost?: number;
      lines: Array<{
        productId: number;
        quantity: number;
        unitCost: number;
        lotNumber?: string;
        expiryDate?: string | null;
      }>;
    }) => Promise<{
      purchaseId: number;
      purchaseTable: string;
      paymentTypeId: number;
      supplierId: number;
      invoiceNumber: string;
      savedLines: number;
      savedAt: string;
    }>;
    createQuickInventoryPurchase: (payload: {
      productId: number;
      quantity: number;
      unitCost: number;
      expiryDate?: string | null;
      userId: number;
    }) => Promise<{
      purchaseId: number;
      purchaseTable: string;
      paymentTypeId: number;
      supplierId: number;
      invoiceNumber: string;
      savedLines: number;
      savedAt: string;
      productId: number;
      productName: string;
      quantity: number;
      unitCost: number;
      expiryDate: string | null;
    }>;
    createQuickInventoryReduction: (payload: {
      productId: number;
      quantity: number;
      reason: string;
      userId: number;
    }) => Promise<{
      productId: number;
      productName: string;
      quantity: number;
      reason: string;
      previousStock: number;
      newStock: number;
      unitCost: number;
      savedAt: string;
    }>;
    annulPurchase: (payload: {
      purchaseType: string;
      invoiceNumber: string;
      userId?: number | null;
    }) => Promise<{
      invoiceNumber: string;
      purchaseTable: string;
      annulledLines: number;
      discountedQuantity: number;
    }>;
    processPurchaseInvoiceOcr: (payload: {
      bytes: number[];
      fileName: string;
      mimeType: string;
    }) => Promise<{ text: string }>;
  };
}
