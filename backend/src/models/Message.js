/**
 * 消息模型 Message
 * 表名:messages
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('messages', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  from_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'from_user_id',
    comment: '发送者ID'
  },
  to_user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'to_user_id',
    comment: '接收者ID'
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'product_id',
    comment: '关联商品ID'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '消息内容'
  },
  msg_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'msg_type',
    comment: '类型:0文字 1图片'
  },
  is_read: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'is_read',
    comment: '已读:0否 1是'
  }
}, {
  tableName: 'messages',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: 'idx_messages_from_to', fields: ['from_user_id', 'to_user_id'] },
    { name: 'idx_messages_product_id', fields: ['product_id'] },
    { name: 'idx_messages_to_user_read', fields: ['to_user_id', 'is_read'] }
  ]
});

module.exports = Message;
