/**
 * 文件上传路由
 */
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { auth } = require('../middleware/auth');
const { imageUpload, imageUploadArray } = require('../middleware/upload');

router.post('/image', auth, imageUpload, uploadController.uploadImage);
router.post('/images', auth, imageUploadArray, uploadController.uploadImages);

module.exports = router;
