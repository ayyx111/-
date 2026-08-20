/**
 * 文件上传中间件 (Multer)
 * - 单图上传 imageUpload
 * - 多图上传 imageUploadArray(用于商品发布)
 *
 * 存储策略(自动选择):
 * 1. 配置了 CLOUDINARY_UPLOAD_PRESET 时,使用 Cloudinary 无签名上传(永久保存)
 *    通过 axios 直接调 Cloudinary REST API,不依赖 cloudinary SDK
 * 2. 未配置 Cloudinary Preset 时,回退到本地磁盘存储
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const config = require('../config');
const ResponseUtil = require('../utils/response');

// ============ Cloudinary 无签名上传 Storage ============
class CloudinaryUnsignedStorage {
  constructor(options) {
    this.cloudName = options.cloudName;
    this.uploadPreset = options.uploadPreset;
    this.folder = options.folder || '';
    this.allowedFormats = options.allowedFormats || ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  }

  _handleFile(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!this.allowedFormats.includes(ext)) {
      return cb(new Error(`不支持的图片格式: ${ext},仅允许: ${this.allowedFormats.join(', ')}`));
    }

    // multer 传的是 stream,需要先读成 buffer
    const chunks = [];
    file.stream.on('data', chunk => chunks.push(chunk));
    file.stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      const dataUri = `data:${file.mimetype};base64,${base64}`;

      const params = {
        file: dataUri,
        upload_preset: this.uploadPreset,
        folder: this.folder
      };

      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;

      axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxContentLength: 10 * 1024 * 1024,
        timeout: 30000
      }).then(response => {
        const r = response.data;
        cb(null, {
          path: r.secure_url || r.url,
          filename: r.public_id,
          secure_url: r.secure_url,
          public_id: r.public_id,
          format: r.format,
          size: r.bytes,
          mimetype: file.mimetype,
          originalname: file.originalname,
          fieldname: file.fieldname,
          encoding: file.encoding,
          destination: 'cloudinary',
          buffer: buffer
        });
      }).catch(err => {
        const msg = err.response
          ? `Cloudinary 上传失败 (${err.response.status}): ${JSON.stringify(err.response.data).substring(0, 200)}`
          : `Cloudinary 上传失败: ${err.message}`;
        cb(new Error(msg));
      });
    });
    file.stream.on('error', (err) => cb(err));
  }

  _removeFile(req, file, cb) {
    // Cloudinary 文件删除需要签名,这里不处理(允许孤儿文件存在)
    cb(null);
  }
}

// ============ 初始化存储 ============
const cloudName = config.cloudinary.cloudName;
const uploadPreset = config.cloudinary.uploadPreset;
const hasCloudinary = !!(cloudName && uploadPreset);

let storage;
if (hasCloudinary) {
  storage = new CloudinaryUnsignedStorage({
    cloudName: cloudName,
    uploadPreset: uploadPreset,
    folder: config.cloudinary.folder,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
  });
  console.log(`[UPLOAD] 使用 Cloudinary 无签名上传 (cloud: ${cloudName}, preset: ${uploadPreset}, folder: ${config.cloudinary.folder})`);
} else {
  console.log('[UPLOAD] 未配置 Cloudinary Preset,使用本地磁盘存储(仅适合开发)');
  const uploadDir = path.join(__dirname, '../../', config.upload.dir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  storage = multer.diskStorage({
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
}

// ============ 创建 multer 实例 ============
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

const useCloudinary = hasCloudinary;
const imageUpload = handleMulterError(upload.single('file'));
const imageUploadArray = (maxCount = 9) => handleMulterError(upload.array('images', maxCount));

module.exports = { upload, imageUpload, imageUploadArray, useCloudinary };
