 

const { Cupon } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const cupones = await Cupon.findAll({ order: [['id', 'DESC']] });  
    res.render('admin/cupones/index', { titulo: 'Cupones', cupones, error: null });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { codigo, tipo_descuento, valor, fecha_inicio, fecha_fin } = req.body;

    if (!codigo || !valor || !fecha_inicio || !fecha_fin) {
      const cupones = await Cupon.findAll({ order: [['id', 'DESC']] });
      return res.render('admin/cupones/index', {
        titulo: 'Cupones', cupones, error: 'Todos los campos son obligatorios.',
      });
    }

    await Cupon.create({
      codigo: codigo.toUpperCase(),  

      tipo_descuento, valor, fecha_inicio, fecha_fin, activo: true,
    });

    res.redirect('/admin/cupones');
  } catch (error) {
    next(error);
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const cupon = await Cupon.findByPk(req.params.id);
    if (cupon) {
      await cupon.update({ activo: !cupon.activo });
    }
    res.redirect('/admin/cupones');
  } catch (error) {
    next(error);
  }
};

exports.destroy = async (req, res, next) => {
  try {
    await Cupon.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/cupones');
  } catch (error) {
    next(error);
  }
};
