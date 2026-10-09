 

const { Favorito, Producto, Categoria } = require('../models');

exports.toggle = async (req, res, next) => {
  try {
    const productoId = req.params.productoId;
    const usuarioId = req.session.usuario.id;

    const existente = await Favorito.findOne({ where: { usuario_id: usuarioId, producto_id: productoId } });
    let esFavoritoAhora;
    if (existente) {
      await existente.destroy();
      esFavoritoAhora = false;
    } else {
      await Favorito.create({ usuario_id: usuarioId, producto_id: productoId });
      esFavoritoAhora = true;
    }

    if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ favorito: esFavoritoAhora });
    }

    res.redirect(req.body.regresar_a || '/productos');
  } catch (error) {
    next(error);
  }
};

exports.index = async (req, res, next) => {
  try {
    const favoritos = await Favorito.findAll({
      where: { usuario_id: req.session.usuario.id },
      include: [{ model: Producto, include: [{ model: Categoria, as: 'categoria' }] }],
      order: [['created_at', 'DESC']],
    });

    const productos = favoritos.map((f) => f.Producto).filter(Boolean);

    for (const p of productos) {
      const tieneOferta = p.precio_oferta && Number(p.precio_oferta) < Number(p.precio);
      p.enOferta = !!tieneOferta;
      p.precioEfectivo = tieneOferta ? Number(p.precio_oferta) : Number(p.precio);
    }

    res.render('favoritos/index', { titulo: 'Mis favoritos', productos });
  } catch (error) {
    next(error);
  }
};
