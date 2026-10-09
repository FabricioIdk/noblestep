 

const { sequelize, VarianteProducto, Producto, MovimientoInventario, Tienda, InventarioTienda } = require('../models');
const { registrar } = require('../services/auditoriaService');
const { avisarSiVolvioElStock } = require('../services/avisoStockService');

exports.index = async (req, res, next) => {
  try {
    const tiendas = await Tienda.findAll({ order: [['tipo', 'ASC'], ['nombre', 'ASC']] });

    const tiendaId = req.query.tienda_id || (tiendas[0] ? tiendas[0].id : null);

    let inventario = [];
    let movimientos = [];
    if (tiendaId) {
      inventario = await InventarioTienda.findAll({
        where: { tienda_id: tiendaId },
        include: [{ model: VarianteProducto }],
        order: [['stock', 'ASC']],  
      });
      for (const i of inventario) { i.producto = await Producto.findByPk(i.VarianteProducto.producto_id); }

      movimientos = await MovimientoInventario.findAll({
        where: { tienda_id: tiendaId },
        include: [{ model: VarianteProducto }],
        order: [['fecha', 'DESC']],
        limit: 20,  
      });
      for (const m of movimientos) { m.producto = await Producto.findByPk(m.VarianteProducto.producto_id); }
    }

    const variantes = await VarianteProducto.findAll();
    for (const v of variantes) { v.producto = await Producto.findByPk(v.producto_id); }

    res.render('admin/inventario/index', {
      titulo: 'Inventario', tiendas, tiendaId: tiendaId ? String(tiendaId) : '',
      inventario, movimientos, variantes, error: null,
    });
  } catch (error) {
    next(error);
  }
};

exports.registrarMovimiento = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { tienda_id, variante_id, tipo, cantidad, motivo } = req.body;
    const cantidadNum = parseInt(cantidad, 10);

    if (!tienda_id || !cantidadNum || cantidadNum < 0) {
      await t.rollback();
      return res.redirect(`/admin/inventario?tienda_id=${tienda_id || ''}`);
    }

    let [inv] = await InventarioTienda.findOrCreate({
      where: { tienda_id, variante_id }, defaults: { stock: 0, stock_minimo: 5 }, transaction: t,
    });

    let delta;
    if (tipo === 'entrada') {
      delta = cantidadNum;  
    } else if (tipo === 'salida') {
      if (cantidadNum > inv.stock) {

        await t.rollback();
        return res.redirect(`/admin/inventario?tienda_id=${tienda_id}&error=stock`);
      }
      delta = -cantidadNum;  
    } else if (tipo === 'ajuste') {

      delta = cantidadNum - inv.stock;
    } else {
      await t.rollback();
      return res.redirect(`/admin/inventario?tienda_id=${tienda_id}`);
    }

    await MovimientoInventario.create({
      variante_id, tienda_id, tipo, cantidad: delta, motivo, referencia: 'Manual - panel admin',
    }, { transaction: t });

    await inv.update({ stock: inv.stock + delta }, { transaction: t });

    await t.commit();

    if (delta > 0) {
      await avisarSiVolvioElStock(variante_id);
    }

    await registrar(
      req.session.usuario.id, 'movimiento_inventario_manual', 'inventario_tienda', inv.id,
      `Tienda ${tienda_id} - Tipo: ${tipo}, cantidad: ${delta > 0 ? '+' : ''}${delta}, motivo: ${motivo || 'sin especificar'}`
    );

    res.redirect(`/admin/inventario?tienda_id=${tienda_id}`);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};
