 

const { Pago, Pedido, Usuario } = require('../models');

const ESTADOS_VALIDOS = ['pendiente', 'aprobado', 'rechazado'];

exports.index = async (req, res, next) => {
  try {
    const filtroEstado = req.query.estado;
    const where = filtroEstado && ESTADOS_VALIDOS.includes(filtroEstado) ? { estado_pago: filtroEstado } : {};

    const pagos = await Pago.findAll({
      where,
      include: [{ model: Pedido, include: [Usuario] }],

      order: [['fecha_pago', 'DESC']],
    });

    res.render('admin/pagos/index', {
      titulo: 'Pagos', pagos, estados: ESTADOS_VALIDOS, filtroEstado: filtroEstado || '',
    });
  } catch (error) {
    next(error);
  }
};
