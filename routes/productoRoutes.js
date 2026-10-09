 

const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const solicitudStockController = require('../controllers/solicitudStockController');

router.get('/', productoController.index);    
router.get('/:id', productoController.show);  

router.post('/:productoId/avisame', solicitudStockController.crear);

module.exports = router;
