/**
 * 统一响应封装
 * 约定格式: { code, message, data, timestamp }
 */

class ResponseUtil {
  /**
   * 构造统一响应体
   * @param {number} code 业务状态码(200 成功)
   * @param {string} message 提示消息
   * @param {*} data 数据
   */
  static build(code, message, data = null) {
    return {
      code,
      message,
      data: data === null ? {} : data,
      timestamp: Date.now()
    };
  }

  /** 成功响应 */
  static success(res, data = null, message = '操作成功', code = 200) {
    return res.status(200).json(this.build(code, message, data));
  }

  /** 创建成功 */
  static created(res, data = null, message = '创建成功') {
    return res.status(201).json(this.build(201, message, data));
  }

  /** 分页响应 */
  static paginate(res, list, total, page, pageSize, message = '操作成功') {
    const totalPages = Math.ceil(total / pageSize) || (total > 0 ? 1 : 0);
    return res.status(200).json(this.build(200, message, {
      list,
      pagination: {
        page: Number(page),
        pageSize: Number(pageSize),
        total: Number(total),
        totalPages
      }
    }));
  }

  /** 失败响应(带HTTP状态码) */
  static fail(res, httpStatus, message, code = null) {
    return res.status(httpStatus).json(this.build(code || httpStatus, message, null));
  }

  // 常用快捷方法
  static badRequest(res, message = '请求参数错误') {
    return this.fail(res, 400, message, 400);
  }

  static unauthorized(res, message = '未登录或登录已过期') {
    return this.fail(res, 401, message, 401);
  }

  static forbidden(res, message = '没有操作权限') {
    return this.fail(res, 403, message, 403);
  }

  static notFound(res, message = '资源不存在') {
    return this.fail(res, 404, message, 404);
  }

  static conflict(res, message = '资源已存在') {
    return this.fail(res, 409, message, 409);
  }

  static tooMany(res, message = '请求过于频繁,请稍后再试') {
    return this.fail(res, 429, message, 429);
  }

  static serverError(res, message = '服务器内部错误') {
    return this.fail(res, 500, message, 500);
  }
}

module.exports = ResponseUtil;
