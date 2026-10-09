 

const { Op, QueryTypes } = require('sequelize');

const { sequelize, Producto, Categoria, VarianteProducto, InventarioTienda, Tienda, ImagenProducto, Favorito } = require('../models');

function calcularPrecioEfectivo(producto) {
  const tieneOferta = producto.precio_oferta && Number(producto.precio_oferta) < Number(producto.precio);

  return {
    enOferta: !!tieneOferta,  
    precioEfectivo: tieneOferta ? Number(producto.precio_oferta) : Number(producto.precio),
  };
}

exports.index = async (req, res, next) => {

  try {

    const { q, categoria_id, precio_min, precio_max, orden, oferta, genero, marca } = req.query;

    const where = { activo: true };  

    if (q) {

      where.nombre = { [Op.like]: `%${q}%` };
    }
    if (categoria_id) {
      where.categoria_id = categoria_id;
    }
    if (genero) {
      where.genero = genero;
    }
    if (marca) {
      where.marca = marca;
    }
    if (precio_min || precio_max) {
      where.precio = {};
      if (precio_min) where.precio[Op.gte] = precio_min;  
      if (precio_max) where.precio[Op.lte] = precio_max;  
    }
    if (oferta === '1') {
      where.precio_oferta = { [Op.ne]: null };  
    }

    let order = [['created_at', 'DESC']];  
    if (orden === 'precio_asc') order = [['precio', 'ASC']];
    if (orden === 'precio_desc') order = [['precio', 'DESC']];
    if (orden === 'ultimos') order = [['created_at', 'DESC']];

    const todosLosProductos = await Producto.findAll({
      where,
      include: [
        { model: Categoria, as: 'categoria' },    
        { model: VarianteProducto, as: 'variantes' },
      ],
      order,
    });

    for (const p of todosLosProductos) {
      const { enOferta, precioEfectivo } = calcularPrecioEfectivo(p);
      p.enOferta = enOferta;
      p.precioEfectivo = precioEfectivo;
    }

    if (orden === 'popularidad' && todosLosProductos.length > 0) {
      const idsProductos = todosLosProductos.map((p) => p.id);
      const ventas = await sequelize.query(`
        SELECT vp.producto_id, COALESCE(SUM(dp.cantidad), 0) as unidades
        FROM variantes_producto vp
        LEFT JOIN detalle_pedido dp ON dp.variante_id = vp.id
        WHERE vp.producto_id IN (:ids)
        GROUP BY vp.producto_id
      `, { replacements: { ids: idsProductos }, type: QueryTypes.SELECT });

      const unidadesPorProducto = {};
      for (const fila of ventas) { unidadesPorProducto[fila.producto_id] = Number(fila.unidades); }

      todosLosProductos.sort((a, b) => (unidadesPorProducto[b.id] || 0) - (unidadesPorProducto[a.id] || 0));
    }

    const PRODUCTOS_POR_PAGINA = 12;
    const totalProductos = todosLosProductos.length;
    const totalPaginas = Math.max(1, Math.ceil(totalProductos / PRODUCTOS_POR_PAGINA));
    let paginaActual = parseInt(req.query.pagina, 10) || 1;
    if (paginaActual < 1) paginaActual = 1;
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA;
    const productos = todosLosProductos.slice(inicio, inicio + PRODUCTOS_POR_PAGINA);

    const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });

    let idsFavoritos = [];
    if (req.session.usuario) {
      const favoritos = await Favorito.findAll({
        where: { usuario_id: req.session.usuario.id, producto_id: productos.map((p) => p.id) },
      });
      idsFavoritos = favoritos.map((f) => f.producto_id);
    }

    res.render('productos/index', {
      titulo: 'Cat\u00e1logo', productos, categorias, idsFavoritos, paginaActualUrl: req.originalUrl,
      paginacion: {
        actual: paginaActual, total: totalPaginas, totalProductos,
        desde: totalProductos === 0 ? 0 : inicio + 1,
        hasta: Math.min(inicio + PRODUCTOS_POR_PAGINA, totalProductos),
      },
      filtros: {

        q: q || '', categoria_id: categoria_id || '', precio_min: precio_min || '',
        precio_max: precio_max || '', orden: orden || '', oferta: oferta || '', genero: genero || '', marca: marca || '',
      },
    });
  } catch (error) {
    next(error);  
  }
};

async function armarDatosDetalle(producto, usuarioIdSesion) {
  const { enOferta, precioEfectivo } = calcularPrecioEfectivo(producto);
  producto.enOferta = enOferta;
  producto.precioEfectivo = precioEfectivo;

  for (const variante of producto.variantes) {
    const inventarios = await InventarioTienda.findAll({
      where: { variante_id: variante.id },
      include: [Tienda],
    });
    variante.disponibilidad = inventarios
      .filter((i) => i.Tienda.activo)
      .map((i) => ({ tienda: i.Tienda.nombre, tipo: i.Tienda.tipo, stock: i.stock }));

    const online = variante.disponibilidad.find((d) => d.tipo === 'almacen_online');
    variante.stockOnline = online ? online.stock : 0;
  }

  producto.coloresUnicos = [...new Set(producto.variantes.map((v) => v.color))];

  let esFavorito = false;
  if (usuarioIdSesion) {
    const favorito = await Favorito.findOne({ where: { usuario_id: usuarioIdSesion, producto_id: producto.id } });
    esFavorito = !!favorito;
  }

  const relacionados = await Producto.findAll({
    where: {
      id: { [Op.ne]: producto.id },
      activo: true,
      [Op.or]: [{ categoria_id: producto.categoria_id }, { marca: producto.marca }],
    },
    limit: 4,
    order: [['created_at', 'DESC']],
  });
  for (const r of relacionados) {
    const calculo = calcularPrecioEfectivo(r);
    r.enOferta = calculo.enOferta;
    r.precioEfectivo = calculo.precioEfectivo;
  }

  return { esFavorito, relacionados };
}
exports.armarDatosDetalle = armarDatosDetalle;

exports.show = async (req, res, next) => {
  try {

    const producto = await Producto.findByPk(req.params.id, {
      include: [
        { model: Categoria, as: 'categoria' },
        { model: VarianteProducto, as: 'variantes' },
        { model: ImagenProducto, as: 'galeria' },
      ],
    });

    if (!producto) {

      return res.status(404).render('404', { titulo: 'Producto no encontrado' });
    }

    const { esFavorito, relacionados } = await armarDatosDetalle(producto, req.session.usuario ? req.session.usuario.id : null);

    res.render('productos/detalle', {
      titulo: producto.nombre, producto, esFavorito, relacionados,
    });
  } catch (error) {
    next(error);
  }
};
