 

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  sequelize, Usuario, Direccion, Producto, VarianteProducto,
  Pedido, DetallePedido, Tienda, InventarioTienda, Envio,
} = require('../models');
const { notificar, notificarATodosLosAdmins } = require('../services/notificacionService');
const { IGV, calcularCostoEnvio } = require('./checkoutController');

exports.mostrarFormulario = async (req, res, next) => {
  try {
    const variante = await VarianteProducto.findByPk(req.params.varianteId);
    if (!variante) {
      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }
    const producto = await Producto.findByPk(variante.producto_id);

    const almacenOnline = await Tienda.findOne({ where: { tipo: 'almacen_online' } });
    const inventario = await InventarioTienda.findOne({ where: { tienda_id: almacenOnline.id, variante_id: variante.id } });
    const stockOnline = inventario ? inventario.stock : 0;

    if (stockOnline === 0) {
      return res.status(400).render('error', {
        titulo: 'Sin stock', mensaje: 'Esta talla/color ya no tiene stock disponible para compra rápida.',
      });
    }

    const cantidad = Math.max(1, parseInt(req.query.cantidad, 10) || 1);
    const tiendasFisicas = await Tienda.findAll({ where: { tipo: 'fisica', activo: true }, order: [['nombre', 'ASC']] });
    const subtotal = Number(producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio) ? producto.precio_oferta : producto.precio) * cantidad;

    const envio = {
      costoDomicilio: calcularCostoEnvio('envio_domicilio', subtotal),
      costoRecojo: calcularCostoEnvio('recojo_tienda', subtotal),
    };

    res.render('compra-rapida/formulario', {
      titulo: 'Comprar ahora', producto, variante, cantidad, stockOnline, tiendasFisicas, subtotal, envio, error: null,
    });
  } catch (error) {
    next(error);
  }
};

exports.procesar = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      variante_id, cantidad, nombre, apellido, email, telefono,
      calle, distrito, ciudad, referencia, tipo_entrega, tienda_recojo_id,
    } = req.body;

    const cantidadNum = Math.max(1, parseInt(cantidad, 10) || 1);
    const entregaEsRecojo = tipo_entrega === 'recojo_tienda';

    const variante = await VarianteProducto.findByPk(variante_id, { transaction: t });
    if (!variante) {
      await t.rollback();
      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }
    const producto = await Producto.findByPk(variante.producto_id, { transaction: t });

    async function reRenderConError(mensaje) {
      await t.rollback();
      const almacenOnline = await Tienda.findOne({ where: { tipo: 'almacen_online' } });
      const inventario = await InventarioTienda.findOne({ where: { tienda_id: almacenOnline.id, variante_id: variante.id } });
      const tiendasFisicas = await Tienda.findAll({ where: { tipo: 'fisica', activo: true }, order: [['nombre', 'ASC']] });
      const subtotalError = Number(producto.precio) * cantidadNum;
      return res.render('compra-rapida/formulario', {
        titulo: 'Comprar ahora', producto, variante, cantidad: cantidadNum,
        stockOnline: inventario ? inventario.stock : 0, tiendasFisicas, subtotal: subtotalError,
        envio: { costoDomicilio: calcularCostoEnvio('envio_domicilio', subtotalError), costoRecojo: 0 },
        error: mensaje,
      });
    }

    if (!nombre || !apellido || !email) {
      return reRenderConError('Nombre, apellido y correo son obligatorios.');
    }

    let tiendaOrigen;
    if (entregaEsRecojo) {
      tiendaOrigen = await Tienda.findOne({ where: { id: tienda_recojo_id, tipo: 'fisica', activo: true }, transaction: t });
    } else {
      tiendaOrigen = await Tienda.findOne({ where: { tipo: 'almacen_online' }, transaction: t });
    }
    if (!tiendaOrigen) {
      return reRenderConError(entregaEsRecojo ? 'Selecciona una tienda válida para el recojo.' : 'No se encontró el almacén online.');
    }

    const inv = await InventarioTienda.findOne({
      where: { tienda_id: tiendaOrigen.id, variante_id: variante.id }, transaction: t,
    });
    const stockDisponible = inv ? inv.stock : 0;
    if (cantidadNum > stockDisponible) {
      return reRenderConError(`"${tiendaOrigen.nombre}" no tiene suficiente stock de esta talla/color.`);
    }

    let usuario = await Usuario.findOne({ where: { email }, transaction: t });
    let cuentaNueva = false;
    if (!usuario) {

      const passwordAleatoria = crypto.randomBytes(16).toString('hex');
      const passwordHasheada = await bcrypt.hash(passwordAleatoria, 10);
      usuario = await Usuario.create({
        nombre, apellido, email, telefono, password: passwordHasheada, rol: 'cliente',
      }, { transaction: t });
      cuentaNueva = true;
    }

    let direccion = null;
    if (!entregaEsRecojo) {
      if (!calle || !distrito || !ciudad) {
        return reRenderConError('Completa la dirección de entrega.');
      }
      direccion = await Direccion.create({
        usuario_id: usuario.id, calle, distrito, ciudad, referencia, predeterminada: false,
      }, { transaction: t });
    } else {
      direccion = await Direccion.create({
        usuario_id: usuario.id, calle: tiendaOrigen.direccion || tiendaOrigen.nombre,
        distrito: tiendaOrigen.distrito || '-', ciudad: tiendaOrigen.ciudad || '-', predeterminada: false,
      }, { transaction: t });
    }

    const precioUnitario = producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio)
      ? Number(producto.precio_oferta) : Number(producto.precio);
    const subtotal = precioUnitario * cantidadNum;
    const igv = subtotal * IGV;
    const costoEnvio = calcularCostoEnvio(entregaEsRecojo ? 'recojo_tienda' : 'envio_domicilio', subtotal);
    const total = subtotal + igv + costoEnvio;
    const numeroPedido = `NS-${Date.now()}`;

    const pedido = await Pedido.create({
      usuario_id: usuario.id, direccion_id: direccion.id, cupon_id: null, tienda_id: tiendaOrigen.id,
      tipo_entrega: entregaEsRecojo ? 'recojo_tienda' : 'envio_domicilio',
      numero_pedido: numeroPedido, estado: 'pendiente',
      subtotal: subtotal.toFixed(2), igv: igv.toFixed(2), total: total.toFixed(2), fecha_pedido: new Date(),
    }, { transaction: t });

    await DetallePedido.create({
      pedido_id: pedido.id, variante_id: variante.id, cantidad: cantidadNum,
      precio_unitario: precioUnitario.toFixed(2), subtotal: subtotal.toFixed(2),
    }, { transaction: t });

    await inv.update({ stock: inv.stock - cantidadNum }, { transaction: t });

    if (!entregaEsRecojo) {
      await Envio.create({ pedido_id: pedido.id, costo_envio: costoEnvio.toFixed(2), estado: 'pendiente' }, { transaction: t });
    }

    await t.commit();

    req.session.usuario = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };

    await notificar(usuario.id, 'confirmacion_pedido',
      `Tu pedido ${numeroPedido} fue registrado correctamente. Total: S/ ${total.toFixed(2)}.` +
      (cuentaNueva ? ' Te creamos una cuenta para que puedas hacer seguimiento; usa "olvidé mi contraseña" si quieres definir una propia.' : ''));

    if (inv.stock - cantidadNum <= (inv.stock_minimo || 5)) {
      await notificarATodosLosAdmins('alerta_stock',
        `Stock bajo en ${tiendaOrigen.nombre}: ${producto.nombre} (talla ${variante.talla}/${variante.color}) qued\u00f3 con ${inv.stock - cantidadNum} unidades.`);
    }

    res.redirect(`/pedidos/${pedido.id}`);
  } catch (error) {
    await t.rollback();
    next(error);
  }
};
