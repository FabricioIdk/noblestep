 

module.exports = (sequelize, DataTypes) => {
  const DetallePedido = sequelize.define('DetallePedido', {
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

  }, {
    tableName: 'detalle_pedido',
  });

  DetallePedido.associate = (models) => {
    DetallePedido.belongsTo(models.Pedido, { foreignKey: { name: 'pedido_id', allowNull: false } });
    DetallePedido.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });
  };

  return DetallePedido;
};
