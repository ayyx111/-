/**
 * 用户服务
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Review, Product, Order } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const authService = require('./authService');
const validator = require('../utils/validator');

/**
 * 获取个人资料(含统计:发布数、已售数)
 */
async function getProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);

  // 统计发布商品数(排除审核中/拒绝的)
  const productCount = await Product.count({
    where: { user_id: userId, status: { [Op.in]: [1, 2, 3, 4] } }
  });

  // 统计已售数(卖家订单状态=3已完成)
  const soldCount = await Order.count({
    where: { seller_id: userId, status: 3 }
  });

  const profile = authService.sanitizeUser(user);
  profile.productCount = productCount;
  profile.soldCount = soldCount;
  return profile;
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
 * 安全策略:验证码发送到旧邮箱(当前绑定邮箱),验证身份后才能修改
 */
async function changeEmail(userId, newEmail, code) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);
  if (!user.email) throw new ApiError('当前账号未绑定邮箱,无法修改', 400);

  if (!validator.isEmail(newEmail)) throw new ApiError('邮箱格式不正确', 400);
  if (!validator.isVerifyCode(code)) throw new ApiError('验证码格式不正确', 400);

  // 不能设置与旧邮箱相同的新邮箱
  if (user.email === newEmail) {
    throw new ApiError('新邮箱不能与旧邮箱相同', 400);
  }

  // 检查新邮箱是否已被其他用户使用
  const exists = await User.findOne({ where: { email: newEmail } });
  if (exists && exists.id !== userId) {
    throw new ApiError('该邮箱已被注册', 409);
  }

  // 验证码校验:向旧邮箱(当前邮箱)发送验证码,验证用户身份
  await authService.checkVerifyCode(user.email, code);

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

/**
 * 获取用户公开主页(头像点击后:历史发布商品 + 收到的评价 + 个性签名)
 */
async function getPublicProfile(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'username', 'avatar', 'nickname', 'bio', 'school', 'college', 'enrollment_year', 'is_verified', 'credit_score', 'created_at']
  });
  if (!user) throw new ApiError('用户不存在', 404);

  // 该用户在售商品(status=1)
  const products = await Product.findAll({
    where: { user_id: userId, status: 1 },
    include: [{ model: ProductImage, as: 'images', limit: 1 }],
    order: [['created_at', 'DESC']],
    limit: 20
  });

  // 收到的评价(含评价人信息)
  const reviews = await Review.findAll({
    where: { to_user_id: userId },
    include: [{
      model: User,
      as: 'reviewer',
      attributes: ['id', 'username', 'avatar', 'nickname']
    }],
    order: [['created_at', 'DESC']],
    limit: 20
  });

  // 统计
  const productCount = await Product.count({
    where: { user_id: userId, status: { [Op.in]: [1, 2, 3, 4] } }
  });
  const soldCount = await Order.count({
    where: { seller_id: userId, status: 3 }
  });

  const data = user.toJSON();
  data.productCount = productCount;
  data.soldCount = soldCount;
  data.products = products.map(p => {
    const obj = p.toJSON();
    obj.images = (obj.images || []).map(img => img.image_url || img.image_url);
    return obj;
  });
  data.reviews = reviews.map(r => {
    const obj = r.toJSON();
    if (obj.reviewer) {
      obj.reviewer.avatar = obj.reviewer.avatar;
    }
    return obj;
  });

  return data;
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  changeEmail,
  getPublicInfo,
  getPublicProfile
};
