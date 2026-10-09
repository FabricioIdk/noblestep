 

const { SolicitudStock, VarianteProducto } = require('../models');

exports.crear = async (req, res, next) => {
  try {
    const { variante_id, email } = req.body;

    const variante = await VarianteProducto.findByPk(variante_id);
    if (!variante) {
      return res.status(404).render('404', { titulo: 'Variante no encontrada' });
    }

    await SolicitudStock.findOrCreate({
      where: { email, variante_id },
      defaults: { email, variante_id, usuario_id: req.session.usuario ? req.session.usuario.id : null },
    });

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ registrado: true });
    }

    res.redirect(req.body.regresar_a || `/productos/${req.params.productoId}`);
  } catch (error) {
    next(error);
  }
};
