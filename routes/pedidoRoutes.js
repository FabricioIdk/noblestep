 

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const pedidoController = require('../controllers/pedidoController');
const pagoController = require('../controllers/pagoController');

router.use(requireAuth);

router.get('/', pedidoController.misPedidos);               
router.get('/:id', pedidoController.verPedido);              
router.get('/:id/pagar', pagoController.mostrarFormulario);
router.post('/:id/pagar', pagoController.iniciarPago);
router.get('/:id/pago/retorno', pagoController.retornoPago);

module.exports = router;
