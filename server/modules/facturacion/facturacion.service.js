const { createFacturacionRepository } = require('./facturacion.repository');

function createFacturacionService(dependencies) {
  const repository = createFacturacionRepository(dependencies);

  return {
    listBillingProducts() {
      return repository.listBillingProducts();
    },

    createSale(payload) {
      return repository.createSale(payload);
    },
  };
}

module.exports = {
  createFacturacionService,
};
