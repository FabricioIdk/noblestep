 

require('dotenv').config();  
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const crypto = require('crypto');
const morgan = require('morgan');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const sequelize = require('./config/database');
const { Notificacion } = require('./models');
const errorHandler = require('./middlewares/errorHandler');
const csrfProtection = require('./middlewares/csrf');

const app = express();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],

        scriptSrcAttr: ["'none'"],

        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        formAction: ["'self'", 'https://*.mercadopago.com.pe', 'https://*.mercadopago.com'],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
  })
);

app.use(morgan('dev'));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.post('/webhooks/mercadopago', require('./controllers/pagoController').webhook);

const sessionStore = new SequelizeStore({ db: sequelize, tableName: 'sesiones' });

app.use(session({
  secret: process.env.SESSION_SECRET || 'clave-temporal',

  store: sessionStore,           
  resave: false,                  
  saveUninitialized: false,       
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,  
    httpOnly: true,  
    secure: process.env.NODE_ENV === 'production',  
    sameSite: 'lax',  
  },
}));

sessionStore.sync();  

const RUTAS_MULTIPART_EXENTAS_GLOBAL = [
  { method: 'POST', regex: /^\/admin\/productos\/?$/ },
  { method: 'POST', regex: /^\/admin\/productos\/\d+\/?$/ },
  { method: 'POST', regex: /^\/admin\/productos\/\d+\/imagenes\/?$/ },
];

app.use(async (req, res, next) => {
  res.locals.usuarioSesion = req.session.usuario || null;
  if (req.session.usuario) {
    try {
      res.locals.notificacionesNoLeidas = await Notificacion.count({
        where: { usuario_id: req.session.usuario.id, leido: false },
      });
    } catch (e) {
      res.locals.notificacionesNoLeidas = 0;  
    }
  } else {
    res.locals.notificacionesNoLeidas = 0;
  }
  next();  
});

app.use((req, res, next) => {
  const esExenta = RUTAS_MULTIPART_EXENTAS_GLOBAL.some(
    (r) => r.method === req.method && r.regex.test(req.path)
  );
  if (esExenta) return next();  
  csrfProtection(req, res, next);  
});

app.use((req, res, next) => {

  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
  next();
});

app.get('/', require('./controllers/homeController').index);

app.get('/guia-tallas', (req, res) => {
  res.render('guia-tallas', { titulo: 'Guía de tallas' });
});

app.use('/productos', require('./routes/productoRoutes'));    
app.use('/auth', require('./routes/authRoutes'));              
app.use('/admin', require('./routes/adminRoutes'));            
app.use('/carrito', require('./routes/carritoRoutes'));        
app.use('/checkout', require('./routes/checkoutRoutes'));      
app.use('/comprar-ahora', require('./routes/compraRapidaRoutes'));  
app.use('/pedidos', require('./routes/pedidoRoutes'));         
app.use('/notificaciones', require('./routes/notificacionRoutes'));
app.use('/favoritos', require('./routes/favoritoRoutes'));

app.get('/mi-cuenta', require('./middlewares/authMiddleware').requireAuth, require('./controllers/cuentaController').index);

app.get('/estado', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ servidor: 'ok', base_de_datos: 'conectada' });
  } catch (error) {
    res.status(500).json({ servidor: 'ok', base_de_datos: 'sin conexion', detalle: error.message });
  }
});

app.use((req, res) => {
  res.status(404).render('404', { titulo: 'Pagina no encontrada' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function iniciar() {
  try {
    await sequelize.authenticate();  
    console.log('Conexion a MySQL establecida correctamente.');

    const { Tienda } = require('./models');
    const [almacenOnline] = await Tienda.findOrCreate({
      where: { tipo: 'almacen_online' },
      defaults: { nombre: 'Almac\u00e9n Central (Online)', tipo: 'almacen_online', activo: true },
    });
    console.log(`Almacen online listo (id ${almacenOnline.id}).`);
  } catch (error) {

    console.warn('Aviso: no se pudo conectar a MySQL todavia ->', error.message);
    console.warn('El servidor seguira levantando; revisa tu archivo .env y que MySQL este corriendo.');
  }

  app.listen(PORT, () => {
    console.log(`Servidor Noble Step corriendo en http://localhost:${PORT}`);
  });
}

iniciar();

module.exports = app;
