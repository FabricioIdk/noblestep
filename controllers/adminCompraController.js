 

const {
  sequelize, OrdenCompra, DetalleOrdenCompra, Proveedor,
  VarianteProducto, Producto, MovimientoInventario, Tienda, InventarioTienda,
} = require('../models');
const { registrar } = require('../services/auditoriaService');
const { avisarSiVolvioElStock } = require('../services/avisoStockService');

exports.index = async (req, res, next) => {
  try {
    const ordenes = await OrdenCompra.findAll({
      include: [Proveedor, Tienda],
      order: [['id', 'DESC']],
    });
    const proveedores = await Proveedor.findAll({ where: { activo: true }, order: [['nombre', 'ASC']] });

    const tiendas = await Tienda.findAll({ order: [['tipo', 'ASC'], ['nombre', 'ASC']] });
    res.render('admin/compras/index', { titulo: '\u00d3rdenes de compra', ordenes, proveedores, tiendas });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { proveedor_id, tienda_destino_id } = req.body;
    const numero = `OC-${Date.now()}`;  

    const orden = await OrdenCompra.create({
      proveedor_id, tienda_destino_id, numero, estado: 'pendiente', total: 0,

    });

    res.redirect(`/admin/compras/${orden.id}`);  
  } catch (error) {
    next(error);
  }
};

exports.show = async (req, res, next) => {
  try {
    const orden = await OrdenCompra.findByPk(req.params.id, { include: [Proveedor, Tienda] });
    if (!orden) {
      return res.status(404).render('404', { titulo: 'Orden de compra no encontrada' });
    }

    const lineas = await DetalleOrdenCompra.findAll({
      where: { orden_compra_id: orden.id },
      include: [{ model: VarianteProducto }],
    });
    for (const l of lineas) {
      l.producto = await Producto.findByPk(l.VarianteProducto.producto_id);
    }

    const variantes = await VarianteProducto.findAll();
    for (const v of variantes) { v.producto = await Producto.findByPk(v.producto_id); }

    res.render('admin/compras/detalle', {
      titulo: `Orden ${orden.numero}`, orden, lineas, variantes, error: null,
    });
  } catch (error) {
    next(error);
  }
};

exports.agregarDetalle = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const orden = await OrdenCompra.findByPk(req.params.id, { transaction: t });
    if (!orden || orden.estado !== 'pendiente') {

      await t.rollback();
      return res.redirect(`/admin/compras/${req.params.id}`);
    }

    const { variante_id, cantidad, costo_unitario } = req.body;
    const cantidadNum = parseInt(cantidad, 10);
    const costoNum = parseFloat(costo_unitario);

    await DetalleOrdenCompra.create({
      orden_compra_id: orden.id, variante_id, cantidad: cantidadNum, costo_unitario: costoNum,
    }, { transaction: t });

    await orden.update({ total: Number(orden.total) + cantidadNum * costoNum }, { transaction: t });

    await t.commit();
    res.redirect(`/admin/compras/${orden.id}`);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.recibir = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const orden = await OrdenCompra.findByPk(req.params.id, { transaction: t });
    if (!orden || orden.estado !== 'pendiente') {
      await t.rollback();
      return res.redirect(`/admin/compras/${req.params.id}`);
    }

    const lineas = await DetalleOrdenCompra.findAll({
      where: { orden_compra_id: orden.id }, transaction: t,
    });

    if (lineas.length === 0) {

      await t.rollback();
      const ordenCompleta = await OrdenCompra.findByPk(orden.id, { include: [Proveedor, Tienda] });
      const variantes = await VarianteProducto.findAll();
      for (const v of variantes) { v.producto = await Producto.findByPk(v.producto_id); }
      return res.render('admin/compras/detalle', {
        titulo: `Orden ${orden.numero}`, orden: ordenCompleta, lineas: [], variantes,
        error: 'No puedes recibir una orden sin productos agregados.',
      });
    }

    for (const linea of lineas) {

      let inv = await InventarioTienda.findOne({
        where: { tienda_id: orden.tienda_destino_id, variante_id: linea.variante_id }, transaction: t,
      });
      if (!inv) {
        inv = await InventarioTienda.create({
          tienda_id: orden.tienda_destino_id, variante_id: linea.variante_id, stock: 0, stock_minimo: 5,
        }, { transaction: t });
      }
      await inv.update({ stock: inv.stock + linea.cantidad }, { transaction: t });

      await MovimientoInventario.create({
        variante_id: linea.variante_id, tienda_id: orden.tienda_destino_id, tipo: 'entrada', cantidad: linea.cantidad,
        motivo: 'Recepci\u00f3n de orden de compra', referencia: orden.numero,
      }, { transaction: t });
    }

    await orden.update({ estado: 'recibida' }, { transaction: t });
    await t.commit();

    for (const linea of lineas) {
      await avisarSiVolvioElStock(linea.variante_id);
    }

    await registrar(
      req.session.usuario.id, 'recepcion_orden_compra', 'ordenes_compra', orden.id,
      `Orden ${orden.numero} recibida, stock actualizado en ${lineas.length} variante(s)`
    );

    res.redirect(`/admin/compras/${orden.id}`);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

exports.cancelar = async (req, res, next) => {
  try {
    const orden = await OrdenCompra.findByPk(req.params.id);
    if (orden && orden.estado === 'pendiente') {

      await orden.update({ estado: 'cancelada' });
    }
    res.redirect(`/admin/compras/${req.params.id}`);
  } catch (error) {
    next(error);
  }
};
