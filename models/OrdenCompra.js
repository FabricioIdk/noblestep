 

module.exports = (sequelize, DataTypes) => {
  const OrdenCompra = sequelize.define('OrdenCompra', {
    numero: { type: DataTypes.STRING(20), allowNull: false, unique: true },

    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

    estado: { type: DataTypes.ENUM('pendiente', 'recibida', 'cancelada'), defaultValue: 'pendiente' },

    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

  }, {
    tableName: 'ordenes_compra',
  });

  OrdenCompra.associate = (models) => {
    OrdenCompra.belongsTo(models.Proveedor, { foreignKey: { name: 'proveedor_id', allowNull: false } });

    OrdenCompra.belongsTo(models.Tienda, { foreignKey: { name: 'tienda_destino_id', allowNull: false } });

    OrdenCompra.hasMany(models.DetalleOrdenCompra, { foreignKey: { name: 'orden_compra_id', allowNull: false } });
  };

  return OrdenCompra;
};
