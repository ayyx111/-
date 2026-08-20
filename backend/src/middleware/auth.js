/**
 * JWT 认证中间件
 * - auth:       必须登录(含封禁检查)
 * - optional:   可选登录(登录则注入用户,未登录忽略)
 */
const ResponseUtil = require('../utils/response');
const jwtUtil = require('../utils/jwt');
const { User } = require('../models');

/**
 * 从请求头获取 Token
 */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  // 兼容 query 传参(WebSocket 场景)
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

/**
 * 解析并挂载用户信息到 req.user
 */
async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  try {
    // 黑名单校验
    if (await jwtUtil.isBlacklisted(token)) return null;
    const payload = jwtUtil.verifyAccessToken(token);
    if (payload.type !== 'access') return null;
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      jti: payload.jti
    };
  } catch (e) {
    return null;
  }
}

/** 必须登录(含封禁检查) */
async function auth(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    return ResponseUtil.unauthorized(res);
  }
  // 封禁检查:实时查询用户状态,已封禁则立即拒绝
  const dbUser = await User.findByPk(user.id, { attributes: ['status'] });
  if (!dbUser) {
    return ResponseUtil.unauthorized(res);
  }
  if (dbUser.status === 0) {
    return ResponseUtil.forbidden(res, '账号已被封禁,请联系管理员');
  }
  req.user = user;
  next();
}

/** 可选登录 */
async function optionalAuth(req, res, next) {
  const user = await resolveUser(req);
  if (user) req.user = user;
  next();
}

module.exports = { auth, optionalAuth, extractToken, resolveUser };
