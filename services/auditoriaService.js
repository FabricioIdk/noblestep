 

const { Auditoria } = require('../models');

async function registrar(usuarioId, accion, entidadAfectada, entidadId, detalle) {
  return Auditoria.create({
    usuario_id: usuarioId || null,

    accion,
    entidad_afectada: entidadAfectada,
    entidad_id: entidadId || null,
    detalle,
  });
}

module.exports = { registrar };
