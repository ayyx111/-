/**
 * 文件上传中间件 (Multer)
 * - 单图上传 imageUpload
 * - 多图上传 imageUploadArray(用于商品发布)
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('../config');
const ResponseUtil = require('../utils/response');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../', config.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 存储配置:按年月分目录,文件名防冲突
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const subDir = path.join(uploadDir, `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, unique);
  }
});

// 文件过滤:仅允许图片
function fileFilter(req, file, cb) {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型,仅允许上传图片'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: 9
  }
});

/**
 * Multer 错误处理包装
 */
function handleMulterError(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        let message = '文件上传失败';
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = `文件大小超过限制(最大 ${Math.floor(config.upload.maxSize / 1024 / 1024)}MB)`;
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          message = '上传文件数量超过限制(最多9张)';
        } else if (err.message) {
          message = err.message;
        }
        return ResponseUtil.badRequest(res, message);
      }
      next();
    });
  };
}

// 单图上传字段名 file
const imageUpload = handleMulterError(upload.single('file'));
// 多图上传字段名 images,最多9张
const imageUploadArray = (maxCount = 9) => handleMulterError(upload.array('images', maxCount));

module.exports = { upload, imageUpload, imageUploadArray };
