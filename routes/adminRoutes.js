 

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const csrfProtection = require('../middlewares/csrf');
const adminProductoController = require('../controllers/adminProductoController');
const adminCategoriaController = require('../controllers/adminCategoriaController');
const adminPedidoController = require('../controllers/adminPedidoController');
const adminReporteController = require('../controllers/adminReporteController');
const adminCuponController = require('../controllers/adminCuponController');
const adminInventarioController = require('../controllers/adminInventarioController');
const adminProveedorController = require('../controllers/adminProveedorController');
const adminCompraController = require('../controllers/adminCompraController');
const adminEnvioController = require('../controllers/adminEnvioController');
const adminPagoController = require('../controllers/adminPagoController');
const adminTiendaController = require('../controllers/adminTiendaController');
const adminConfiguracionController = require('../controllers/adminConfiguracionController');
const adminAuditoriaController = require('../controllers/adminAuditoriaController');

router.use(requireAdmin);

router.get('/', adminReporteController.dashboard);

router.get('/productos', adminProductoController.index);
router.get('/productos/nuevo', adminProductoController.createForm);

router.post('/productos', upload.single('imagen'), csrfProtection, adminProductoController.store);
router.get('/productos/:id/editar', adminProductoController.editForm);
router.post('/productos/:id', upload.single('imagen'), csrfProtection, adminProductoController.update);

router.post('/productos/:id/eliminar', adminProductoController.destroy);

router.post('/productos/:id/variantes', adminProductoController.agregarVariante);
router.post('/productos/:id/variantes/:varianteId/eliminar', adminProductoController.eliminarVariante);

router.post('/productos/:id/imagenes', upload.single('imagen'), csrfProtection, adminProductoController.agregarImagen);
router.post('/productos/:id/imagenes/:imagenId/eliminar', adminProductoController.eliminarImagen);

router.get('/categorias', adminCategoriaController.index);
router.post('/categorias', adminCategoriaController.store);
router.post('/categorias/:id/eliminar', adminCategoriaController.destroy);

router.get('/pedidos', adminPedidoController.index);
router.get('/pedidos/:id', adminPedidoController.show);
router.post('/pedidos/:id/estado', adminPedidoController.actualizarEstado);
router.post('/pedidos/:id/envio', adminEnvioController.guardar);

router.get('/pagos', adminPagoController.index);
router.get('/envios', adminEnvioController.index);

router.get('/tiendas', adminTiendaController.index);
router.post('/tiendas', adminTiendaController.store);
router.post('/tiendas/:id/toggle', adminTiendaController.toggle);

router.get('/configuracion', adminConfiguracionController.index);
router.post('/configuracion', adminConfiguracionController.guardar);
router.post('/configuracion/:id/eliminar', adminConfiguracionController.eliminar);

router.get('/auditoria', adminAuditoriaController.index);

router.get('/reportes', adminReporteController.index);

router.get('/cupones', adminCuponController.index);
router.post('/cupones', adminCuponController.store);
router.post('/cupones/:id/toggle', adminCuponController.toggle);
router.post('/cupones/:id/eliminar', adminCuponController.destroy);

router.get('/inventario', adminInventarioController.index);
router.post('/inventario/movimiento', adminInventarioController.registrarMovimiento);

router.get('/proveedores', adminProveedorController.index);
router.post('/proveedores', adminProveedorController.store);
router.post('/proveedores/:id/toggle', adminProveedorController.toggle);

router.get('/compras', adminCompraController.index);
router.post('/compras', adminCompraController.store);
router.get('/compras/:id', adminCompraController.show);
router.post('/compras/:id/detalle', adminCompraController.agregarDetalle);
router.post('/compras/:id/recibir', adminCompraController.recibir);
router.post('/compras/:id/cancelar', adminCompraController.cancelar);

module.exports = router;
