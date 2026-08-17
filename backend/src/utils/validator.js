/**
 * 通用校验工具
 */
const crypto = require('crypto');
const validator = require('validator');

/**
 * 校验用户名(4-20位,字母/数字/下划线)
 */
function isUsername(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9_]{4,20}$/.test(v);
}

/**
 * 校验密码(6-32位,至少包含字母和数字)
 */
function isPassword(v) {
  return typeof v === 'string' && /^(?=.*[A-Za-z])(?=.*\d)[\S]{6,32}$/.test(v);
}

/**
 * 校验邮箱
 */
function isEmail(v) {
  return typeof v === 'string' && validator.isEmail(v) && v.length <= 100;
}

/**
 * 校验手机号(中国大陆)
 */
function isPhone(v) {
  return typeof v === 'string' && /^1[3-9]\d{9}$/.test(v);
}

/**
 * 校验学号(4-20位字母数字)
 */
function isStudentId(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9]{4,20}$/.test(v);
}

/**
 * 校验验证码(6位数字)
 */
function isVerifyCode(v) {
  return typeof v === 'string' && /^\d{6}$/.test(v);
}

/**
 * 校验金额(>0,最多两位小数)
 */
function isPrice(v) {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return !Number.isNaN(n) && n > 0 && /^\d+(\.\d{1,2})?$/.test(String(v));
}

/**
 * 校验ID为正整数
 */
function isPositiveId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

/**
 * 生成随机数字验证码
 */
function genVerifyCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

/**
 * 生成本地随机字符串
 */
function randomString(len = 16) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

/**
 * 解析分页参数,返回 { page, pageSize, offset }
 */
function parsePaging(req) {
  let page = parseInt(req.query.page, 10);
  let pageSize = parseInt(req.query.pageSize, 10);
  if (!page || page < 1) page = 1;
  if (!pageSize || pageSize < 1) pageSize = 10;
  if (pageSize > 50) pageSize = 50; // 防止超大分页
  return { page, pageSize, offset: (page - 1) * pageSize };
}

module.exports = {
  isUsername,
  isPassword,
  isEmail,
  isPhone,
  isStudentId,
  isVerifyCode,
  isPrice,
  isPositiveId,
  genVerifyCode,
  randomString,
  parsePaging
};
