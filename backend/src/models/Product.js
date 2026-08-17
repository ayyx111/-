/**
 * 商品模型 Product
 * 表名:products
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('products', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'user_id',
    comment: '发布者ID'
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'category_id',
    comment: '分类ID'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品标题'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '商品描述'
  },
  original_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'original_price',
    comment: '原价'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '售价'
  },
  condition_level: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'condition_level',
    comment: '新旧:1全新 2几乎全新 3轻微使用 4有使用痕迹'
  },
  trade_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'trade_type',
    comment: '交易方式:1面交 2邮寄 3均可'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '交易地点'
  },
  view_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'view_count',
    comment: '浏览量'
  },
  favorite_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'favorite_count',
    comment: '收藏数'
  },
  status: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    comment: '状态:0待审核 1在售 2已锁定 3已售 4已下架 5审核拒绝'
  },
  ai_review_result: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    field: 'ai_review_result',
    comment: 'AI审核:0通过 1可疑 2违规'
  },
  ai_review_reason: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'ai_review_reason',
    comment: 'AI审核原因/说明'
  },
  ai_reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ai_reviewed_at',
    comment: 'AI审核时间'
  }
}, {
  tableName: 'products',
  indexes: [
    { name: 'idx_products_user_id', fields: ['user_id'] },
    { name: 'idx_products_category_id', fields: ['category_id'] },
    { name: 'idx_products_status', fields: ['status'] },
    { name: 'idx_products_created_at', fields: ['created_at'] },
    { name: 'idx_products_price', fields: ['price'] }
  ]
});

module.exports = Product;
