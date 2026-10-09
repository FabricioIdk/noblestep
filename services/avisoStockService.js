 

const { SolicitudStock, VarianteProducto, Producto, Tienda } = require('../models');
const { enviarCorreo } = require('./emailService');

async function avisarSiVolvioElStock(varianteId) {

  const solicitudesPendientes = await SolicitudStock.findAll({
    where: { variante_id: varianteId, notificado: false },
  });
  if (solicitudesPendientes.length === 0) return;

  const almacenOnline = await Tienda.findOne({ where: { tipo: 'almacen_online' } });
  if (!almacenOnline) return;

  const { InventarioTienda } = require('../models');
  const inventario = await InventarioTienda.findOne({
    where: { tienda_id: almacenOnline.id, variante_id: varianteId },
  });
  if (!inventario || inventario.stock <= 0) return;  

  const variante = await VarianteProducto.findByPk(varianteId);
  const producto = await Producto.findByPk(variante.producto_id);

  for (const solicitud of solicitudesPendientes) {
    const asunto = `¡${producto.nombre} ya está disponible!`;
    const textoPlano = `Hola,\n\nLa talla ${variante.talla} / color ${variante.color} de ${producto.nombre} que estabas esperando ya está disponible en Noble Step.\n\nEntra a la tienda antes de que se agote de nuevo.\n\n— Noble Step`;
    const html = `
      <p>Hola,</p>
      <p>La talla <strong>${variante.talla}</strong> / color <strong>${variante.color}</strong> de
      <strong>${producto.nombre}</strong> que estabas esperando ya está disponible en Noble Step.</p>
      <p>Entra a la tienda antes de que se agote de nuevo.</p>
      <p>— Noble Step</p>
    `;

    await enviarCorreo({ destinatario: solicitud.email, asunto, textoPlano, html });
    await solicitud.update({ notificado: true });
  }
}

module.exports = { avisarSiVolvioElStock };
