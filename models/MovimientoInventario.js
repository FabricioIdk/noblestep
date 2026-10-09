 

module.exports = (sequelize, DataTypes) => {
  const MovimientoInventario = sequelize.define('MovimientoInventario', {
    tipo: { type: DataTypes.ENUM('entrada', 'salida', 'ajuste'), allowNull: false },

    cantidad: { type: DataTypes.INTEGER, allowNull: false },

    motivo: { type: DataTypes.STRING(200) },

    referencia: { type: DataTypes.STRING(100) },

    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'movimientos_inventario',
  });

  MovimientoInventario.associate = (models) => {
    MovimientoInventario.belongsTo(models.VarianteProducto, { foreignKey: { name: 'variante_id', allowNull: false } });
    MovimientoInventario.belongsTo(models.Tienda, { foreignKey: { name: 'tienda_id', allowNull: false } });

  };

  return MovimientoInventario;
};
