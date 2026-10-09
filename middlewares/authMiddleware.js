 

function requireAuth(req, res, next) {
  if (!req.session.usuario) {

    return res.redirect('/auth/login');  
  }
  next();  
}

function requireAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.redirect('/auth/login');
  }
  if (req.session.usuario.rol !== 'administrador') {

    return res.status(403).render('error', {
      titulo: 'Acceso denegado',
      mensaje: 'No tienes permisos de administrador para ver esta pagina.',
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
