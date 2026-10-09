 
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const favoritoController = require('../controllers/favoritoController');

router.use(requireAuth);  

router.get('/', favoritoController.index);
router.post('/:productoId/toggle', favoritoController.toggle);

module.exports = router;
