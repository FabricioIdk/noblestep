 

const { Tienda } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const tiendas = await Tienda.findAll({ order: [['tipo', 'ASC'], ['nombre', 'ASC']] });

    res.render('admin/tiendas/index', { titulo: 'Tiendas', tiendas, error: null });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { nombre, direccion, distrito, ciudad, telefono } = req.body;
    if (!nombre) {
      const tiendas = await Tienda.findAll({ order: [['tipo', 'ASC'], ['nombre', 'ASC']] });
      return res.render('admin/tiendas/index', {
        titulo: 'Tiendas', tiendas, error: 'El nombre es obligatorio.',
      });
    }

    await Tienda.create({ nombre, tipo: 'fisica', direccion, distrito, ciudad, telefono, activo: true });
    res.redirect('/admin/tiendas');
  } catch (error) {
    next(error);
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const tienda = await Tienda.findByPk(req.params.id);

    if (tienda && tienda.tipo === 'fisica') {
      await tienda.update({ activo: !tienda.activo });
    }
    res.redirect('/admin/tiendas');
  } catch (error) {
    next(error);
  }
};
