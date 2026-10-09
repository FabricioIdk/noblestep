 

const { Op } = require('sequelize');
const {
  Usuario, Pedido, DetallePedido, VarianteProducto, Producto, Favorito, Direccion,
} = require('../models');

function conPrecioEfectivo(producto) {
  const tieneOferta = producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);
  producto.enOferta = !!tieneOferta;
  producto.precioEfectivo = tieneOferta ? Number(producto.precio_oferta) : Number(producto.precio);
  return producto;
}

async function productosComprados(usuarioId, limite) {
  const pedidos = await Pedido.findAll({
    where: { usuario_id: usuarioId, estado: { [Op.ne]: 'cancelado' } },
    attributes: ['id'],
    order: [['fecha_pedido', 'DESC']],
    limit: 10,
  });
  if (pedidos.length === 0) return [];

  const detalles = await DetallePedido.findAll({
    where: { pedido_id: pedidos.map((p) => p.id) },
    include: [{ model: VarianteProducto, attributes: ['id', 'producto_id'] }],
    order: [['pedido_id', 'DESC']],
  });

  const ids = [];
  for (const d of detalles) {
    const productoId = d.VarianteProducto && d.VarianteProducto.producto_id;
    if (productoId && !ids.includes(productoId)) ids.push(productoId);
  }

  const productos = await Producto.findAll({ where: { id: ids.slice(0, 12), activo: true } });
  const porId = new Map(productos.map((p) => [p.id, p]));
  return ids
    .map((id) => porId.get(id))
    .filter(Boolean)
    .slice(0, limite)
    .map(conPrecioEfectivo);
}

exports.index = async (req, res, next) => {
  try {
    const usuarioId = req.session.usuario.id;

    const [
      usuario, ultimosPedidos, totalPedidos, pedidosEnCurso,
      totalFavoritos, favoritosRecientes, direcciones, comprados,
    ] = await Promise.all([
      Usuario.findByPk(usuarioId, { attributes: { exclude: ['password', 'reset_token', 'reset_token_expira'] } }),
      Pedido.findAll({ where: { usuario_id: usuarioId }, order: [['fecha_pedido', 'DESC']], limit: 5 }),
      Pedido.count({ where: { usuario_id: usuarioId } }),
      Pedido.count({ where: { usuario_id: usuarioId, estado: { [Op.in]: ['pendiente', 'pagado', 'enviado'] } } }),
      Favorito.count({ where: { usuario_id: usuarioId } }),
      Favorito.findAll({
        where: { usuario_id: usuarioId },
        include: [{ model: Producto }],
        order: [['created_at', 'DESC']],
        limit: 4,
      }),
      Direccion.findAll({ where: { usuario_id: usuarioId }, order: [['predeterminada', 'DESC'], ['id', 'DESC']] }),
      productosComprados(usuarioId, 6),
    ]);

    const favoritos = favoritosRecientes.map((f) => f.Producto).filter(Boolean).map(conPrecioEfectivo);

    res.render('mi-cuenta', {
      titulo: 'Mi cuenta',

      cuenta: usuario || req.session.usuario,
      ultimosPedidos,
      totalPedidos,
      pedidosEnCurso,
      totalFavoritos,
      favoritos,
      direcciones,
      comprados,
    });
  } catch (error) {
    next(error);
  }
};
