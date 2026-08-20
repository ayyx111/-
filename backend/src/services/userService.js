/**
 * 用户服务
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Review } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const authService = require('./authService');
const validator = require('../utils/validator');

/**
 * 获取个人资料(含统计)
 */
async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);
  return authService.sanitizeUser(user);
}

/**
 * 更新资料(白名单字段)
 */
async function updateProfile(userId, data) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);

  const allowed = ['avatar', 'nickname', 'bio', 'school', 'college', 'enrollment_year', 'phone'];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) {
      // 手机号校验
      if (key === 'phone' && data[key] && !validator.isPhone(data[key])) {
        throw new ApiError('手机号格式不正确', 400);
      }
      update[key] = data[key];
    }
  }

  // 手机号唯一性
  if (update.phone) {
    const exists = await User.findOne({ where: { phone: update.phone } });
    if (exists && exists.id !== userId) throw new ApiError('手机号已被使用', 409);
  }

  await user.update(update);
  return authService.sanitizeUser(user);
}

/**
 * 修改密码
 */
async function changePassword(userId, { oldPassword, newPassword }) {
  if (!validator.isPassword(newPassword)) {
    throw new ApiError('新密码6-32位,需包含字母和数字', 400);
  }
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);
  const ok = await bcrypt.compare(oldPassword, user.password);
  if (!ok) throw new ApiError('原密码错误', 400);
  const hashed = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hashed });
  return true;
}

/**
 * 修改邮箱(需验证码校验)
 */
async function changeEmail(userId, newEmail, code) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);

  if (!validator.isEmail(newEmail)) throw new ApiError('邮箱格式不正确', 400);
  if (!validator.isVerifyCode(code)) throw new ApiError('验证码格式不正确', 400);

  // 检查新邮箱是否已被其他用户使用
  const exists = await User.findOne({ where: { email: newEmail } });
  if (exists && exists.id !== userId) {
    throw new ApiError('该邮箱已被注册', 409);
  }

  // 验证码校验(复用 authService 的 checkVerifyCode)
  await authService.checkVerifyCode(newEmail, code);

  await user.update({ email: newEmail });
  return authService.sanitizeUser(user);
}

/**
 * 获取用户公开信息(用于商品详情显示卖家)
 */
async function getPublicInfo(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'username', 'avatar', 'nickname', 'school', 'college', 'is_verified', 'credit_score', 'created_at']
  });
  return user;
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  changeEmail,
  getPublicInfo
};
