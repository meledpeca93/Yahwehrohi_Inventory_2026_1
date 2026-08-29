function parseReactivarProductoRequest(payload = {}) {
  const nuevoCosto = Number(payload.nuevoCosto ?? payload.newCost ?? payload.unitCost);
  const nuevoPrecioVenta = Number(payload.nuevoPrecioVenta ?? payload.nuevoPrecio ?? payload.salePrice);
  const stockReingreso = Number(payload.stockReingreso ?? payload.stockInicial ?? payload.reentryStock);

  return {
    nuevoCosto,
    nuevoPrecioVenta,
    stockReingreso,
    userId: payload.userId ?? null,
    user: payload.user ?? null,
  };
}

function toInventoryProductResponse(product) {
  return {
    ...product,
    margin: product?.unitCost > 0 ? (Number(product.salePrice || 0) - Number(product.unitCost || 0)) / Number(product.unitCost || 1) : 0,
  };
}

function toInactiveProductsResponse(products) {
  return {
    products: (Array.isArray(products) ? products : []).map(toInventoryProductResponse),
  };
}

function toReactivatedProductResponse(result) {
  return {
    ...result,
    product: toInventoryProductResponse(result.product),
  };
}

module.exports = {
  parseReactivarProductoRequest,
  toInactiveProductsResponse,
  toReactivatedProductResponse,
};
