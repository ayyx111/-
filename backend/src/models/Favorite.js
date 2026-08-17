/**
 * 收藏模型 Favorite
 * 表名:favorites
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Favorite = sequelize.define('favorites', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'user_id',
    comment: '用户ID'
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'product_id',
    comment: '商品ID'
  }
}, {
  tableName: 'favorites',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: 'uk_user_product', unique: true, fields: ['user_id', 'product_id'] },
    { name: 'idx_favorites_user_id', fields: ['user_id'] }
  ]
});

module.exports = Favorite;
