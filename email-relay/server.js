/**
 * 邮件中转服务
 * 部署在 Render.com,用 QQ SMTP 发邮件
 * Railway 后端通过 HTTP 调用此服务
 */
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || '校园咸鱼';
const API_TOKEN = process.env.API_TOKEN || '';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
  return transporter;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/send', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (API_TOKEN) {
    if (authHeader !== `Bearer ${API_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing to, subject, or html' });
  }

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
      to,
      subject,
      html
    });
    console.log(`[email-relay] 邮件已发送至 ${to}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[email-relay] 发送失败: ${err.message}`);
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

app.listen(PORT, () => {
  console.log(`[email-relay] 服务启动,端口 ${PORT}`);
});
