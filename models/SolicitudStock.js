 

module.exports = (sequelize, DataTypes) => {
  const SolicitudStock = sequelize.define('SolicitudStock', {
    email: { type: DataTypes.STRING(120), allowNull: false },
    notificado: { type: DataTypes.BOOLEAN, defaultValue: false },

  }, {
    tableName: 'solicitudes_stock',
    indexes: [{ unique: true, fields: ['email', 'variante_id'] }],

  });

  SolicitudStock.associate = (models) => {
    SolicitudStock.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });
    SolicitudStock.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: true } });

  };

  return SolicitudStock;
};
