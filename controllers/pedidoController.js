 

const { Pedido, DetallePedido, VarianteProducto, Producto, Direccion, Pago, Cupon, Envio, Tienda } = require('../models');

exports.misPedidos = async (req, res, next) => {
  try {
    const pedidos = await Pedido.findAll({

      where: { usuario_id: req.session.usuario.id },
      order: [['fecha_pedido', 'DESC']],  
    });
    res.render('pedidos/index', { titulo: 'Mis pedidos', pedidos });
  } catch (error) {
    next(error);
  }
};

exports.verPedido = async (req, res, next) => {
  try {
    const pedido = await Pedido.findOne({

      where: { id: req.params.id, usuario_id: req.session.usuario.id },
      include: [Direccion, Cupon, Pago, Envio, Tienda],

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

    res.render('pedidos/detalle', { titulo: `Pedido ${pedido.numero_pedido}`, pedido, lineas });
  } catch (error) {
    next(error);
  }
};
