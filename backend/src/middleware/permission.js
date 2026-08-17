/**
 * RBAC 权限中间件
 */
const ResponseUtil = require('../utils/response');

/**
 * 校验用户角色是否满足要求
 * @param  {...number} roles 允许的角色
 * 用法: router.get('/xxx', auth, requireRole(1), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return ResponseUtil.unauthorized(res);
    }
    if (!roles.includes(req.user.role)) {
      return ResponseUtil.forbidden(res, '权限不足');
    }
    next();
  };
}

/** 仅管理员 role=1 */
function requireAdmin(req, res, next) {
  return requireRole(1)(req, res, next);
}

/**
 * 资源归属校验工厂:传入当前用户与资源拥有者ID,判断是否为本人或管理员
 */
function isOwnerOrAdmin(ownerId, currentUser) {
  if (!currentUser) return false;
  return currentUser.role === 1 || Number(currentUser.id) === Number(ownerId);
}

module.exports = { requireRole, requireAdmin, isOwnerOrAdmin };
