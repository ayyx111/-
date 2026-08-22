/**
 * 上传文件 URL 工具函数
 * 统一处理 Cloudinary URL / 本地路径 → 可访问 URL 的转换
 */
const path = require('path');
const config = require('../config');

/**
 * 将上传文件路径转换为可访问 URL
 * @param {string|object} filePathOrFile - 文件绝对路径 或 multer file 对象
 * @returns {string} 完整 URL（Cloudinary）或相对路径/带域名的本地 URL
 *
 * 说明:
 * - Cloudinary storage 上传后,file.path 直接就是完整公网 URL(https://res.cloudinary.com/...)
 *   此时直接返回即可,不需要拼接 publicBaseUrl
 * - 本地 disk storage 上传后,file.path 是本地绝对路径,需要转成相对 URL
 *   若配了 publicBaseUrl 则拼接成完整公网 URL,否则返回相对路径
 */
function resolveUploadUrl(filePathOrFile) {
  // 入参是字符串(本地路径):走本地 URL 转换逻辑
  if (typeof filePathOrFile === 'string') {
    return _resolveLocalPath(filePathOrFile);
  }

  // 入参是 multer file 对象
  const file = filePathOrFile || {};

  // Cloudinary 上传:path 字段就是完整 URL(以 https:// 开头)
  if (file.path && /^https?:\/\//.test(file.path)) {
    return file.path;
  }
  // Cloudinary 上传:secure_url 字段(兜底)
  if (file.secure_url) {
    return file.secure_url;
  }

  // 本地上传:走本地路径转换
  return _resolveLocalPath(file.path || '');
}

/**
 * 本地路径 → 可访问 URL(原逻辑)
 */
function _resolveLocalPath(filePath) {
  if (!filePath) return '';
  const relativePath = path
    .relative(path.join(__dirname, '../../'), filePath)
    .replace(/\\/g, '/');
  const relativeUrl = `/${relativePath}`;

  if (config.upload.publicBaseUrl) {
    // 清理 baseUrl:去掉反引号、空格、首尾斜杠
    const base = config.upload.publicBaseUrl
      .replace(/[`\s]/g, '')
      .replace(/\/$/, '');
    return `${base}${relativeUrl}`;
  }

  return relativeUrl;
}

module.exports = { resolveUploadUrl };
