/**
 * 文件上传控制器
 */
const path = require('path');
const config = require('../config');
const ResponseUtil = require('../utils/response');

/**
 * 将上传文件转换为可访问URL
 */
function fileToUrl(req, file) {
  const relativePath = path.relative(path.join(__dirname, '../../'), file.path).replace(/\\/g, '/');
  // 拼接静态访问前缀:uploads/202608/xxx.jpg
  return `/${relativePath}`;
}

/** 上传单张图片 */
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return ResponseUtil.badRequest(res, '请选择要上传的图片');
    }
    const url = fileToUrl(req, req.file);
    ResponseUtil.success(res, {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, '上传成功');
  } catch (err) { next(err); }
};
