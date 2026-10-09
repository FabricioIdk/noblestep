 

const { Proveedor } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const proveedores = await Proveedor.findAll({ order: [['nombre', 'ASC']] });
    res.render('admin/proveedores/index', { titulo: 'Proveedores', proveedores, error: null });
  } catch (error) {
    next(error);
  }
};

exports.store = async (req, res, next) => {
  try {
    const { nombre, ruc, contacto, telefono, email, direccion } = req.body;

    if (!nombre || !ruc) {
      const proveedores = await Proveedor.findAll({ order: [['nombre', 'ASC']] });
      return res.render('admin/proveedores/index', {
        titulo: 'Proveedores', proveedores, error: 'Nombre y RUC son obligatorios.',
      });
    }

    await Proveedor.create({ nombre, ruc, contacto, telefono, email, direccion, activo: true });
    res.redirect('/admin/proveedores');
  } catch (error) {

    if (error.name === 'SequelizeUniqueConstraintError') {
      const proveedores = await Proveedor.findAll({ order: [['nombre', 'ASC']] });
      return res.render('admin/proveedores/index', {
        titulo: 'Proveedores', proveedores, error: 'Ya existe un proveedor registrado con ese RUC.',
      });
    }
    next(error);  
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const proveedor = await Proveedor.findByPk(req.params.id);
    if (proveedor) await proveedor.update({ activo: !proveedor.activo });

    res.redirect('/admin/proveedores');
  } catch (error) {
    next(error);
  }
};
