/**
 * 管理员操作日志模型 AdminLog
 * 表名:admin_logs
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminLog = sequelize.define('admin_logs', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  admin_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'admin_id',
    comment: '管理员ID'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '操作类型'
  },
  target_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'target_type',
    comment: '目标类型'
  },
  target_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'target_id',
    comment: '目标ID'
  },
  detail: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '操作详情'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
    comment: '操作IP'
  }
}, {
  tableName: 'admin_logs',
  timestamps: true,
  updatedAt: false
});

module.exports = AdminLog;
