 

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middlewares/authMiddleware');
const checkoutController = require('../controllers/checkoutController');

const limitadorCheckout = rateLimit({
  windowMs: 10 * 60 * 1000,  
  max: 20,  
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      titulo: 'Demasiados intentos',
      mensaje: 'Has intentado confirmar tu pedido demasiadas veces seguidas. Espera unos minutos e intenta de nuevo.',
    });
  },
});

router.use(requireAuth);  

router.get('/', checkoutController.mostrarCheckout);    
router.post('/', limitadorCheckout, checkoutController.procesarCheckout);  

module.exports = router;
