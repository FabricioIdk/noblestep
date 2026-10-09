 

module.exports = (sequelize, DataTypes) => {
  const InventarioTienda = sequelize.define('InventarioTienda', {
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    stock_minimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },

  }, {
    tableName: 'inventario_tienda',
    indexes: [{ unique: true, fields: ['tienda_id', 'variante_id'] }],

  });

  InventarioTienda.associate = (models) => {
    InventarioTienda.belongsTo(models.Tienda, { foreignKey: { name: 'tienda_id', allowNull: false } });
    InventarioTienda.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });
  };

  return InventarioTienda;
};
