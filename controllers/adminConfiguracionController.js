 

const { ConfiguracionSistema } = require('../models');
const { registrar } = require('../services/auditoriaService');

exports.index = async (req, res, next) => {
  try {
    const parametros = await ConfiguracionSistema.findAll({ order: [['clave', 'ASC']] });
    res.render('admin/configuracion/index', { titulo: 'Configuraci\u00f3n del sistema', parametros, error: null });
  } catch (error) {
    next(error);
  }
};

exports.guardar = async (req, res, next) => {
  try {
    const { clave, valor } = req.body;
    if (!clave || !valor) {
      const parametros = await ConfiguracionSistema.findAll({ order: [['clave', 'ASC']] });
      return res.render('admin/configuracion/index', {
        titulo: 'Configuraci\u00f3n del sistema', parametros, error: 'Clave y valor son obligatorios.',
      });
    }

    const [parametro, creado] = await ConfiguracionSistema.findOrCreate({
      where: { clave }, defaults: { valor },
    });
    if (!creado) {

      await parametro.update({ valor });
    }

    await registrar(
      req.session.usuario.id, creado ? 'creacion_parametro' : 'actualizacion_parametro',
      'configuracion_sistema', parametro.id, `${clave} = ${valor}`
    );

    res.redirect('/admin/configuracion');
  } catch (error) {
    next(error);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    await ConfiguracionSistema.destroy({ where: { id: req.params.id } });
    res.redirect('/admin/configuracion');
  } catch (error) {
    next(error);
  }
};
