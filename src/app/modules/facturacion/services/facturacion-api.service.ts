import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface BillingProductDto {
  id: number;
  sku: string;
  barcodes?: ProductBarcodeDto[];
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
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ProductBarcodeDto {
  id: number;
  productId: number;
  code: string;
  isPrimary: boolean;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface BillingProductsResponse {
  products: BillingProductDto[];
}

export interface BillingProductAvailabilityDto {
  productId: number;
  stock: number;
  available: boolean;
}

export interface BillingProductAvailabilityResponse {
  products: BillingProductAvailabilityDto[];
}

export interface SaleCreatePayload {
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
}

export interface SaleUpdatedProductDto {
  productId: number;
  stock: number;
}

export interface SaleResponseDto {
  invoiceId: number;
  expectedInvoiceId: number;
  saleId: number;
  saleTable: string;
  saleStatusId: number;
  savedLines: number;
  savedAt: string;
  updatedProducts?: SaleUpdatedProductDto[];
}

@Injectable({ providedIn: 'root' })
export class FacturacionApiService {
  private readonly desktopApi = window.electronAPI;

  constructor(private readonly http: HttpClient) {}

  getBillingProducts(): Promise<BillingProductsResponse> {
    if (this.desktopApi?.getBillingProducts) {
      return this.desktopApi.getBillingProducts();
    }

    return firstValueFrom(this.http.get<BillingProductsResponse>('/api/billing/products'));
  }

  createSale(payload: SaleCreatePayload): Promise<SaleResponseDto> {
    if (this.desktopApi) {
      return this.desktopApi.createSale(payload);
    }

    return firstValueFrom(this.http.post<SaleResponseDto>('/api/sales', payload));
  }

  getBillingProductAvailability(productIds: number[]): Promise<BillingProductAvailabilityResponse> {
    if (this.desktopApi?.getBillingProductAvailability) {
      return this.desktopApi.getBillingProductAvailability(productIds);
    }

    return firstValueFrom(this.http.post<BillingProductAvailabilityResponse>(
      '/api/billing/products/availability',
      { productIds },
    ));
  }
}
