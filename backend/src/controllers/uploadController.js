/**
 * 文件上传控制器
 */
const config = require('../config');
const ResponseUtil = require('../utils/response');
const { resolveUploadUrl } = require('../utils/uploadUrl');

/** 上传单张图片 */
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return ResponseUtil.badRequest(res, '请选择要上传的图片');
    }
    const url = resolveUploadUrl(req.file);
    ResponseUtil.success(res, {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, '上传成功');
  } catch (err) { next(err); }
};

/** 上传多张图片（商品发布时直接使用） */
exports.uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return ResponseUtil.badRequest(res, '请选择要上传的图片');
    }
    const urls = req.files.map(file => resolveUploadUrl(file));
    ResponseUtil.success(res, {
      urls,
      count: urls.length
    }, '上传成功');
  } catch (err) { next(err); }
};

module.exports = exports;
