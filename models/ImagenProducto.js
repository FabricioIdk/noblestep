 

module.exports = (sequelize, DataTypes) => {
  const ImagenProducto = sequelize.define('ImagenProducto', {
    nombre_archivo: { type: DataTypes.STRING(255), allowNull: false },
    orden: { type: DataTypes.INTEGER, defaultValue: 0 },  
  }, {
    tableName: 'imagenes_producto',
  });

  ImagenProducto.associate = (models) => {
    ImagenProducto.belongsTo(models.Producto, { foreignKey: { name: 'producto_id', allowNull: false } });
  };

  return ImagenProducto;
};
