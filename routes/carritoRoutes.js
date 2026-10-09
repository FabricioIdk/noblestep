 

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const carritoController = require('../controllers/carritoController');

router.use(requireAuth);

router.get('/', carritoController.index);               
router.post('/agregar', carritoController.agregar);       
router.post('/item/:id', carritoController.actualizar);   
router.post('/item/:id/eliminar', carritoController.eliminarItem);  
router.post('/vaciar', carritoController.vaciar);         

module.exports = router;
