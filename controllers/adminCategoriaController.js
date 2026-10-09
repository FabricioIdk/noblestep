 

const { Categoria } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
    res.render('admin/categorias/index', { titulo: 'Categor\u00edas', categorias, error: null });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) {

      const categorias = await Categoria.findAll({ order: [['nombre', 'ASC']] });
      return res.render('admin/categorias/index', {
        titulo: 'Categor\u00edas', categorias, error: 'El nombre es obligatorio.',
      });
    }

    const slug = nombre.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    await Categoria.create({ nombre, descripcion, slug });
    res.redirect('/admin/categorias');
  } catch (error) {
    next(error);
  }
};

exports.destroy = async (req, res, next) => {
  try {
    await Categoria.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/categorias');
  } catch (error) {
    next(error);
  }
};
