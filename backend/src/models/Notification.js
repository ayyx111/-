/**
 * 通知模型 Notification
 * 表名:notifications
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('notifications', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'user_id',
    comment: '接收用户ID'
  },
  type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    comment: '类型:1订单 2审核 3评价 4系统 5聊天'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '通知标题'
  },
  content: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: '通知内容'
  },
  related_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'related_id',
    comment: '关联业务ID'
  },
  is_read: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'is_read',
    comment: '已读:0否 1是'
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: 'idx_notifications_user_read', fields: ['user_id', 'is_read'] }
  ]
});

module.exports = Notification;
