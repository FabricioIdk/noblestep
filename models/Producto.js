 

module.exports = (sequelize, DataTypes) => {
  const Producto = sequelize.define('Producto', {
    nombre: { type: DataTypes.STRING(120), allowNull: false },
    descripcion: { type: DataTypes.TEXT },

    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    precio_oferta: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

    marca: { type: DataTypes.STRING(60) },

    genero: {
      type: DataTypes.ENUM('hombre', 'mujer', 'unisex', 'nino'),
      allowNull: false,
      defaultValue: 'unisex',
    },

    imagen_principal: { type: DataTypes.STRING(255) },

    activo: { type: DataTypes.BOOLEAN, defaultValue: true },

  }, {
    tableName: 'productos',
  });

  Producto.associate = (models) => {

    Producto.belongsTo(models.Categoria, {
      foreignKey: { name: 'categoria_id', allowNull: false },
      as: 'categoria',

    });

    Producto.hasMany(models.VarianteProducto, {
      foreignKey: { name: 'producto_id', allowNull: false },
      as: 'variantes',

    });

    Producto.hasMany(models.ImagenProducto, {
      foreignKey: { name: 'producto_id', allowNull: false },
      as: 'galeria',
    });

    Producto.hasMany(models.Favorito, { foreignKey: { name: 'producto_id', allowNull: false } });
  };

  return Producto;
};
