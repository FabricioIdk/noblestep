 

module.exports = (sequelize, DataTypes) => {
  const DetalleOrdenCompra = sequelize.define('DetalleOrdenCompra', {
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    costo_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

  }, {
    tableName: 'detalle_orden_compra',
  });

  DetalleOrdenCompra.associate = (models) => {
    DetalleOrdenCompra.belongsTo(models.OrdenCompra, { foreignKey: { name: 'orden_compra_id', allowNull: false } });
    DetalleOrdenCompra.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });
  };

  return DetalleOrdenCompra;
};
