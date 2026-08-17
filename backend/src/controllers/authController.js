/**
 * 认证控制器
 */
const authService = require('../services/authService');
const ResponseUtil = require('../utils/response');

/** 发送验证码 */
exports.sendCode = async (req, res, next) => {
  try {
    const account = req.body.target || req.body.account;
    const result = await authService.sendCode(account);
    ResponseUtil.success(res, result, '验证码已发送');
  } catch (err) { next(err); }
};

/** 注册 */
exports.register = async (req, res, next) => {
  try {
    const { username, password, email, studentId, code } = req.body;
    const user = await authService.register({ username, password, email, studentId, code });
    ResponseUtil.created(res, user, '注册成功');
  } catch (err) { next(err); }
};

/** 登录 */
exports.login = async (req, res, next) => {
  try {
    const { account, password } = req.body;
    const result = await authService.login(account, password);
    ResponseUtil.success(res, result, '登录成功');
  } catch (err) { next(err); }
};

/** 刷新Token */
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    ResponseUtil.success(res, result, '刷新成功');
  } catch (err) { next(err); }
};

/** 退出登录 */
exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const userId = req.user ? req.user.id : null;
    await authService.logout(accessToken, userId);
    ResponseUtil.success(res, null, '已退出登录');
  } catch (err) { next(err); }
};

/** 重置密码 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { account, code, newPassword } = req.body;
    await authService.resetPassword({ account, code, newPassword });
    ResponseUtil.success(res, null, '密码重置成功');
  } catch (err) { next(err); }
};

/** 校园认证 */
exports.verifyCampus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await authService.verifyCampus(userId, req.body);
    ResponseUtil.success(res, result, '认证申请已提交,等待审核');
  } catch (err) { next(err); }
};
