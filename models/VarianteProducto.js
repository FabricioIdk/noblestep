 

module.exports = (sequelize, DataTypes) => {
  const VarianteProducto = sequelize.define('VarianteProducto', {
    talla: { type: DataTypes.STRING(10), allowNull: false },

    color: { type: DataTypes.STRING(30), allowNull: false },

    sku: { type: DataTypes.STRING(40), allowNull: false, unique: true },

  }, {
    tableName: 'variantes_producto',
  });

  VarianteProducto.associate = (models) => {

    VarianteProducto.belongsTo(models.Producto, { foreignKey: { name: 'producto_id', allowNull: false } });

    VarianteProducto.hasMany(models.DetalleCarrito, { foreignKey: { name: 'variante_id', allowNull: false } });

    VarianteProducto.hasMany(models.DetallePedido, { foreignKey: { name: 'variante_id', allowNull: false } });

    VarianteProducto.hasMany(models.DetalleOrdenCompra, { foreignKey: { name: 'variante_id', allowNull: false } });

    VarianteProducto.hasMany(models.MovimientoInventario, { foreignKey: { name: 'variante_id', allowNull: false } });

    VarianteProducto.hasMany(models.InventarioTienda, { foreignKey: { name: 'variante_id', allowNull: false } });

    VarianteProducto.hasMany(models.SolicitudStock, { foreignKey: { name: 'variante_id', allowNull: false } });
  };

  return VarianteProducto;
};
