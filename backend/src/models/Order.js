/**
 * 订单模型 Order
 * 表名:orders
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('orders', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  order_no: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    field: 'order_no',
    comment: '订单编号'
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'product_id',
    comment: '商品ID'
  },
  buyer_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'buyer_id',
    comment: '买家ID'
  },
  seller_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'seller_id',
    comment: '卖家ID'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '成交价格'
  },
  trade_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'trade_type',
    comment: '交易方式:1面交 2邮寄 3均可'
  },
  remark: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: '买家备注'
  },
  product_title: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'product_title',
    comment: '商品标题(冗余字段)'
  },
  status: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    comment: '状态:0待确认 1待交易 2交易中 3已完成 4已取消'
  },
  buyer_confirmed: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'buyer_confirmed',
    comment: '买家确认:0否 1是'
  },
  seller_confirmed: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'seller_confirmed',
    comment: '卖家确认:0否 1是'
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'confirmed_at',
    comment: '交易完成时间'
  },
  canceled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'canceled_at',
    comment: '取消时间'
  },
  cancel_reason: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'cancel_reason',
    comment: '取消原因'
  }
}, {
  tableName: 'orders',
  indexes: [
    { name: 'idx_orders_product_id', fields: ['product_id'] },
    { name: 'idx_orders_buyer_id', fields: ['buyer_id'] },
    { name: 'idx_orders_seller_id', fields: ['seller_id'] },
    { name: 'idx_orders_status', fields: ['status'] }
  ]
});

module.exports = Order;
