/**
 * 商品图片模型 ProductImage
 * 表名:product_images
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductImage = sequelize.define('product_images', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'product_id',
    comment: '商品ID'
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'image_url',
    comment: '图片URL'
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'sort_order',
    comment: '排序'
  }
}, {
  tableName: 'product_images',
  timestamps: true,
  updatedAt: false, // 图片表仅保留 created_at
  indexes: [
    { name: 'idx_product_images_product_id', fields: ['product_id'] }
  ]
});

module.exports = ProductImage;
