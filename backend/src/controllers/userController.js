/**
 * 用户控制器
 */
const userService = require('../services/userService');
const ResponseUtil = require('../utils/response');

/** 获取个人信息 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getProfile(req.user.id);
    ResponseUtil.success(res, user);
  } catch (err) { next(err); }
};

/** 更新资料 */
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.id, req.body);
    ResponseUtil.success(res, user, '资料更新成功');
  } catch (err) { next(err); }
};

/** 修改密码 */
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, { oldPassword, newPassword });
    ResponseUtil.success(res, null, '密码修改成功');
  } catch (err) { next(err); }
};
