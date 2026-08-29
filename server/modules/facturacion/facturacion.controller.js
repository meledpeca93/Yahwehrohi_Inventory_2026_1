const { createFacturacionService } = require('./facturacion.service');
const { toBillingProductsResponse, toSaleResponse } = require('./facturacion.dto');

function createFacturacionController({
  resetPool,
  ...dependencies
}) {
  const facturacionService = createFacturacionService(dependencies);

  async function listBillingProducts(_req, res) {
    try {
      const products = await facturacionService.listBillingProducts();
      return res.json(toBillingProductsResponse(products));
    } catch (error) {
      try {
        await resetPool();
        const products = await facturacionService.listBillingProducts();
        return res.json(toBillingProductsResponse(products));
      } catch (retryError) {
        console.error('Error al obtener catalogo ligero de facturacion:', retryError.message || retryError);
        return res.status(500).json({
          message: retryError.message || 'Error al obtener productos de facturacion',
        });
      }
    }
  }

  async function createSale(req, res) {
    const { user, userId, paymentTypeId, customerId, lines, quoteId } = req.body || {};

    try {
      const sale = await facturacionService.createSale({ user, userId, paymentTypeId, customerId, lines, quoteId });
      return res.status(201).json(toSaleResponse(sale));
    } catch (error) {
      return res.status(500).json({ message: error.message || 'Error al registrar la venta' });
    }
  }

  return {
    listBillingProducts,
    createSale,
  };
}

module.exports = {
  createFacturacionController,
};
