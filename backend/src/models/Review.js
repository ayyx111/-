/**
 * 评价模型 Review
 * 表名:reviews
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('reviews', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  order_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'order_id',
    comment: '订单ID'
  },
  from_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'from_user_id',
    comment: '评价人ID'
  },
  to_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'to_user_id',
    comment: '被评价人ID'
  },
  reviewer_role: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'reviewer_role',
    comment: '评价人角色:1买家 2卖家'
  },
  rating: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    validate: { min: 1, max: 5 },
    comment: '评分1-5'
  },
  content: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '评价内容'
  }
}, {
  tableName: 'reviews',
  timestamps: true,
  updatedAt: false,
  indexes: [
    // 一个订单,同一个人最多评价一次(买家评卖家/卖家评买家,互不冲突)
    { name: 'uq_reviews_order_user', unique: true, fields: ['order_id', 'from_user_id'] },
    { name: 'idx_reviews_from_user_id', fields: ['from_user_id'] },
    { name: 'idx_reviews_to_user_id', fields: ['to_user_id'] }
  ]
});

module.exports = Review;
