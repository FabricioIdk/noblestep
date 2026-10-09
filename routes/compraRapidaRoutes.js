 

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const compraRapidaController = require('../controllers/compraRapidaController');

const limitadorCompraRapida = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      titulo: 'Demasiados intentos',
      mensaje: 'Has intentado comprar demasiadas veces seguidas. Espera unos minutos e intenta de nuevo.',
    });
  },
});

router.get('/:varianteId', compraRapidaController.mostrarFormulario);
router.post('/', limitadorCompraRapida, compraRapidaController.procesar);

module.exports = router;
