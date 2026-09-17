function createFacturacionRepository({
  getBillingProducts,
  getBillingProductAvailability,
  registerSale,
  resolveProductImageUrl,
}) {
  return {
    listBillingProducts() {
      return getBillingProducts({ resolveProductImageUrl });
    },

    createSale(payload) {
      return registerSale(payload);
    },

    getBillingProductAvailability(productIds) {
      return getBillingProductAvailability(productIds);
    },
  };
}

module.exports = {
  createFacturacionRepository,
};
