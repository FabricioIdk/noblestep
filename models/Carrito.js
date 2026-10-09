 

module.exports = (sequelize, DataTypes) => {
  const Carrito = sequelize.define('Carrito', {
    estado: { type: DataTypes.ENUM('activo', 'convertido', 'abandonado'), defaultValue: 'activo' },

  }, {
    tableName: 'carritos',
  });

  Carrito.associate = (models) => {
    Carrito.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: false } });
    Carrito.hasMany(models.DetalleCarrito, { foreignKey: { name: 'carrito_id', allowNull: false } });
  };

  return Carrito;
};
