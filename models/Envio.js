 

module.exports = (sequelize, DataTypes) => {
  const Envio = sequelize.define('Envio', {
    costo_envio: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    zona: { type: DataTypes.STRING(80) },  
    empresa_transporte: { type: DataTypes.STRING(100) },  
    numero_seguimiento: { type: DataTypes.STRING(60) },  
    estado: { type: DataTypes.ENUM('pendiente', 'en_camino', 'entregado'), defaultValue: 'pendiente' },

  }, {
    tableName: 'envios',
  });

  Envio.associate = (models) => {

    Envio.belongsTo(models.Pedido, { foreignKey: { name: 'pedido_id', allowNull: false, unique: true } });
  };

  return Envio;
};
