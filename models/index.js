 

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');  
const sequelize = require('../config/database');  

const db = {};  
const basename = path.basename(__filename);  

fs.readdirSync(__dirname)                               
  .filter((file) => file !== basename && file.endsWith('.js'))  
  .forEach((file) => {

    const modelDef = require(path.join(__dirname, file));
    const model = modelDef(sequelize, DataTypes);
    db[model.name] = model;  
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;  

module.exports = db;
