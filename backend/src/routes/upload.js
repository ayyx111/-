/**
 * 文件上传路由
 */
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { auth } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');

router.post('/upload/image', auth, imageUpload, uploadController.uploadImage);

module.exports = router;
