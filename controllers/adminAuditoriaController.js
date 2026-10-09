 

const { Auditoria, Usuario } = require('../models');

exports.index = async (req, res, next) => {
  try {
    const filtroEntidad = req.query.entidad;  
    const where = filtroEntidad ? { entidad_afectada: filtroEntidad } : {};

    const registros = await Auditoria.findAll({
      where,
      include: [Usuario],  
      order: [['fecha', 'DESC']],
      limit: 100,  
    });

    res.render('admin/auditoria/index', {
      titulo: 'Auditor\u00eda del sistema', registros, filtroEntidad: filtroEntidad || '',
    });
  } catch (error) {
    next(error);
  }
};
