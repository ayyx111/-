/**
 * 邮件发送工具
 * 基于 nodemailer,使用 SMTP 协议发送验证码邮件
 */
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

/**
 * 懒加载 SMTP transporter(首次调用时创建)
 */
function getTransporter() {
  if (transporter) return transporter;

  if (!config.email.host || !config.email.user || !config.email.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  return transporter;
}

/**
 * 是否已配置 SMTP(用于判断是否真实发送)
 */
function isEmailConfigured() {
  return !!(config.email.host && config.email.user && config.email.pass);
}

/**
 * 发送验证码邮件
 * @param {string} toEmail 收件人邮箱
 * @param {string} code 6位验证码
 * @returns {Promise<{sent: boolean, channel: string}>}
 */
async function sendVerifyCodeEmail(toEmail, code) {
  const t = getTransporter();

  // SMTP 未配置 → 降级为控制台打印(开发模式)
  if (!t) {
    console.log(`[验证码][开发模式] 未配置 SMTP,验证码 ${code} 未发送至 ${toEmail}`);
    return { sent: false, channel: 'console' };
  }

  const fromEmail = config.email.from || config.email.user;
  const fromName = config.email.fromName || '校园咸鱼';
  const expireMinutes = Math.ceil(300 / 60);

  const html = `
  <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <div style="background:linear-gradient(135deg,#4CAF50 0%,#45a049 100%);padding:24px 32px;border-radius:12px 12px 0 0">
      <h1 style="color:#fff;font-size:20px;margin:0;font-weight:600">校园咸鱼</h1>
      <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:4px 0 0">校园二手交易平台</p>
    </div>
    <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px">
      <h2 style="font-size:16px;color:#333;margin:0 0 16px">验证码</h2>
      <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px">您好,您正在注册校园咸鱼账号,验证码为:</p>
      <div style="text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#4CAF50;background:#f1f8e9;padding:16px 32px;border-radius:8px;display:inline-block">${code}</span>
      </div>
      <p style="color:#999;font-size:13px;margin:0 0 8px">验证码有效期为 ${expireMinutes} 分钟,请尽快使用。</p>
      <p style="color:#999;font-size:13px;margin:0 0 24px">如果这不是您本人的操作,请忽略此邮件。</p>
      <hr style="border:none;border-top:1px solid #eee;margin:0">
      <p style="color:#bbb;font-size:12px;margin:16px 0 0">此邮件由系统自动发送,请勿回复。</p>
    </div>
  </div>`;

  try {
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: '【校园咸鱼】注册验证码',
      html
    });
    console.log(`[验证码] 邮件已发送至 ${toEmail}`);
    return { sent: true, channel: 'email' };
  } catch (err) {
    console.error(`[验证码] SMTP 发送失败: ${err.message}`);
    return { sent: false, channel: 'error', error: err.message };
  }
}

module.exports = {
  isEmailConfigured,
  sendVerifyCodeEmail
};
