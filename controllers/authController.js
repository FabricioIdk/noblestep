 

const bcrypt = require('bcryptjs');

const crypto = require('crypto');

const { Usuario } = require('../models');
const { enviarCorreo } = require('../services/emailService');

function passwordEsValida(password) {
  if (!password || password.length < 8) return false;
  const tieneLetra = /[a-zA-Z]/.test(password);    
  const tieneNumero = /[0-9]/.test(password);       
  return tieneLetra && tieneNumero;
}
const MENSAJE_POLITICA_PASSWORD = 'La contrase\u00f1a debe tener al menos 8 caracteres, incluyendo letras y n\u00fameros.';

exports.registroForm = (req, res) => {
  res.render('auth/registro', { titulo: 'Crear cuenta', error: null, valores: {} });
};

exports.registro = async (req, res, next) => {
  try {

    const { nombre, apellido, email, password, telefono } = req.body;

    const valores = { nombre, apellido, email, telefono };

    if (!nombre || !apellido || !email || !password) {
      return res.render('auth/registro', {
        titulo: 'Crear cuenta',
        error: 'Todos los campos obligatorios deben completarse.',
        valores,
      });

    }

    if (!passwordEsValida(password)) {
      return res.render('auth/registro', {
        titulo: 'Crear cuenta', error: MENSAJE_POLITICA_PASSWORD, valores,
      });
    }

    const existente = await Usuario.findOne({ where: { email } });
    if (existente) {
      return res.render('auth/registro', {
        titulo: 'Crear cuenta',
        error: 'Ya existe una cuenta registrada con ese correo.',
        valores,
      });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      nombre, apellido, email, telefono,
      password: passwordHasheado,  
      rol: 'cliente',
    });

    req.session.usuario = {
      id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol,

    };

    res.redirect('/');  
  } catch (error) {
    next(error);
  }
};

exports.loginForm = (req, res) => {
  res.render('auth/login', { titulo: 'Iniciar sesi\u00f3n', error: null });
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {

      return res.render('auth/login', { titulo: 'Iniciar sesi\u00f3n', error: 'Credenciales incorrectas.' });
    }

    const passwordValido = await bcrypt.compare(password, usuario.password);
    if (!passwordValido) {
      return res.render('auth/login', { titulo: 'Iniciar sesi\u00f3n', error: 'Credenciales incorrectas.' });
    }

    req.session.usuario = {
      id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol,
    };

    if (usuario.rol === 'administrador') {
      return res.redirect('/admin');
    }
    res.redirect('/');
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res, next) => {

  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
};

exports.olvideForm = (req, res) => {
  res.render('auth/olvide-password', { titulo: 'Recuperar contrase\u00f1a', error: null, mensaje: null });
};

exports.olvideSubmit = async (req, res, next) => {
  try {
    const { email } = req.body;
    const usuario = await Usuario.findOne({ where: { email } });

    if (usuario) {
      const token = crypto.randomBytes(32).toString('hex');
      const expira = new Date(Date.now() + 60 * 60 * 1000);

      await usuario.update({ reset_token: token, reset_token_expira: expira });

      const enlace = `${req.protocol}://${req.get('host')}/auth/restablecer-password/${token}`;
      await enviarCorreo({
        destinatario: usuario.email,
        asunto: 'Recupera tu contrase\u00f1a - Noble Step',
        textoPlano: `Para crear una nueva contrase\u00f1a ingresa a este enlace (vale 1 hora): ${enlace}`,
      });
    }

    res.render('auth/olvide-password', {
      titulo: 'Recuperar contrase\u00f1a', error: null,
      mensaje: 'Si el correo est\u00e1 registrado, te enviamos un enlace para crear una nueva contrase\u00f1a. Revisa tu bandeja de entrada y la carpeta de spam.',
    });
  } catch (error) {
    next(error);
  }
};

exports.restablecerForm = async (req, res, next) => {
  try {
    const usuario = await Usuario.findOne({
      where: { reset_token: req.params.token },  
    });

    if (!usuario || !usuario.reset_token_expira || usuario.reset_token_expira < new Date()) {
      return res.render('auth/restablecer-password', {
        titulo: 'Restablecer contrase\u00f1a', token: req.params.token,
        error: 'El enlace no es v\u00e1lido o ya expir\u00f3. Solicita uno nuevo.', expirado: true,
      });
    }

    res.render('auth/restablecer-password', {
      titulo: 'Restablecer contrase\u00f1a', token: req.params.token, error: null, expirado: false,
    });
  } catch (error) {
    next(error);
  }
};

exports.restablecerSubmit = async (req, res, next) => {
  try {
    const usuario = await Usuario.findOne({ where: { reset_token: req.params.token } });

    if (!usuario || !usuario.reset_token_expira || usuario.reset_token_expira < new Date()) {
      return res.render('auth/restablecer-password', {
        titulo: 'Restablecer contrase\u00f1a', token: req.params.token,
        error: 'El enlace no es v\u00e1lido o ya expir\u00f3. Solicita uno nuevo.', expirado: true,
      });
    }

    const { password } = req.body;
    if (!passwordEsValida(password)) {
      return res.render('auth/restablecer-password', {
        titulo: 'Restablecer contrase\u00f1a', token: req.params.token,
        error: MENSAJE_POLITICA_PASSWORD, expirado: false,
      });
    }

    const passwordHasheado = await bcrypt.hash(password, 10);
    await usuario.update({
      password: passwordHasheado,
      reset_token: null,         
      reset_token_expira: null,  
    });

    res.redirect('/auth/login');
  } catch (error) {
    next(error);
  }
};
