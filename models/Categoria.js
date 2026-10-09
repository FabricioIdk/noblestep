 

module.exports = (sequelize, DataTypes) => {
  const Categoria = sequelize.define('Categoria', {
    nombre: { type: DataTypes.STRING(60), allowNull: false },
    descripcion: { type: DataTypes.STRING(200) },
    slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },

  }, {
    tableName: 'categorias',
  });

  Categoria.associate = (models) => {

    Categoria.hasMany(models.Producto, { foreignKey: { name: 'categoria_id', allowNull: false }, as: 'productos' });
  };

  return Categoria;
};
