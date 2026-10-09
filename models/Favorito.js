 

module.exports = (sequelize, DataTypes) => {
  const Favorito = sequelize.define('Favorito', {

  }, {
    tableName: 'favoritos',
    indexes: [{ unique: true, fields: ['usuario_id', 'producto_id'] }],

  });

  Favorito.associate = (models) => {
    Favorito.belongsTo(models.Usuario, { foreignKey: { name: 'usuario_id', allowNull: false } });
    Favorito.belongsTo(models.Producto, { foreignKey: { name: 'producto_id', allowNull: false } });
  };

  return Favorito;
};
