const { Pedido, Pago, Envio } = require('../models');
const { notificar } = require('../services/notificacionService');

const METODOS_PERMITIDOS = ['tarjeta', 'yape', 'plin'];

function procesarPago({ metodo_pago }) {
  const referencia = `NS-${metodo_pago.toUpperCase()}-${Date.now()}`;
  return { aprobado: true, referencia };
}

function buscarPedido(req) {
  return Pedido.findOne({
    where: { id: req.params.id, usuario_id: req.session.usuario.id },
    include: [Envio],
  });
}

exports.mostrarFormulario = async (req, res, next) => {
  try {
    const pedido = await buscarPedido(req);

    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }
    if (pedido.estado !== 'pendiente') {
      return res.redirect(`/pedidos/${pedido.id}`);
    }

    res.render('pedidos/pagar', { titulo: 'Pagar pedido', pedido, error: null });
  } catch (error) {
    next(error);
  }
};

exports.procesarPago = async (req, res, next) => {
  try {
    const pedido = await buscarPedido(req);

    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }
    if (pedido.estado !== 'pendiente') {
      return res.redirect(`/pedidos/${pedido.id}`);
    }

    const { metodo_pago } = req.body;
    if (!METODOS_PERMITIDOS.includes(metodo_pago)) {
      return res.status(400).render('pedidos/pagar', {
        titulo: 'Pagar pedido', pedido,
        error: 'Elige un método de pago válido.',
      });
    }

    const resultado = procesarPago({ metodo_pago });

    await Pago.create({
      pedido_id: pedido.id,
      metodo_pago,
      estado_pago: resultado.aprobado ? 'aprobado' : 'rechazado',
      monto: pedido.total,
      referencia_transaccion: resultado.referencia,
    });

    if (resultado.aprobado) {
      await pedido.update({ estado: 'pagado' });
      await notificar(pedido.usuario_id, 'pago',
        `Tu pago del pedido ${pedido.numero_pedido} fue aprobado. ¡Gracias por tu compra!`);
      return res.redirect(`/pedidos/${pedido.id}`);
    }

    res.render('pedidos/pagar', {
      titulo: 'Pagar pedido', pedido,
      error: 'El pago fue rechazado. Verifica tus datos o intenta con otro método.',
    });
  } catch (error) {
    next(error);
  }
};
