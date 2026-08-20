module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const nodemailer = require('nodemailer');

    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing to, subject, or html' });
    }

    const token = process.env.API_TOKEN;
    if (token) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${token}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000
    });

    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || '校园咸鱼';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, code: err.code });
  }
};
