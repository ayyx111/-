/**
 * 上传文件 URL 工具函数
 * 统一处理相对路径 → 公网 URL 的转换
 */
const path = require('path');
const config = require('../config');

/**
 * 将上传文件路径转换为可访问 URL
 * @param {string|object} filePathOrFile - 文件绝对路径 或 multer file 对象
 * @returns {string} 相对路径或带公网域名的完整 URL
 */
function resolveUploadUrl(filePathOrFile) {
  const filePath = typeof filePathOrFile === 'string' ? filePathOrFile : (filePathOrFile?.path || '');
  const relativePath = path
    .relative(path.join(__dirname, '../../'), filePath)
    .replace(/\\/g, '/');
  const relativeUrl = `/${relativePath}`;

  if (config.upload.publicBaseUrl) {
    const base = config.upload.publicBaseUrl.replace(/\/$/, '');
    return `${base}${relativeUrl}`;
  }

  return relativeUrl;
}

module.exports = { resolveUploadUrl };
