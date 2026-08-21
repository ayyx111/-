/**
 * 学校修改申请模型
 * 用户修改学校/学院时需提交申请,管理员审核通过后才能生效
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SchoolChangeRequest = sequelize.define('SchoolChangeRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '申请人ID'
  },
  old_school: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '原学校'
  },
  old_college: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '原学院'
  },
  new_school: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '新学校'
  },
  new_college: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '新学院'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '修改原因'
  },
  status: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    comment: '0待审核 1已通过 2已拒绝'
  },
  reviewer_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '审核人ID'
  },
  review_note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '审核备注'
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '审核时间'
  }
}, {
  tableName: 'school_change_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SchoolChangeRequest;
