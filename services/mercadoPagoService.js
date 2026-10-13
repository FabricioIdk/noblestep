const crypto = require('crypto');

const API = 'https://api.mercadopago.com';

function estaConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function urlBase() {
  return (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
}

async function llamarApi(ruta, opciones = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...opciones.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(`Mercado Pago respondió ${respuesta.status}: ${datos.message || datos.error || 'sin detalle'}`);
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
}

async function crearPreferencia(pedido) {
  const base = urlBase();
  const retorno = `${base}/pedidos/${pedido.id}/pago/retorno`;
  const cuerpo = {
    items: [{
      id: String(pedido.id),
      title: `Pedido ${pedido.numero_pedido} - Noble Step`,
      quantity: 1,
      currency_id: 'PEN',
      unit_price: Number(Number(pedido.total).toFixed(2)),
    }],
    external_reference: String(pedido.id),
    statement_descriptor: 'NOBLE STEP',
    back_urls: { success: retorno, failure: retorno, pending: retorno },
  };

  if (base.startsWith('https://')) {
    cuerpo.auto_return = 'approved';
    cuerpo.notification_url = `${base}/webhooks/mercadopago`;
  }

  return llamarApi('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(cuerpo),
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
  });
}

function obtenerPago(idPago) {
  return llamarApi(`/v1/payments/${encodeURIComponent(idPago)}`);
}

async function buscarPagosDePedido(pedidoId) {
  const parametros = new URLSearchParams({
    external_reference: String(pedidoId),
    sort: 'date_created',
    criteria: 'desc',
    limit: '10',
  });
  const respuesta = await llamarApi(`/v1/payments/search?${parametros}`);
  return respuesta.results || [];
}

function firmaWebhookValida(req, idDato) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return true;

  const cabecera = req.get('x-signature') || '';
  const partes = Object.fromEntries(cabecera.split(',').map((p) => p.trim().split('=')));
  if (!partes.ts || !partes.v1) return false;

  const idSolicitud = req.get('x-request-id');
  let manifiesto = `id:${String(idDato).toLowerCase()};`;
  if (idSolicitud) manifiesto += `request-id:${idSolicitud};`;
  manifiesto += `ts:${partes.ts};`;

  const esperado = crypto.createHmac('sha256', secreto).update(manifiesto).digest('hex');
  const recibido = Buffer.from(partes.v1, 'hex');
  const calculado = Buffer.from(esperado, 'hex');
  return recibido.length === calculado.length && crypto.timingSafeEqual(recibido, calculado);
}

module.exports = { estaConfigurado, crearPreferencia, obtenerPago, buscarPagosDePedido, firmaWebhookValida };
