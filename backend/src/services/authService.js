/**
 * 认证服务
 * 注册/登录/验证码/刷新/登出/重置密码/校园认证
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const jwtUtil = require('../utils/jwt');
const { redis, redisKeys } = require('../config/cache');
const validator = require('../utils/validator');
const config = require('../config');

const VERIFY_CODE_TTL = 300; // 验证码有效期 5 分钟

/**
 * 构造不含敏感字段的用户信息
 */
function sanitizeUser(user) {
  if (!user) return null;
  const v = user.toJSON ? user.toJSON() : user;
  return {
    id: v.id,
    username: v.username,
    email: v.email,
    phone: v.phone,
    student_id: v.student_id,
    avatar: v.avatar,
    nickname: v.nickname,
    bio: v.bio,
    school: v.school,
    college: v.college,
    enrollment_year: v.enrollment_year,
    role: v.role,
    is_verified: v.is_verified,
    credit_score: v.credit_score,
    status: v.status,
    last_login_at: v.last_login_at,
    created_at: v.created_at
  };
}

/**
 * 发送验证码(写入Redis,模拟发送)
 * @param {string} account 邮箱或手机号
 */
async function sendCode(account) {
  if (!account) throw new ApiError('邮箱或手机号不能为空', 400);
  const isEmail = validator.isEmail(account);
  const isPhone = validator.isPhone(account);
  if (!isEmail && !isPhone) {
    throw new ApiError('请输入正确的邮箱或手机号', 400);
  }
  const code = validator.genVerifyCode(6);
  await redis.set(redisKeys.verifyCode(account), code, 'EX', VERIFY_CODE_TTL);
  // 实际项目此处应调用短信/邮件服务商;此处仅记录日志
  console.log(`[验证码] 发送给 ${account}: ${code}`);
  return { sent: true, account, expireIn: VERIFY_CODE_TTL, code };
}

/**
 * 校验验证码
 */
async function checkVerifyCode(account, code) {
  const stored = await redis.get(redisKeys.verifyCode(account));
  if (!stored || stored !== code) {
    throw new ApiError('验证码错误或已过期', 400);
  }
  await redis.del(redisKeys.verifyCode(account));
  return true;
}

/**
 * 注册
 */
async function register({ username, password, email, studentId, code }) {
  // 基础校验
  if (!validator.isUsername(username)) throw new ApiError('用户名需4-20位字母/数字/下划线', 400);
  if (!validator.isPassword(password)) throw new ApiError('密码6-32位,需包含字母和数字', 400);
  if (!validator.isEmail(email)) throw new ApiError('邮箱格式不正确', 400);
  if (!validator.isStudentId(studentId)) throw new ApiError('学号格式不正确(4-20位字母数字)', 400);
  if (!validator.isVerifyCode(code)) throw new ApiError('验证码格式不正确', 400);

  // 验证码校验
  await checkVerifyCode(email, code);

  // 唯一性校验
  const exists = await User.findOne({
    where: {
      [Op.or]: [{ username }, { email }, { student_id: studentId }]
    }
  });
  if (exists) {
    if (exists.username === username) throw new ApiError('用户名已被注册', 409);
    if (exists.email === email) throw new ApiError('邮箱已被注册', 409);
    if (exists.student_id === studentId) throw new ApiError('学号已被注册', 409);
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    password: hashed,
    email,
    student_id: studentId,
    nickname: username,
    role: 0,
    status: 1
  });

  return sanitizeUser(user);
}

/**
 * 登录(返回双Token)
 * @param {string} account 用户名/邮箱/学号
 */
async function login(account, password) {
  if (!account || !password) throw new ApiError('账号或密码不能为空', 400);
  const user = await User.findOne({
    where: {
      [Op.or]: [{ username: account }, { email: account }, { student_id: account }]
    }
  });
  if (!user) throw new ApiError('账号或密码错误', 401);
  if (user.status === 0) throw new ApiError('账号已被封禁,请联系管理员', 403);

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError('账号或密码错误', 401);

  // 更新最后登录时间
  await user.update({ last_login_at: new Date() });

  const payload = { id: user.id, username: user.username, role: user.role };
  const accessToken = jwtUtil.signAccessToken(payload);
  const refreshToken = await jwtUtil.signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  };
}

/**
 * 刷新 Token
 */
async function refresh(refreshToken) {
  if (!refreshToken) throw new ApiError('缺少 refreshToken', 400);
  const payload = await jwtUtil.verifyRefreshToken(refreshToken);
  // 重新查库,确保账号状态最新
  const user = await User.findByPk(payload.id);
  if (!user || user.status === 0) throw new ApiError('账号不可用,请重新登录', 401);

  const newPayload = { id: user.id, username: user.username, role: user.role };
  const accessToken = jwtUtil.signAccessToken(newPayload);
  const newRefreshToken = await jwtUtil.signRefreshToken(newPayload);
  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * 登出(加入黑名单 + 清除RefreshToken)
 */
async function logout(accessToken, userId) {
  if (accessToken) {
    await jwtUtil.blacklistAccessToken(accessToken);
  }
  if (userId) {
    await jwtUtil.clearRefreshToken(userId);
  }
  return true;
}

/**
 * 重置密码
 */
async function resetPassword({ account, code, newPassword }) {
  if (!account) throw new ApiError('账号不能为空', 400);
  if (!validator.isVerifyCode(code)) throw new ApiError('验证码格式不正确', 400);
  if (!validator.isPassword(newPassword)) throw new ApiError('密码6-32位,需包含字母和数字', 400);

  await checkVerifyCode(account, code);

  const user = await User.findOne({
    where: {
      [Op.or]: [{ email: account }, { phone: account }, { username: account }]
    }
  });
  if (!user) throw new ApiError('账号不存在', 404);

  const hashed = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hashed });
  // 重置密码后清除已登录态
  await jwtUtil.clearRefreshToken(user.id);
  return true;
}

/**
 * 校园认证(填写学校/学院/入学年份即可,学生证照片可选)
 */
async function verifyCampus(userId, { studentIdImage, school, college, enrollmentYear, studentId }) {
  const user = await User.findByPk(userId);
  if (!user) throw new ApiError('用户不存在', 404);
  if (user.is_verified === 1) throw new ApiError('您已通过校园认证', 400);

  await user.update({
    school: school || user.school,
    college: college || user.college,
    enrollment_year: enrollmentYear || user.enrollment_year,
    student_id: studentId || user.student_id,
    is_verified: 2 // 待审核
  });
  return sanitizeUser(user);
}

module.exports = {
  sanitizeUser,
  sendCode,
  checkVerifyCode,
  register,
  login,
  refresh,
  logout,
  resetPassword,
  verifyCampus
};
