/**
 * 举报模型 Report
 * 表名:reports
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Report = sequelize.define('reports', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  reporter_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'reporter_id',
    comment: '举报人ID'
  },
  target_type: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    field: 'target_type',
    comment: '目标类型:1商品 2用户'
  },
  target_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'target_id',
    comment: '目标ID'
  },
  reason: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '举报原因'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '详细描述'
  },
  status: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    comment: '状态:0待处理 1已处理 2已驳回'
  },
  handle_result: {
    type: DataTypes.STRING(200),
    allowNull: true,
    field: 'handle_result',
    comment: '处理结果'
  },
  handler_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'handler_id',
    comment: '处理人(管理员)ID'
  },
  handled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'handled_at',
    comment: '处理时间'
  }
}, {
  tableName: 'reports',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { name: 'idx_reporter_id', fields: ['reporter_id'] },
    { name: 'idx_target', fields: ['target_type', 'target_id'] },
    { name: 'idx_reports_status', fields: ['status'] }
  ]
});

module.exports = Report;
