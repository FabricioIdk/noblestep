 

module.exports = (sequelize, DataTypes) => {

  const Usuario = sequelize.define('Usuario', {

    nombre: { type: DataTypes.STRING(80), allowNull: false },

    apellido: { type: DataTypes.STRING(80), allowNull: false },

    email: { type: DataTypes.STRING(120), allowNull: false, unique: true },

    password: { type: DataTypes.STRING(255), allowNull: false },

    telefono: { type: DataTypes.STRING(20) },

    rol: { type: DataTypes.ENUM('cliente', 'administrador'), defaultValue: 'cliente' },

    reset_token: { type: DataTypes.STRING(120) },
    reset_token_expira: { type: DataTypes.DATE },

  }, {
    tableName: 'usuarios',  
  });

  Usuario.associate = (models) => {

    Usuario.hasMany(models.Direccion, { foreignKey: { name: 'usuario_id', allowNull: false } });

    Usuario.hasMany(models.Carrito, { foreignKey: { name: 'usuario_id', allowNull: false } });
    Usuario.hasMany(models.Pedido, { foreignKey: { name: 'usuario_id', allowNull: false } });
    Usuario.hasMany(models.Notificacion, { foreignKey: { name: 'usuario_id', allowNull: false } });

    Usuario.hasMany(models.Auditoria, { foreignKey: { name: 'usuario_id', allowNull: true } });
    Usuario.hasMany(models.Favorito, { foreignKey: { name: 'usuario_id', allowNull: false } });
  };

  return Usuario;  
};
