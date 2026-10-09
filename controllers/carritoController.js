 

const { Carrito, DetalleCarrito, VarianteProducto, Producto, Categoria, ImagenProducto, Tienda, InventarioTienda } = require('../models');
const { armarDatosDetalle } = require('./productoController');

async function obtenerOCrearCarritoActivo(usuarioId) {
  let carrito = await Carrito.findOne({ where: { usuario_id: usuarioId, estado: 'activo' } });
  if (!carrito) {
    carrito = await Carrito.create({ usuario_id: usuarioId, estado: 'activo' });
  }
  return carrito;
}

async function obtenerAlmacenOnline() {
  return Tienda.findOne({ where: { tipo: 'almacen_online' } });
}

async function obtenerInventarioOnline(varianteId) {
  const almacen = await obtenerAlmacenOnline();
  if (!almacen) return null;
  return InventarioTienda.findOne({ where: { tienda_id: almacen.id, variante_id: varianteId } });
}

exports.index = async (req, res, next) => {
  try {
    const carrito = await obtenerOCrearCarritoActivo(req.session.usuario.id);

    const items = await DetalleCarrito.findAll({
      where: { carrito_id: carrito.id },
      include: [{ model: VarianteProducto }],  
      order: [['id', 'ASC']],
    });

    for (const item of items) {
      item.producto = await Producto.findByPk(item.VarianteProducto.producto_id);
      const inv = await obtenerInventarioOnline(item.variante_id);
      item.stockDisponible = inv ? inv.stock : 0;
    }

    const total = items.reduce((acc, item) => acc + Number(item.precio_unitario) * item.cantidad, 0);

    res.render('carrito/index', { titulo: 'Mi carrito', items, total });
  } catch (error) {
    next(error);
  }
};

exports.agregar = async (req, res, next) => {
  try {
    const { variante_id, cantidad } = req.body;

    const cantidadNum = Math.max(1, parseInt(cantidad, 10) || 1);

    const variante = await VarianteProducto.findByPk(variante_id);
    if (!variante) {
      return res.status(404).render('404', { titulo: 'Variante no encontrada' });
    }

    const producto = await Producto.findByPk(variante.producto_id, {
      include: [
        { model: Categoria, as: 'categoria' },
        { model: VarianteProducto, as: 'variantes' },
        { model: ImagenProducto, as: 'galeria' },
      ],
    });

    const inventarioOnline = await obtenerInventarioOnline(variante_id);
    const stockOnline = inventarioOnline ? inventarioOnline.stock : 0;

    const carrito = await obtenerOCrearCarritoActivo(req.session.usuario.id);

    let item = await DetalleCarrito.findOne({ where: { carrito_id: carrito.id, variante_id } });
    const cantidadDeseada = (item ? item.cantidad : 0) + cantidadNum;

    if (cantidadDeseada > stockOnline) {

      const { esFavorito, relacionados } = await armarDatosDetalle(producto, req.session.usuario.id);
      return res.status(400).render('productos/detalle', {
        titulo: producto.nombre,
        producto,
        esFavorito,
        relacionados,
        errorCarrito: `Solo hay ${stockOnline} unidades disponibles online de esta talla/color.`,
      });
    }

    if (item) {

      await item.update({ cantidad: cantidadDeseada });
    } else {

      const precioConOferta = producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio)
        ? producto.precio_oferta : producto.precio;
      await DetalleCarrito.create({
        carrito_id: carrito.id,
        variante_id,
        cantidad: cantidadNum,
        precio_unitario: precioConOferta,
      });
    }

    res.redirect('/carrito');
  } catch (error) {
    next(error);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const item = await DetalleCarrito.findByPk(req.params.id, { include: [VarianteProducto] });
    if (!item) return res.status(404).render('404', { titulo: 'Producto no encontrado en el carrito' });

    const nuevaCantidad = Math.max(1, parseInt(req.body.cantidad, 10) || 1);
    const inventarioOnline = await obtenerInventarioOnline(item.variante_id);
    const stockOnline = inventarioOnline ? inventarioOnline.stock : 0;

    if (nuevaCantidad > stockOnline) {

      return res.redirect('/carrito');
    }

    await item.update({ cantidad: nuevaCantidad });
    res.redirect('/carrito');
  } catch (error) {
    next(error);
  }
};

exports.eliminarItem = async (req, res, next) => {
  try {
    await DetalleCarrito.destroy({ where: { id: req.params.id } });
    res.redirect('/carrito');
  } catch (error) {
    next(error);
  }
};

exports.vaciar = async (req, res, next) => {
  try {
    const carrito = await obtenerOCrearCarritoActivo(req.session.usuario.id);
    await DetalleCarrito.destroy({ where: { carrito_id: carrito.id } });
    res.redirect('/carrito');
  } catch (error) {
    next(error);
  }
};
