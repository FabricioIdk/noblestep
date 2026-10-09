 

module.exports = (sequelize, DataTypes) => {
  const Direccion = sequelize.define('Direccion', {
    calle: { type: DataTypes.STRING(150), allowNull: false },
    distrito: { type: DataTypes.STRING(80), allowNull: false },
    ciudad: { type: DataTypes.STRING(80), allowNull: false },
    referencia: { type: DataTypes.STRING(150) },  
    predeterminada: { type: DataTypes.BOOLEAN, defaultValue: false },

  }, {
    tableName: 'direcciones',
  });

  Direccion.associate = (models) => {

    Direccion.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: false } });

    Direccion.hasMany(models.Pedido, { foreignKey: { name: 'direccion_id', allowNull: false } });
  };

  return Direccion;
};
