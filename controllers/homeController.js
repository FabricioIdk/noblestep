const { Op } = require('sequelize');
const { Producto } = require('../models');

function conPrecios(producto) {
  const precio = Number(producto.precio);
  const oferta = producto.precio_oferta ? Number(producto.precio_oferta) : null;
  const enOferta = oferta !== null && oferta < precio;
  return {
    id: producto.id,
    nombre: producto.nombre,
    marca: producto.marca,
    imagen: producto.imagen_principal,
    precio,
    precioFinal: enOferta ? oferta : precio,
    enOferta,
    descuento: enOferta ? Math.round((1 - oferta / precio) * 100) : 0,
  };
}

exports.index = async (req, res, next) => {
  try {
    const recientes = await Producto.findAll({
      where: { activo: true },
      order: [['created_at', 'DESC']],
      limit: 8,
    });

    const enOferta = await Producto.findAll({
      where: { activo: true, precio_oferta: { [Op.ne]: null } },
      attributes: ['precio', 'precio_oferta'],
    });
    const descuentoMaximo = enOferta.reduce((maximo, p) => {
      const precio = Number(p.precio);
      const oferta = Number(p.precio_oferta);
      if (!(oferta < precio)) return maximo;
      return Math.max(maximo, Math.round((1 - oferta / precio) * 100));
    }, 0);

    res.render('home', {
      titulo: 'Zapatillas para hombre, mujer y niños',
      recientes: recientes.map(conPrecios),
      descuentoMaximo,
    });
  } catch (error) {
    next(error);
  }
};
