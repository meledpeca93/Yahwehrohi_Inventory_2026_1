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
    margin?: number;
  }>;
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
    lotNumber: number | null;
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

interface DesktopCreditPayment {
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

interface DesktopCreditPaymentAllocationResponse {
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
}

interface Window {
  electronAPI?: {
    health: () => Promise<{ ok: boolean; database?: string; message?: string }>;
    login: (credentials: { usuario: string; pass: string }) => Promise<DesktopLoginResponse>;
    getUsers: () => Promise<DesktopUsersResponse>;
    getAttendanceUsers: () => Promise<DesktopAttendanceUsersResponse>;
    saveAttendanceMark: (payload: {
      employeeId: number;
      date: string;
      entryTime: string;
      exitTime: string;
      recordedBy: string;
      observation?: string;
    }) => Promise<DesktopAttendanceMarkResponse>;
    getCustomers: () => Promise<DesktopCustomersResponse>;
    getSuppliers: () => Promise<DesktopSuppliersResponse>;
    getExpiringProducts: () => Promise<DesktopExpiringProductsResponse>;
    getPurchases: () => Promise<DesktopPurchasesResponse>;
    getCredits: () => Promise<DesktopCreditsResponse>;
    createCreditPayment: (payload: {
      customerId: number;
      amount: number;
      userId: number;
      description?: string;
    }) => Promise<{ payment: DesktopCreditPaymentAllocationResponse }>;
    getNextInvoiceNumber: () => Promise<{ nextInvoiceNumber: number }>;
    getInvoices: () => Promise<{ invoices: DesktopInvoiceRow[] }>;
    getTodayInvoices: () => Promise<{ invoices: DesktopInvoiceRow[] }>;
    getDailyCuts: (dateFrom?: string, dateTo?: string, userId?: number) => Promise<{ cuts: DesktopDailyCut[] }>;
    previewDailyCut: (date?: string, userId?: number) => Promise<{ cut: DesktopDailyCut }>;
    createDailyCut: (payload: { date: string; physicalCashCount?: number; userId: number }) => Promise<{ cut: DesktopDailyCut }>;
    createOpeningCut: (payload: { date: string; initialCash: number; userId: number }) => Promise<{ cut: DesktopDailyCut }>;
    getCreditPayments: (date?: string, userId?: number) => Promise<{ payments: DesktopCreditPayment[] }>;
    closeApp: () => Promise<void>;
    getInvoicesSummary: () => Promise<DesktopInvoicesSummaryResponse>;
    getInvoiceDetails: (invoiceId: number) => Promise<{ lines: DesktopInvoiceLine[] }>;
    annulInvoice: (invoiceId: number) => Promise<{
      invoiceId: number;
      restoredLines: number;
      restoredQuantity: number;
      saleTable: string;
    }>;
    activateInvoice: (invoiceId: number) => Promise<{
      invoiceId: number;
      activatedLines: number;
      deductedQuantity: number;
      saleTable: string;
      saleStatusId: number;
    }>;
    getDashboardSalesSummary: () => Promise<DesktopDashboardSalesSummaryResponse>;
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
    getProducts: () => Promise<DesktopProductsResponse>;
    updateInventoryStockLevels: (payload: {
      productId: number;
      stock: number;
      minStock: number;
      maxStock: number | null;
    }) => Promise<{
      productId: number;
      stock: number;
      minStock: number;
      maxStock: number | null;
      affectedRows: number;
    }>;
    createSale: (payload: {
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
    }) => Promise<DesktopSaleResponse>;
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
    processPurchaseInvoiceOcr: (payload: {
      bytes: number[];
      fileName: string;
      mimeType: string;
    }) => Promise<{ text: string }>;
  };
}
