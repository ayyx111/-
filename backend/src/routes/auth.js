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

// 调试接口:测试邮件发送(仅开发用)
router.get('/debug-email', async (req, res) => {
  const { debugEmail } = require('../utils/mailer');
  const target = req.query.target || '3194735981@qq.com';
  try {
    const results = await debugEmail(target);
    res.json({ code: 200, data: results });
  } catch (err) {
    res.json({ code: 500, error: err.message });
  }
});

// 调试接口:测试 SMTP 端口连通性
router.get('/debug-smtp', async (req, res) => {
  const net = require('net');
  const targets = [
    { name: 'QQ 465', host: 'smtp.qq.com', port: 465 },
    { name: 'QQ 587', host: 'smtp.qq.com', port: 587 },
    { name: 'Outlook 587', host: 'smtp.office365.com', port: 587 },
    { name: 'Gmail 465', host: 'smtp.gmail.com', port: 465 },
    { name: 'Gmail 587', host: 'smtp.gmail.com', port: 587 },
    { name: '163 465', host: 'smtp.163.com', port: 465 }
  ];
  const results = {};
  await Promise.all(targets.map(t => {
    return new Promise(resolve => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        results[t.name] = 'TIMEOUT';
        resolve();
      }, 8000);
      socket.connect(t.port, t.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        results[t.name] = 'OK';
        resolve();
      });
      socket.on('error', (err) => {
        clearTimeout(timeout);
        results[t.name] = err.code || err.message;
        resolve();
      });
    });
  }));
  res.json({ code: 200, data: results });
});

module.exports = router;
