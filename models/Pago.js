 

module.exports = (sequelize, DataTypes) => {
  const Pago = sequelize.define('Pago', {
    metodo_pago: { type: DataTypes.ENUM('tarjeta', 'yape', 'plin', 'transferencia', 'mercadopago'), allowNull: false },
    estado_pago: { type: DataTypes.ENUM('pendiente', 'aprobado', 'rechazado'), defaultValue: 'pendiente' },
    monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fecha_pago: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

    referencia_transaccion: { type: DataTypes.STRING(100), unique: 'pagos_referencia_transaccion_unica' },

  }, {
    tableName: 'pagos',
  });

  Pago.associate = (models) => {
    Pago.belongsTo(models.Pedido, { foreignKey: { name: 'pedido_id', allowNull: false } });
  };

  return Pago;
};
