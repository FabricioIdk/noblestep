 

module.exports = (sequelize, DataTypes) => {
  const Tienda = sequelize.define('Tienda', {
    nombre: { type: DataTypes.STRING(100), allowNull: false },

    tipo: { type: DataTypes.ENUM('fisica', 'almacen_online'), allowNull: false, defaultValue: 'fisica' },

    direccion: { type: DataTypes.STRING(200) },
    distrito: { type: DataTypes.STRING(80) },
    ciudad: { type: DataTypes.STRING(80) },
    telefono: { type: DataTypes.STRING(20) },

    activo: { type: DataTypes.BOOLEAN, defaultValue: true },

  }, {
    tableName: 'tiendas',
  });

  Tienda.associate = (models) => {

    Tienda.hasMany(models.InventarioTienda, { foreignKey: { name: 'tienda_id', allowNull: false } });

    Tienda.hasMany(models.MovimientoInventario, { foreignKey: { name: 'tienda_id', allowNull: false } });

    Tienda.hasMany(models.OrdenCompra, { foreignKey: { name: 'tienda_destino_id', allowNull: false } });

    Tienda.hasMany(models.Pedido, { foreignKey: { name: 'tienda_id', allowNull: false } });
  };

  return Tienda;
};
