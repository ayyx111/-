/**
 * 认证路由
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const config = require('../config');

// 登录限流:每分钟 N 次
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.loginMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '登录尝试过于频繁,请1分钟后再试', data: {}, timestamp: Date.now() }
});

// 发送验证码限流:每分钟 3 次
const codeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '验证码发送过于频繁,请稍后再试', data: {}, timestamp: Date.now() }
});

router.post('/send-code', codeLimiter, authController.sendCode);
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-campus', auth, authController.verifyCampus);

module.exports = router;
