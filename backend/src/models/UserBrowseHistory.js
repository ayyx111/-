/**
 * 浏览记录模型 UserBrowseHistory
 * 表名:user_browse_history
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserBrowseHistory = sequelize.define('user_browse_history', {
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
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'category_id',
    comment: '商品分类(冗余,加速推荐)'
  }
}, {
  tableName: 'user_browse_history',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: 'idx_history_user_id', fields: ['user_id'] },
    { name: 'idx_history_user_category', fields: ['user_id', 'category_id'] }
  ]
});

module.exports = UserBrowseHistory;
