 

module.exports = (sequelize, DataTypes) => {
  const Notificacion = sequelize.define('Notificacion', {
    tipo: {
      type: DataTypes.ENUM('confirmacion_pedido', 'pago', 'despacho', 'entrega', 'promocion', 'alerta_stock'),
      allowNull: false,
    },

    mensaje: { type: DataTypes.STRING(255), allowNull: false },  
    leido: { type: DataTypes.BOOLEAN, defaultValue: false },  
    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'notificaciones',
  });

  Notificacion.associate = (models) => {
    Notificacion.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: false } });
  };

  return Notificacion;
};
