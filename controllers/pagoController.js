const { Pedido, Pago, Envio, sequelize } = require('../models');
const { notificar, notificarATodosLosAdmins } = require('../services/notificacionService');
const mercadoPago = require('../services/mercadoPagoService');

const ESTADOS_MERCADO_PAGO = {
  approved: 'aprobado',
  authorized: 'pendiente',
  pending: 'pendiente',
  in_process: 'pendiente',
  in_mediation: 'pendiente',
  rejected: 'rechazado',
  cancelled: 'rechazado',
  refunded: 'rechazado',
  charged_back: 'rechazado',
};

function metodoDesdeMercadoPago(pago) {
  if (pago.payment_method_id === 'yape') return 'yape';
  if (['credit_card', 'debit_card', 'prepaid_card'].includes(pago.payment_type_id)) return 'tarjeta';
  return 'mercadopago';
}

function buscarPedidoDelUsuario(req) {
  return Pedido.findOne({
    where: { id: req.params.id, usuario_id: req.session.usuario.id },
    include: [Envio],
  });
}

function renderizarPagar(res, pedido, error) {
  res.render('pedidos/pagar', {
    titulo: 'Pagar pedido',
    pedido,
    error,
    pagosDisponibles: mercadoPago.estaConfigurado(),
  });
}

async function registrarPago(pagoMp) {
  const pedidoId = Number(pagoMp.external_reference);
  if (!Number.isInteger(pedidoId)) return null;

  const estado = ESTADOS_MERCADO_PAGO[pagoMp.status] || 'pendiente';
  const referencia = `MP-${pagoMp.id}`;

  const resultado = await sequelize.transaction(async (t) => {
    const pedido = await Pedido.findByPk(pedidoId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!pedido) return null;

    const montoCorrecto = pagoMp.currency_id === 'PEN'
      && Math.abs(Number(pagoMp.transaction_amount) - Number(pedido.total)) < 0.01;
    const estadoFinal = estado === 'aprobado' && !montoCorrecto ? 'pendiente' : estado;

    const datosPago = {
      pedido_id: pedido.id,
      metodo_pago: metodoDesdeMercadoPago(pagoMp),
      estado_pago: estadoFinal,
      monto: pagoMp.transaction_amount,
      referencia_transaccion: referencia,
    };
    const existente = await Pago.findOne({ where: { referencia_transaccion: referencia }, transaction: t });
    if (existente) {
      await existente.update(datosPago, { transaction: t });
    } else {
      await Pago.create(datosPago, { transaction: t });
    }

    let recienPagado = false;
    if (estadoFinal === 'aprobado' && pedido.estado === 'pendiente') {
      await pedido.update({ estado: 'pagado' }, { transaction: t });
      recienPagado = true;
    }

    return { pedido, estado: estadoFinal, recienPagado, montoCorrecto };
  });

  if (!resultado) return null;

  if (resultado.recienPagado) {
    await notificar(resultado.pedido.usuario_id, 'pago',
      `Tu pago del pedido ${resultado.pedido.numero_pedido} fue aprobado. ¡Gracias por tu compra!`);
  }
  if (estado === 'aprobado' && !resultado.montoCorrecto) {
    await notificarATodosLosAdmins('pago',
      `Revisar pago ${referencia}: el monto cobrado no coincide con el total del pedido ${resultado.pedido.numero_pedido}.`);
  }

  return resultado;
}

async function sincronizarPagos(pedido) {
  if (pedido.estado !== 'pendiente' || !mercadoPago.estaConfigurado()) return false;
  try {
    const pagos = await mercadoPago.buscarPagosDePedido(pedido.id);
    for (const pagoMp of pagos.reverse()) {
      await registrarPago(pagoMp);
    }
    if (pagos.length > 0) await pedido.reload();
    return pedido.estado !== 'pendiente';
  } catch (error) {
    console.error('Error sincronizando pagos con Mercado Pago:', error.message);
    return false;
  }
}

exports.sincronizarPagos = sincronizarPagos;

exports.mostrarFormulario = async (req, res, next) => {
  try {
    const pedido = await buscarPedidoDelUsuario(req);

    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }
    if (await sincronizarPagos(pedido)) {
      return res.redirect(`/pedidos/${pedido.id}?pago=aprobado`);
    }
    if (pedido.estado !== 'pendiente') {
      return res.redirect(`/pedidos/${pedido.id}`);
    }

    const avisos = {
      cancelado: 'No se completó el pago. Puedes intentarlo de nuevo cuando quieras.',
      rechazado: 'Tu pago fue rechazado. Revisa los datos de tu tarjeta o prueba con otro medio de pago.',
    };
    renderizarPagar(res, pedido, avisos[req.query.pago] || null);
  } catch (error) {
    next(error);
  }
};

exports.iniciarPago = async (req, res, next) => {
  try {
    const pedido = await buscarPedidoDelUsuario(req);

    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }
    if (pedido.estado !== 'pendiente') {
      return res.redirect(`/pedidos/${pedido.id}`);
    }
    if (!mercadoPago.estaConfigurado()) {
      return renderizarPagar(res.status(503), pedido, 'Los pagos en línea no están disponibles en este momento. Escríbenos por WhatsApp para completar tu compra.');
    }

    let preferencia;
    try {
      preferencia = await mercadoPago.crearPreferencia(pedido);
    } catch (error) {
      console.error('Error creando la preferencia de Mercado Pago:', error.message);
      return renderizarPagar(res.status(502), pedido, 'No pudimos conectar con Mercado Pago. Intenta de nuevo en unos segundos.');
    }

    res.redirect(303, preferencia.init_point);
  } catch (error) {
    next(error);
  }
};

exports.retornoPago = async (req, res, next) => {
  try {
    const pedido = await buscarPedidoDelUsuario(req);
    if (!pedido) {
      return res.status(404).render('404', { titulo: 'Pedido no encontrado' });
    }

    const idPago = req.query.payment_id || req.query.collection_id;
    if (!idPago || idPago === 'null') {
      return res.redirect(`/pedidos/${pedido.id}/pagar?pago=cancelado`);
    }

    let pagoMp;
    try {
      pagoMp = await mercadoPago.obtenerPago(idPago);
    } catch (error) {
      console.error('Error consultando el pago en Mercado Pago:', error.message);
      return res.redirect(`/pedidos/${pedido.id}?pago=verificando`);
    }

    if (String(pagoMp.external_reference) !== String(pedido.id)) {
      return res.redirect(`/pedidos/${pedido.id}/pagar?pago=cancelado`);
    }

    const resultado = await registrarPago(pagoMp);
    if (resultado && resultado.estado === 'rechazado') {
      return res.redirect(`/pedidos/${pedido.id}/pagar?pago=rechazado`);
    }
    res.redirect(`/pedidos/${pedido.id}?pago=${resultado && resultado.estado === 'aprobado' ? 'aprobado' : 'pendiente'}`);
  } catch (error) {
    next(error);
  }
};

exports.webhook = async (req, res) => {
  const tipo = req.query.type || req.query.topic || (req.body && req.body.type);
  const idPago = req.query['data.id'] || (req.body && req.body.data && req.body.data.id) || req.query.id;

  if (tipo !== 'payment' || !idPago) {
    return res.sendStatus(200);
  }
  if (!mercadoPago.firmaWebhookValida(req, idPago)) {
    return res.sendStatus(401);
  }

  try {
    const pagoMp = await mercadoPago.obtenerPago(idPago);
    await registrarPago(pagoMp);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error procesando el webhook de Mercado Pago:', error.message);
    res.sendStatus(500);
  }
};
