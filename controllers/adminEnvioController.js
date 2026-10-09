 

const { Envio, Pedido, Usuario } = require('../models');
const { notificar } = require('../services/notificacionService');

const ESTADOS_VALIDOS = ['pendiente', 'en_camino', 'entregado'];

exports.index = async (req, res, next) => {
  try {
    const filtroEstado = req.query.estado;
    const where = filtroEstado && ESTADOS_VALIDOS.includes(filtroEstado) ? { estado: filtroEstado } : {};

    const envios = await Envio.findAll({
      where,

      include: [{ model: Pedido, include: [Usuario] }],
      order: [['id', 'DESC']],
    });

    res.render('admin/envios/index', {
      titulo: 'Env\u00edos', envios, estados: ESTADOS_VALIDOS, filtroEstado: filtroEstado || '',
    });
  } catch (error) {
    next(error);
  }
};

exports.guardar = async (req, res, next) => {
  try {
    const { costo_envio, zona, empresa_transporte, numero_seguimiento, estado } = req.body;

    let envio = await Envio.findOne({ where: { pedido_id: req.params.id } });
    const estadoAnterior = envio ? envio.estado : null;

    if (envio) {

      await envio.update({ costo_envio, zona, empresa_transporte, numero_seguimiento, estado });
    } else {

      envio = await Envio.create({
        pedido_id: req.params.id, costo_envio, zona, empresa_transporte, numero_seguimiento, estado,
      });
    }

    if (estado !== estadoAnterior) {
      const pedido = await Pedido.findByPk(req.params.id);
      if (estado === 'en_camino') {
        await notificar(pedido.usuario_id, 'despacho',
          `Tu pedido ${pedido.numero_pedido} fue despachado${empresa_transporte ? ' con ' + empresa_transporte : ''}.`);
      } else if (estado === 'entregado') {
        await notificar(pedido.usuario_id, 'entrega',
          `Tu pedido ${pedido.numero_pedido} fue entregado. \u00a1Esperamos que lo disfrutes!`);
      }

    }

    res.redirect(`/admin/pedidos/${req.params.id}`);
  } catch (error) {
    next(error);
  }
};
