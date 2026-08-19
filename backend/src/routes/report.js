/**
 * 举报路由
 */
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

// 注意: index.js 挂在 '/reports'(router.use('/reports', require('./report'))),
// 所以这里子路由直接挂 '/',避免变成 /reports/reports(前端调用 /reports 会 404 "资源不存在")
router.post('/', auth, reportController.create);

module.exports = router;
