/**
 * 通知路由
 * 注意:静态路径(read-all, unread-count)需在动态参数路径(:id)之前定义
 */
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

// 全部已读
router.put('/notifications/read-all', auth, notificationController.markAllRead);

// 未读数量
router.get('/notifications/unread-count', auth, notificationController.unreadCount);

// 通知列表
router.get('/notifications', auth, notificationController.list);

// 标记单条已读
router.put('/notifications/:id/read', auth, notificationController.markRead);

module.exports = router;
