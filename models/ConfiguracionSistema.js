 

module.exports = (sequelize, DataTypes) => {
  const ConfiguracionSistema = sequelize.define('ConfiguracionSistema', {
    clave: { type: DataTypes.STRING(60), allowNull: false, unique: true },

    valor: { type: DataTypes.STRING(255), allowNull: false },

  }, {
    tableName: 'configuracion_sistema',
  });

  return ConfiguracionSistema;
};
