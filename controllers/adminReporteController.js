 

const { QueryTypes } = require('sequelize');
const { sequelize, Producto, Usuario, VarianteProducto } = require('../models');

const ESTADOS_QUE_CUENTAN_COMO_VENTA = ['pagado', 'enviado', 'entregado'];

exports.index = async (req, res, next) => {
  try {

    const [ingresosRow] = await sequelize.query(`
      SELECT COALESCE(SUM(total), 0) as total_ingresos, COUNT(*) as total_pedidos_pagados,
             COALESCE(AVG(total), 0) as ticket_promedio
      FROM pedidos
      WHERE estado IN (:estados)
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA }, type: QueryTypes.SELECT });

    const [ventasHoyRow] = await sequelize.query(`
      SELECT COALESCE(SUM(total), 0) as monto, COUNT(*) as cantidad
      FROM pedidos
      WHERE estado IN (:estados) AND DATE(fecha_pedido) = CURDATE()
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA }, type: QueryTypes.SELECT });

    const [ventasMesRow] = await sequelize.query(`
      SELECT COALESCE(SUM(total), 0) as monto, COUNT(*) as cantidad
      FROM pedidos
      WHERE estado IN (:estados)
        AND YEAR(fecha_pedido) = YEAR(CURDATE()) AND MONTH(fecha_pedido) = MONTH(CURDATE())
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA }, type: QueryTypes.SELECT });

    const totalPedidos = await sequelize.query(
      'SELECT COUNT(*) as total FROM pedidos', { type: QueryTypes.SELECT }
    );
    const productosActivos = await Producto.count({ where: { activo: true } });
    const clientesRegistrados = await Usuario.count({ where: { rol: 'cliente' } });
    const alertasStock = await sequelize.query(
      'SELECT COUNT(*) as total FROM inventario_tienda WHERE stock <= stock_minimo',
      { type: QueryTypes.SELECT }
    );

    const pedidosPorEstado = await sequelize.query(`
      SELECT estado, COUNT(*) as cantidad
      FROM pedidos
      GROUP BY estado
      ORDER BY FIELD(estado, 'pendiente','pagado','enviado','entregado','cancelado')
    `, { type: QueryTypes.SELECT });

    const topProductos = await sequelize.query(`
      SELECT p.nombre, SUM(dp.cantidad) as unidades_vendidas, SUM(dp.subtotal) as ingresos_generados
      FROM detalle_pedido dp
      JOIN variantes_producto vp ON dp.variante_id = vp.id
      JOIN productos p ON vp.producto_id = p.id
      JOIN pedidos pe ON dp.pedido_id = pe.id
      WHERE pe.estado != 'cancelado'
      GROUP BY p.id, p.nombre
      ORDER BY unidades_vendidas DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    const topClientes = await sequelize.query(`
      SELECT u.nombre, u.apellido, u.email, COUNT(pe.id) as cantidad_pedidos, SUM(pe.total) as total_gastado
      FROM pedidos pe
      JOIN usuarios u ON pe.usuario_id = u.id
      WHERE pe.estado != 'cancelado'
      GROUP BY u.id, u.nombre, u.apellido, u.email
      ORDER BY total_gastado DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT });

    const stockCritico = await sequelize.query(`
      SELECT t.nombre as tienda, p.nombre as producto, vp.talla, vp.color, it.stock, it.stock_minimo
      FROM inventario_tienda it
      JOIN variantes_producto vp ON it.variante_id = vp.id
      JOIN productos p ON vp.producto_id = p.id
      JOIN tiendas t ON it.tienda_id = t.id
      WHERE it.stock <= it.stock_minimo
      ORDER BY it.stock ASC
    `, { type: QueryTypes.SELECT });

    const ventasPorTienda = await sequelize.query(`
      SELECT t.nombre as tienda, t.tipo, COUNT(pe.id) as cantidad_pedidos, COALESCE(SUM(pe.total), 0) as monto
      FROM tiendas t
      LEFT JOIN pedidos pe ON pe.tienda_id = t.id AND pe.estado != 'cancelado'
      GROUP BY t.id, t.nombre, t.tipo
      ORDER BY monto DESC
    `, { type: QueryTypes.SELECT });

    const usoCupones = await sequelize.query(`
      SELECT c.codigo, c.tipo_descuento, c.valor, c.activo, COUNT(pe.id) as veces_usado
      FROM cupones c
      LEFT JOIN pedidos pe ON pe.cupon_id = c.id
      GROUP BY c.id, c.codigo, c.tipo_descuento, c.valor, c.activo
      ORDER BY veces_usado DESC
    `, { type: QueryTypes.SELECT });

    res.render('admin/reportes/index', {
      titulo: 'Reportes y dashboard',
      kpis: {

        totalIngresos: Number(ingresosRow.total_ingresos).toFixed(2),
        ticketPromedio: Number(ingresosRow.ticket_promedio).toFixed(2),
        totalPedidos: totalPedidos[0].total,
        productosActivos,
        clientesRegistrados,
        alertasStock: alertasStock[0].total,
        ventasHoyMonto: Number(ventasHoyRow.monto).toFixed(2),
        ventasHoyCantidad: ventasHoyRow.cantidad,
        ventasMesMonto: Number(ventasMesRow.monto).toFixed(2),
        ventasMesCantidad: ventasMesRow.cantidad,
      },
      pedidosPorEstado,
      topProductos,
      topClientes,
      stockCritico,
      ventasPorTienda,
      usoCupones,
    });
  } catch (error) {
    next(error);
  }
};

exports.dashboard = async (req, res, next) => {
  try {
    const [ventasHoyRow] = await sequelize.query(`
      SELECT COALESCE(SUM(total), 0) as monto, COUNT(*) as cantidad
      FROM pedidos WHERE estado IN (:estados) AND DATE(fecha_pedido) = CURDATE()
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA }, type: QueryTypes.SELECT });

    const [ventasMesRow] = await sequelize.query(`
      SELECT COALESCE(SUM(total), 0) as monto FROM pedidos
      WHERE estado IN (:estados) AND YEAR(fecha_pedido) = YEAR(CURDATE()) AND MONTH(fecha_pedido) = MONTH(CURDATE())
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA }, type: QueryTypes.SELECT });

    const totalPedidosRow = await sequelize.query('SELECT COUNT(*) as total FROM pedidos', { type: QueryTypes.SELECT });
    const alertasStockRow = await sequelize.query(
      'SELECT COUNT(*) as total FROM inventario_tienda WHERE stock <= stock_minimo', { type: QueryTypes.SELECT }
    );

    const dias = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      dias.push(fecha.toISOString().slice(0, 10));
    }
    const ventasPorDiaRaw = await sequelize.query(`
      SELECT DATE(fecha_pedido) as dia, COALESCE(SUM(total), 0) as monto
      FROM pedidos
      WHERE estado IN (:estados) AND fecha_pedido >= :desde
      GROUP BY DATE(fecha_pedido)
    `, { replacements: { estados: ESTADOS_QUE_CUENTAN_COMO_VENTA, desde: dias[0] }, type: QueryTypes.SELECT });
    const mapaVentas = {};
    for (const fila of ventasPorDiaRaw) {

      const clave = typeof fila.dia === 'string' ? fila.dia : fila.dia.toISOString().slice(0, 10);
      mapaVentas[clave] = Number(fila.monto);
    }
    const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const grafico = {
      etiquetas: dias.map((d) => NOMBRES_DIA[new Date(d + 'T12:00:00').getDay()]),
      valores: dias.map((d) => mapaVentas[d] || 0),
    };

    const pedidosRecientes = await sequelize.query(`
      SELECT p.numero_pedido, p.estado, p.total, p.fecha_pedido, u.nombre, u.apellido
      FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id
      ORDER BY p.fecha_pedido DESC LIMIT 5
    `, { type: QueryTypes.SELECT });

    const actividadReciente = await sequelize.query(`
      SELECT a.accion, a.detalle, a.fecha, u.nombre, u.apellido
      FROM auditoria a LEFT JOIN usuarios u ON a.usuario_id = u.id
      ORDER BY a.fecha DESC LIMIT 5
    `, { type: QueryTypes.SELECT });

    res.render('admin/dashboard', {
      titulo: 'Panel administrativo',
      kpis: {
        ventasHoyMonto: Number(ventasHoyRow.monto).toFixed(2),
        ventasHoyCantidad: ventasHoyRow.cantidad,
        ventasMesMonto: Number(ventasMesRow.monto).toFixed(2),
        totalPedidos: totalPedidosRow[0].total,
        alertasStock: alertasStockRow[0].total,
      },
      grafico,
      pedidosRecientes,
      actividadReciente,
    });
  } catch (error) {
    next(error);
  }
};
