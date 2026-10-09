 

const { Notificacion, Usuario } = require('../models');

async function notificar(usuarioId, tipo, mensaje) {
  return Notificacion.create({ usuario_id: usuarioId, tipo, mensaje });
}

async function notificarATodosLosAdmins(tipo, mensaje) {
  const admins = await Usuario.findAll({ where: { rol: 'administrador' } });

  return Promise.all(admins.map((a) => notificar(a.id, tipo, mensaje)));
}

module.exports = { notificar, notificarATodosLosAdmins };
