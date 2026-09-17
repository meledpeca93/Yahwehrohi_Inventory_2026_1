const { createFacturacionService } = require('./facturacion.service');
const { toBillingProductAvailabilityResponse, toBillingProductsResponse, toSaleResponse } = require('./facturacion.dto');

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

  async function getBillingProductAvailability(req, res) {
    const { productIds } = req.body || {};

    try {
      const products = await facturacionService.getBillingProductAvailability(productIds);
      return res.json(toBillingProductAvailabilityResponse(products));
    } catch (error) {
      try {
        await resetPool();
        const products = await facturacionService.getBillingProductAvailability(productIds);
        return res.json(toBillingProductAvailabilityResponse(products));
      } catch (retryError) {
        console.error('Error al validar disponibilidad de productos:', retryError.message || retryError);
        return res.status(500).json({ message: retryError.message || 'Error al validar disponibilidad de productos' });
      }
    }
  }

  return {
    listBillingProducts,
    createSale,
    getBillingProductAvailability,
  };
}

module.exports = {
  createFacturacionController,
};
