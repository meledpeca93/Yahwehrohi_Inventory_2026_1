const express = require('express');
const { createFacturacionController } = require('./facturacion.controller');

function createFacturacionRouter(dependencies) {
  const router = express.Router();
  const controller = createFacturacionController(dependencies);

  router.get('/billing/products', controller.listBillingProducts);
  router.post('/sales', controller.createSale);

  return router;
}

module.exports = {
  createFacturacionRouter,
};
