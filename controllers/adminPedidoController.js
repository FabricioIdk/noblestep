 

const {
  sequelize, Pedido, DetallePedido, VarianteProducto, Producto,
  Usuario, Direccion, Pago, Cupon, Envio, InventarioTienda, Tienda,
} = require('../models');
const { registrar } = require('../services/auditoriaService');
const { avisarSiVolvioElStock } = require('../services/avisoStockService');

const ESTADOS_VALIDOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

exports.index = async (req, res, next) => {
  try {
    const filtroEstado = req.query.estado;

    const where = filtroEstado && ESTADOS_VALIDOS.includes(filtroEstado) ? { estado: filtroEstado } : {};

    const pedidos = await Pedido.findAll({
      where,
      include: [Usuario],  
      order: [['fecha_pedido', 'DESC']],
    });

    res.render('admin/pedidos/index', {
      titulo: 'Pedidos', pedidos, estados: ESTADOS_VALIDOS, filtroEstado: filtroEstado || '',
    });
  } catch (error) {
    next(error);
  }
};

exports.show = async (req, res, next) => {
  try {

    const pedido = await Pedido.findByPk(req.params.id, {
      include: [Usuario, Direccion, Cupon, Pago, Envio, Tienda],
    });
    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }

    const lineas = await DetallePedido.findAll({
      where: { pedido_id: pedido.id },
      include: [{ model: VarianteProducto }],
    });
    for (const linea of lineas) {
      linea.producto = await Producto.findByPk(linea.VarianteProducto.producto_id);
    }

    res.render('admin/pedidos/detalle', {
      titulo: `Pedido ${pedido.numero_pedido}`, pedido, lineas, estados: ESTADOS_VALIDOS,
    });
  } catch (error) {
    next(error);
  }
};

exports.actualizarEstado = async (req, res, next) => {

  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findByPk(req.params.id, { transaction: t });
    if (!pedido) {
      await t.rollback();
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }

    const nuevoEstado = req.body.estado;
    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {

      await t.rollback();
      return res.redirect(`/admin/pedidos/${pedido.id}`);
    }

    const seEstaCancelandoRecien = nuevoEstado === 'cancelado' && pedido.estado !== 'cancelado';
    let lineasCanceladas = [];

    if (seEstaCancelandoRecien) {
      const lineas = await DetallePedido.findAll({ where: { pedido_id: pedido.id }, transaction: t });
      lineasCanceladas = lineas;
      for (const linea of lineas) {

        const inv = await InventarioTienda.findOne({
          where: { tienda_id: pedido.tienda_id, variante_id: linea.variante_id }, transaction: t,
        });
        if (inv) {
          await inv.update({ stock: inv.stock + linea.cantidad }, { transaction: t });
        }
      }
    }

    await pedido.update({ estado: nuevoEstado }, { transaction: t });
    await t.commit();

    for (const linea of lineasCanceladas) {
      await avisarSiVolvioElStock(linea.variante_id);
    }

    await registrar(
      req.session.usuario.id, 'cambio_estado_pedido', 'pedidos', pedido.id,
      `Estado cambiado a "${nuevoEstado}" (pedido ${pedido.numero_pedido})`
    );

    res.redirect(`/admin/pedidos/${pedido.id}`);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};
