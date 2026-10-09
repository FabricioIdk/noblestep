 

const { Op } = require('sequelize');
const {
  sequelize, Carrito, DetalleCarrito, VarianteProducto, Producto,
  Direccion, Pedido, DetallePedido, Cupon, Tienda, InventarioTienda, Envio,
} = require('../models');
const { notificar, notificarATodosLosAdmins } = require('../services/notificacionService');

const IGV = 0.18;  

const COSTO_ENVIO_ESTANDAR = 12.90;
const ENVIO_GRATIS_DESDE = 300;  

function calcularCostoEnvio(tipoEntrega, subtotal) {
  if (tipoEntrega === 'recojo_tienda') return 0;  
  if (subtotal >= ENVIO_GRATIS_DESDE) return 0;  
  return COSTO_ENVIO_ESTANDAR;
}

async function obtenerCarritoConItems(usuarioId) {
  const carrito = await Carrito.findOne({ where: { usuario_id: usuarioId, estado: 'activo' } });
  if (!carrito) return { carrito: null, items: [] };

  const items = await DetalleCarrito.findAll({
    where: { carrito_id: carrito.id },
    include: [{ model: VarianteProducto }],
  });
  for (const item of items) {
    item.producto = await Producto.findByPk(item.VarianteProducto.producto_id);
  }
  return { carrito, items };
}

exports.mostrarCheckout = async (req, res, next) => {
  try {
    const { items } = await obtenerCarritoConItems(req.session.usuario.id);
    if (items.length === 0) return res.redirect('/carrito');  

    const direcciones = await Direccion.findAll({ where: { usuario_id: req.session.usuario.id } });
    const tiendasFisicas = await Tienda.findAll({ where: { tipo: 'fisica', activo: true }, order: [['nombre', 'ASC']] });
    const subtotal = items.reduce((acc, item) => acc + Number(item.precio_unitario) * item.cantidad, 0);

    const envio = {
      costoDomicilio: calcularCostoEnvio('envio_domicilio', subtotal),
      costoRecojo: calcularCostoEnvio('recojo_tienda', subtotal),
      faltaParaGratis: Math.max(0, ENVIO_GRATIS_DESDE - subtotal),
      umbralGratis: ENVIO_GRATIS_DESDE,
    };

    res.render('checkout/index', {
      titulo: 'Confirmar pedido', items, direcciones, tiendasFisicas, subtotal, envio, error: null,
    });
  } catch (error) {
    next(error);
  }
};

exports.procesarCheckout = async (req, res, next) => {

  const t = await sequelize.transaction();  
  try {
    const usuarioId = req.session.usuario.id;
    const { direccion_id, calle, distrito, ciudad, referencia, cupon_codigo, tipo_entrega, tienda_recojo_id } = req.body;

    const { carrito, items } = await obtenerCarritoConItems(usuarioId);
    if (!carrito || items.length === 0) {
      await t.rollback();  
      return res.redirect('/carrito');
    }

    const entregaEsRecojo = tipo_entrega === 'recojo_tienda';

    let tiendaOrigen;
    if (entregaEsRecojo) {
      tiendaOrigen = await Tienda.findOne({ where: { id: tienda_recojo_id, tipo: 'fisica', activo: true }, transaction: t });

    } else {
      tiendaOrigen = await Tienda.findOne({ where: { tipo: 'almacen_online' }, transaction: t });
    }

    async function reRenderConError(mensaje) {
      await t.rollback();  
      const direcciones = await Direccion.findAll({ where: { usuario_id: usuarioId } });
      const tiendasFisicas = await Tienda.findAll({ where: { tipo: 'fisica', activo: true }, order: [['nombre', 'ASC']] });
      const subtotal = items.reduce((acc, i) => acc + Number(i.precio_unitario) * i.cantidad, 0);
      const envio = {
        costoDomicilio: calcularCostoEnvio('envio_domicilio', subtotal),
        costoRecojo: calcularCostoEnvio('recojo_tienda', subtotal),
        faltaParaGratis: Math.max(0, ENVIO_GRATIS_DESDE - subtotal),
        umbralGratis: ENVIO_GRATIS_DESDE,
      };
      return res.render('checkout/index', {
        titulo: 'Confirmar pedido', items, direcciones, tiendasFisicas, subtotal, envio, error: mensaje,
      });
    }

    if (!tiendaOrigen) {
      return reRenderConError(entregaEsRecojo ? 'Selecciona una tienda válida para el recojo.' : 'No se encontró el almacén online. Contacta al administrador.');
    }

    let direccion = null;
    if (!entregaEsRecojo) {
      if (direccion_id && direccion_id !== 'nueva') {

        direccion = await Direccion.findOne({ where: { id: direccion_id, usuario_id: usuarioId }, transaction: t });
      } else if (calle && distrito && ciudad) {

        direccion = await Direccion.create(
          { usuario_id: usuarioId, calle, distrito, ciudad, referencia, predeterminada: false },
          { transaction: t }
        );
      }
      if (!direccion) {
        return reRenderConError('Debes elegir o registrar una dirección de entrega.');
      }
    } else {

      direccion = await Direccion.findOne({ where: { usuario_id: usuarioId }, transaction: t });
      if (!direccion) {
        direccion = await Direccion.create({
          usuario_id: usuarioId, calle: tiendaOrigen.direccion || tiendaOrigen.nombre,
          distrito: tiendaOrigen.distrito || '-', ciudad: tiendaOrigen.ciudad || '-', predeterminada: false,
        }, { transaction: t });
      }
    }

    for (const item of items) {
      const inv = await InventarioTienda.findOne({
        where: { tienda_id: tiendaOrigen.id, variante_id: item.variante_id }, transaction: t,
      });
      const stockDisponible = inv ? inv.stock : 0;
      if (item.cantidad > stockDisponible) {
        return reRenderConError(
          `"${tiendaOrigen.nombre}" ya no tiene suficiente stock de la talla ${item.VarianteProducto.talla}. Ajusta tu carrito o elige otra tienda.`
        );
      }
    }

    const subtotalOriginal = items.reduce((acc, item) => acc + Number(item.precio_unitario) * item.cantidad, 0);

    let cupon = null;
    let subtotalConDescuento = subtotalOriginal;
    if (cupon_codigo) {

      const hoy = new Date().toISOString().slice(0, 10);
      cupon = await Cupon.findOne({
        where: {
          codigo: cupon_codigo,
          activo: true,
          fecha_inicio: { [Op.lte]: hoy },  
          fecha_fin: { [Op.gte]: hoy },     
        },
        transaction: t,
      });

      if (cupon) {
        const descuento = cupon.tipo_descuento === 'porcentaje'
          ? subtotalOriginal * (Number(cupon.valor) / 100)
          : Number(cupon.valor);
        subtotalConDescuento = Math.max(0, subtotalOriginal - descuento);

      }
    }

    const igv = subtotalConDescuento * IGV;

    const costoEnvio = calcularCostoEnvio(entregaEsRecojo ? 'recojo_tienda' : 'envio_domicilio', subtotalConDescuento);
    const total = subtotalConDescuento + igv + costoEnvio;
    const numeroPedido = `NS-${Date.now()}`;

    const pedido = await Pedido.create({
      usuario_id: usuarioId,
      direccion_id: direccion.id,
      cupon_id: cupon ? cupon.id : null,
      tienda_id: tiendaOrigen.id,
      tipo_entrega: entregaEsRecojo ? 'recojo_tienda' : 'envio_domicilio',
      numero_pedido: numeroPedido,
      estado: 'pendiente',  
      subtotal: subtotalConDescuento.toFixed(2),  
      igv: igv.toFixed(2),
      total: total.toFixed(2),
      fecha_pedido: new Date(),
    }, { transaction: t });

    if (!entregaEsRecojo) {
      await Envio.create({
        pedido_id: pedido.id,
        costo_envio: costoEnvio.toFixed(2),
        estado: 'pendiente',
      }, { transaction: t });
    }

    for (const item of items) {
      await DetallePedido.create({
        pedido_id: pedido.id,
        variante_id: item.variante_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: (Number(item.precio_unitario) * item.cantidad).toFixed(2),
      }, { transaction: t });

      const inv = await InventarioTienda.findOne({
        where: { tienda_id: tiendaOrigen.id, variante_id: item.variante_id }, transaction: t,
      });
      await inv.update({ stock: inv.stock - item.cantidad }, { transaction: t });
    }

    await carrito.update({ estado: 'convertido' }, { transaction: t });

    await t.commit();

    await notificar(usuarioId, 'confirmacion_pedido',
      `Tu pedido ${numeroPedido} fue registrado correctamente. Total: S/ ${total.toFixed(2)}.` +
      (entregaEsRecojo ? ` Recójelo en ${tiendaOrigen.nombre}.` : ''));

    for (const item of items) {
      const invActualizado = await InventarioTienda.findOne({ where: { tienda_id: tiendaOrigen.id, variante_id: item.variante_id } });
      if (invActualizado.stock <= invActualizado.stock_minimo) {
        const productoRelacionado = await Producto.findByPk(item.VarianteProducto.producto_id);
        await notificarATodosLosAdmins('alerta_stock',
          `Stock bajo en ${tiendaOrigen.nombre}: ${productoRelacionado.nombre} (talla ${item.VarianteProducto.talla}/${item.VarianteProducto.color}) qued\u00f3 con ${invActualizado.stock} unidades.`);
      }
    }

    res.redirect(`/pedidos/${pedido.id}`);  
  } catch (error) {

    await t.rollback();
    next(error);
  }
};

exports.IGV = IGV;
exports.calcularCostoEnvio = calcularCostoEnvio;
