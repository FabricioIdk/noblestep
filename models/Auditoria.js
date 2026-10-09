 

module.exports = (sequelize, DataTypes) => {
  const Auditoria = sequelize.define('Auditoria', {
    accion: { type: DataTypes.STRING(100), allowNull: false },

    entidad_afectada: { type: DataTypes.STRING(60), allowNull: false },

    entidad_id: { type: DataTypes.INTEGER },

    detalle: { type: DataTypes.TEXT },

    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'auditoria',
  });

  Auditoria.associate = (models) => {

    Auditoria.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: true } });
  };

  return Auditoria;
};
