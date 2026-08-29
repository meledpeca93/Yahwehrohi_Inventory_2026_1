function createFacturacionRepository({
  getBillingProducts,
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
  };
}

module.exports = {
  createFacturacionRepository,
};
