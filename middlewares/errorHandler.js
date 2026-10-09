 

function errorHandler(err, req, res, next) {

  console.error('Error capturado:', err.message);

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).render('error', {
      titulo: 'Sesi\u00f3n expirada o formulario inv\u00e1lido',
      mensaje: 'Tu sesi\u00f3n pudo haber expirado o el formulario se envi\u00f3 de forma no v\u00e1lida. Por favor, recarga la p\u00e1gina e intenta de nuevo.',
    });
  }

  const status = err.status || 500;
  res.status(status);

  if (req.originalUrl.startsWith('/api')) {
    return res.json({ error: true, mensaje: err.message });
  }

  res.render('error', {
    titulo: 'Ocurrio un error',
    mensaje: err.message || 'Error inesperado en el servidor',
  });
}

module.exports = errorHandler;
