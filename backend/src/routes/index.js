/**
 * 路由聚合
 * 挂载到 /api/v1 下
 */
const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/user', require('./user'));
// AI 服务转发(必须放在 admin 之前:admin 路由挂在 '/' 上且带全局鉴权)
router.use('/ai', require('./ai'));
// 商品相关:products / categories / user/products
router.use('/', require('./product'));
router.use('/orders', require('./order'));
router.use('/', require('./message')); // /messages, /messages/conversations
router.use('/', require('./favorite')); // /favorites
router.use('/', require('./notification')); // /notifications
router.use('/reports', require('./report'));
// 文件上传:必须在 admin 之前——admin 挂在 '/' 且带全局 requireAdmin,
// 放在后面会导致非管理员调用 /upload/image 被 403 拦截(学生无法传图、无法发商品)
router.use('/upload', require('./upload'));
router.use('/', require('./admin')); // /admin/*

module.exports = router;
