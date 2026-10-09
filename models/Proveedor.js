 

module.exports = (sequelize, DataTypes) => {
  const Proveedor = sequelize.define('Proveedor', {
    nombre: { type: DataTypes.STRING(120), allowNull: false },  
    ruc: { type: DataTypes.STRING(20), allowNull: false, unique: true },

    contacto: { type: DataTypes.STRING(100) },  
    telefono: { type: DataTypes.STRING(20) },
    email: { type: DataTypes.STRING(120) },
    direccion: { type: DataTypes.STRING(200) },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },

  }, {
    tableName: 'proveedores',
  });

  Proveedor.associate = (models) => {

    Proveedor.hasMany(models.OrdenCompra, { foreignKey: { name: 'proveedor_id', allowNull: false } });
  };

  return Proveedor;
};
