 

module.exports = (sequelize, DataTypes) => {
  const Pedido = sequelize.define('Pedido', {
    numero_pedido: { type: DataTypes.STRING(20), allowNull: false, unique: true },

    estado: {
      type: DataTypes.ENUM('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'),
      defaultValue: 'pendiente',
    },

    tipo_entrega: {
      type: DataTypes.ENUM('envio_domicilio', 'recojo_tienda'),
      allowNull: false,
      defaultValue: 'envio_domicilio',
    },

    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    igv: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    fecha_pedido: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'pedidos',
  });

  Pedido.associate = (models) => {
    Pedido.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: false } });
    Pedido.belongsTo(models.Direccion, { foreignKey: { name: 'direccion_id', allowNull: false } });

    Pedido.belongsTo(models.Cupon, { foreignKey: { name: 'cupon_id', allowNull: true } });

    Pedido.belongsTo(models.Tienda, { foreignKey: { name: 'tienda_id', allowNull: false } });

    Pedido.hasMany(models.DetallePedido, { foreignKey: { name: 'pedido_id', allowNull: false } });

    Pedido.hasMany(models.Pago, { foreignKey: { name: 'pedido_id', allowNull: false } });

    Pedido.hasOne(models.Envio, { foreignKey: { name: 'pedido_id', allowNull: false } });
  };

  return Pedido;
};
