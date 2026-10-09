 

const fs = require('fs');  
const path = require('path');
const { Producto, Categoria, VarianteProducto, Tienda, InventarioTienda, ImagenProducto } = require('../models');
const { registrar } = require('../services/auditoriaService');

const CARPETA_IMAGENES = path.join(__dirname, '..', 'public', 'img', 'productos');

function borrarImagenSiExiste(nombreArchivo) {
  if (!nombreArchivo) return;  
  const ruta = path.join(CARPETA_IMAGENES, nombreArchivo);
  if (fs.existsSync(ruta)) {
    fs.unlinkSync(ruta);  
  }
}

exports.index = async (req, res, next) => {
  try {
    const productos = await Producto.findAll({
      include: [{ model: Categoria, as: 'categoria' }, { model: VarianteProducto, as: 'variantes' }],
      order: [['id', 'DESC']],  
    });
    res.render('admin/productos/index', { titulo: 'Productos', productos });
  } catch (error) {
    next(error);
  }
};

exports.createForm = async (req, res, next) => {
  try {
    const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
    res.render('admin/productos/form', {
      titulo: 'Nuevo producto', producto: null, categorias, error: null,

    });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, precio_oferta, marca, genero, categoria_id, activo } = req.body;

    if (!nombre || !precio || !categoria_id) {
      const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
      return res.render('admin/productos/form', {
        titulo: 'Nuevo producto', producto: null, categorias,
        error: 'Nombre, precio y categor\u00eda son obligatorios.',
      });
    }

    await Producto.create({
      nombre, descripcion, precio,
      precio_oferta: precio_oferta ? precio_oferta : null,

      marca, genero: genero || 'unisex', categoria_id,
      activo: activo === 'on',

      imagen_principal: req.file ? req.file.filename : null,

    });

    res.redirect('/admin/productos');
  } catch (error) {
    next(error);
  }
};

exports.editForm = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: [
        { model: VarianteProducto, as: 'variantes' },
        { model: ImagenProducto, as: 'galeria' },
      ],
    });
    if (!producto) {
      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }
    const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
    res.render('admin/productos/form', { titulo: 'Editar producto', producto, categorias, error: null });
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }

    const { nombre, descripcion, precio, precio_oferta, marca, genero, categoria_id, activo } = req.body;

    const datosActualizados = {
      nombre, descripcion, precio,
      precio_oferta: precio_oferta ? precio_oferta : null,
      marca, genero: genero || 'unisex', categoria_id,
      activo: activo === 'on',
    };

    if (req.file) {

      borrarImagenSiExiste(producto.imagen_principal);  
      datosActualizados.imagen_principal = req.file.filename;
    }

    await producto.update(datosActualizados);
    res.redirect('/admin/productos');
  } catch (error) {
    next(error);
  }
};

exports.destroy = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id, { include: [{ model: ImagenProducto, as: 'galeria' }] });
    if (!producto) {
      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }
    borrarImagenSiExiste(producto.imagen_principal);
    for (const img of producto.galeria) { borrarImagenSiExiste(img.nombre_archivo); }  
    const nombreProducto = producto.nombre;  
    await producto.destroy();  

    await registrar(req.session.usuario.id, 'eliminacion_producto', 'productos', req.params.id, `Producto eliminado: ${nombreProducto}`);
    res.redirect('/admin/productos');
  } catch (error) {
    next(error);
  }
};

exports.agregarVariante = async (req, res, next) => {
  try {
    const { talla, color, stock, sku } = req.body;
    const variante = await VarianteProducto.create({
      producto_id: req.params.id, talla, color, sku,
    });

    const almacenOnline = await Tienda.findOne({ where: { tipo: 'almacen_online' } });
    if (almacenOnline) {
      await InventarioTienda.create({
        tienda_id: almacenOnline.id, variante_id: variante.id, stock: stock || 0, stock_minimo: 5,
      });
    }

    res.redirect(`/admin/productos/${req.params.id}/editar`);
  } catch (error) {
    next(error);
  }
};

exports.eliminarVariante = async (req, res, next) => {
  try {

    await VarianteProducto.destroy({ where: { id: req.params.varianteId, producto_id: req.params.id } });
    res.redirect(`/admin/productos/${req.params.id}/editar`);
  } catch (error) {
    next(error);
  }
};

exports.agregarImagen = async (req, res, next) => {
  try {
    const cantidadActual = await ImagenProducto.count({ where: { producto_id: req.params.id } });
    if (cantidadActual >= 2) {

      if (req.file) fs.unlinkSync(path.join(CARPETA_IMAGENES, req.file.filename));
      return res.redirect(`/admin/productos/${req.params.id}/editar`);
    }
    if (req.file) {
      await ImagenProducto.create({
        producto_id: req.params.id, nombre_archivo: req.file.filename, orden: cantidadActual,
      });
    }
    res.redirect(`/admin/productos/${req.params.id}/editar`);
  } catch (error) {
    next(error);
  }
};

exports.eliminarImagen = async (req, res, next) => {
  try {
    const imagen = await ImagenProducto.findOne({
      where: { id: req.params.imagenId, producto_id: req.params.id },
    });
    if (imagen) {
      borrarImagenSiExiste(imagen.nombre_archivo);
      await imagen.destroy();
    }
    res.redirect(`/admin/productos/${req.params.id}/editar`);
  } catch (error) {
    next(error);
  }
};
