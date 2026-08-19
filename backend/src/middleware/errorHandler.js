/**
 * 全局错误处理中间件
 */
const ResponseUtil = require('../utils/response');
const config = require('../config');

/**
 * 404 路由未找到
 */
function notFound(req, res, next) {
  return ResponseUtil.notFound(res, `接口不存在: ${req.method} ${req.originalUrl}`);
}

/**
 * 统一错误处理
 * 支持:Sequelize 错误、自定义 ApiError、参数错误等
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let httpStatus = 500;
  let message = '服务器内部错误';
  let code = 500;

  // 自定义业务错误
  if (err.name === 'ApiError') {
    httpStatus = err.status || 400;
    code = err.code || httpStatus;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    httpStatus = 400;
    code = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError' || err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    httpStatus = 401;
    code = 401;
    message = err.name === 'TokenExpiredError' ? '登录已过期,请重新登录' : '认证失败';
  } else if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    httpStatus = 400;
    code = 400;
    message = err.errors && err.errors[0] ? err.errors[0].message : '参数校验失败';
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    httpStatus = 400;
    code = 400;
    message = '关联数据不存在';
  } else if (err.statusCode) {
    httpStatus = err.statusCode;
    code = err.statusCode;
    message = err.message;
  } else if (err && err.message && /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(err.message)) {
    // SQLite 写锁冲突:底层重试用尽后给用户可读提示(不应 500 "服务器开小差")
    httpStatus = 409;
    code = 409;
    message = '系统繁忙,请稍后重试(若反复出现请稍后再操作)';
  } else {
    message = err.message || message;
  }

  // 开发环境输出完整错误堆栈
  if (config.env !== 'test') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);
  }

  return ResponseUtil.fail(res, httpStatus, message, code);
}

/**
 * 自定义 API 错误
 */
class ApiError extends Error {
  constructor(message, status = 400, code = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || status;
  }
}

module.exports = { notFound, errorHandler, ApiError };
