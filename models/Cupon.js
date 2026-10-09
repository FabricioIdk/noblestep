 

module.exports = (sequelize, DataTypes) => {
  const Cupon = sequelize.define('Cupon', {
    codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },

    tipo_descuento: { type: DataTypes.ENUM('porcentaje', 'monto_fijo'), allowNull: false },

    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    fecha_inicio: { type: DataTypes.DATEONLY, allowNull: false },
    fecha_fin: { type: DataTypes.DATEONLY, allowNull: false },

    activo: { type: DataTypes.BOOLEAN, defaultValue: true },

  }, {
    tableName: 'cupones',
  });

  Cupon.associate = (models) => {

    Cupon.hasMany(models.Pedido, { foreignKey: 'cupon_id' });
  };

  return Cupon;
};
