 

module.exports = (sequelize, DataTypes) => {
  const DetalleCarrito = sequelize.define('DetalleCarrito', {
    cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },

    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

  }, {
    tableName: 'detalle_carrito',
  });

  DetalleCarrito.associate = (models) => {
    DetalleCarrito.belongsTo(models.Carrito, { foreignKey: { name: 'carrito_id', allowNull: false } });
    DetalleCarrito.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });

  };

  return DetalleCarrito;
};
