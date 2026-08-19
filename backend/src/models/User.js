/**
 * 用户模型 User
 * 表名:users
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '用户名'
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密码(bcrypt加密)'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: '邮箱'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: '手机号'
  },
  student_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    field: 'student_id',
    comment: '学号'
  },
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '头像URL'
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '昵称'
  },
  bio: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '个性签名'
  },
  school: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '学校'
  },
  college: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '学院'
  },
  enrollment_year: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'enrollment_year',
    comment: '入学年份'
  },
  campus_proof: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'campus_proof',
    comment: '学生证照片URL'
  },
  role: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    comment: '角色:0用户 1管理员'
  },
  is_verified: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
    field: 'is_verified',
    comment: '认证:0未认证 1已认证 2待审核 3未通过'
  },
  credit_score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
    field: 'credit_score',
    comment: '信用分'
  },
  status: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 1,
    comment: '状态:0封禁 1正常'
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login_at',
    comment: '最后登录时间'
  }
}, {
  tableName: 'users',
  indexes: [
    { name: 'idx_users_status', fields: ['status'] }
  ]
});

module.exports = User;
