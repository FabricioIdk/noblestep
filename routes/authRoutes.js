 

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const limitadorIntentos = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 10,  
  standardHeaders: true,  
  legacyHeaders: false,   
  message: 'Demasiados intentos. Por favor espera unos minutos antes de volver a intentarlo.',
  handler: (req, res) => {

    res.status(429).render('error', {
      titulo: 'Demasiados intentos',
      mensaje: 'Has hecho demasiados intentos en poco tiempo. Espera unos minutos antes de volver a intentarlo.',
    });
  },
});

router.get('/registro', authController.registroForm);
router.post('/registro', limitadorIntentos, authController.registro);

router.get('/login', authController.loginForm);
router.post('/login', limitadorIntentos, authController.login);

router.post('/logout', authController.logout);

router.get('/olvide-password', authController.olvideForm);
router.post('/olvide-password', limitadorIntentos, authController.olvideSubmit);
router.get('/restablecer-password/:token', authController.restablecerForm);
router.post('/restablecer-password/:token', limitadorIntentos, authController.restablecerSubmit);

module.exports = router;
