/**
 * 消息路由
 * 注意:静态路径(conversations)需在动态参数路径(:userId)之前定义
 */
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { auth } = require('../middleware/auth');

// 会话列表(静态路径优先)
router.get('/messages/conversations', auth, messageController.conversations);

// 发送消息
router.post('/messages', auth, messageController.send);

// 标记已读
router.put('/messages/read/:userId', auth, messageController.markRead);

// 聊天记录(动态参数放最后)
router.get('/messages/:userId', auth, messageController.history);

module.exports = router;
