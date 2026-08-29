function toBillingProductsResponse(products) {
  return {
    products: (Array.isArray(products) ? products : []).map((product) => ({
      id: Number(product.id),
      sku: product.sku || '',
      name: product.name || '',
      description: product.description || null,
      imageUrl: product.imageUrl || null,
      category: product.category || 'Sin categoria',
      stock: Number(product.stock || 0),
      minStock: Number(product.minStock || 0),
      maxStock: product.maxStock === null || product.maxStock === undefined ? null : Number(product.maxStock),
      unitCost: Number(product.unitCost || 0),
      salePrice: Number(product.salePrice || 0),
      wholesalePrice: product.wholesalePrice === null || product.wholesalePrice === undefined ? null : Number(product.wholesalePrice),
      unitMeasure: product.unitMeasure || null,
      allowsDecimalQuantity: Boolean(product.allowsDecimalQuantity),
      createdBy: product.createdBy || null,
      updatedBy: product.updatedBy || null,
      createdAt: product.createdAt || null,
      updatedAt: product.updatedAt || null,
      isAssembledOffer: Boolean(product.isAssembledOffer),
      offerId: product.offerId === null || product.offerId === undefined ? null : Number(product.offerId),
      offerStatus: product.offerStatus || null,
      offerStartsAt: product.offerStartsAt || null,
      offerEndsAt: product.offerEndsAt || null,
      offerComponents: Array.isArray(product.offerComponents) ? product.offerComponents : [],
    })),
  };
}

function toSaleResponse(sale) {
  return {
    ...sale,
    updatedProducts: (sale?.updatedProducts || []).map((product) => ({
      productId: Number(product.productId),
      stock: Number(product.stock || 0),
    })),
  };
}

module.exports = {
  toBillingProductsResponse,
  toSaleResponse,
};
