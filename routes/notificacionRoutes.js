 

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const notificacionController = require('../controllers/notificacionController');

router.use(requireAuth);

router.get('/', notificacionController.index);                     
router.post('/:id/leer', notificacionController.marcarLeida);       
router.post('/marcar-todas', notificacionController.marcarTodas);   

module.exports = router;
