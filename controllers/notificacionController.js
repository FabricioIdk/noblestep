 

const { Notificacion } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const notificaciones = await Notificacion.findAll({
      where: { usuario_id: req.session.usuario.id },  
      order: [['fecha', 'DESC']],  
    });
    res.render('notificaciones/index', { titulo: 'Notificaciones', notificaciones });
  } catch (error) {
    next(error);
  }
};

exports.marcarLeida = async (req, res, next) => {
  try {
    await Notificacion.update(
      { leido: true },

      { where: { id: req.params.id, usuario_id: req.session.usuario.id } }
    );
    res.redirect('/notificaciones');
  } catch (error) {
    next(error);
  }
};

exports.marcarTodas = async (req, res, next) => {
  try {
    await Notificacion.update(
      { leido: true },
      { where: { usuario_id: req.session.usuario.id, leido: false } }

    );
    res.redirect('/notificaciones');
  } catch (error) {
    next(error);
  }
};
