const https = require('https');
const http = require('http');
const tls = require('tls');
const crypto = require('crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
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

    const smtpHost = process.env.SMTP_HOST || 'smtp.qq.com';
    const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 465;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM || smtpUser;
    const fromName = process.env.SMTP_FROM_NAME || '校园咸鱼';

    const result = await sendViaSmtp(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, fromName, to, subject, html);

    if (result.success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

function sendViaSmtp(host, port, user, pass, fromEmail, fromName, to, subject, html) {
  return new Promise((resolve) => {
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@campus-fish>`;
    const date = new Date().toUTCString();
    const encodedSubject = Buffer.from(subject).toString('base64');
    const mailContent = [
      `From: "${fromName}" <${fromEmail}>`,
      `To: <${to}>`,
      `Subject: =?UTF-8?B?${encodedSubject}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      `Message-ID: ${messageId}`,
      `Date: ${date}`,
      ``,
      Buffer.from(html).toString('base64')
    ].join('\r\n');

    const socket = tls.connect({
      host: host,
      port: port,
      rejectUnauthorized: false
    }, () => {});

    let step = 0;
    let buffer = '';
    const commands = [
      `EHLO campus-fish`,
      `AUTH LOGIN`,
      Buffer.from(user).toString('base64'),
      Buffer.from(pass).toString('base64'),
      `MAIL FROM:<${fromEmail}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      mailContent + '\r\n.',
      `QUIT`
    ];

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ success: false, error: 'SMTP timeout' });
    }, 12000);

    function sendCmd() {
      if (step < commands.length) {
        socket.write(commands[step] + '\r\n');
        step++;
      }
    }

    socket.on('data', (data) => {
      buffer += data.toString();
      while (buffer.includes('\r\n')) {
        const lineEnd = buffer.indexOf('\r\n');
        const line = buffer.substring(0, lineEnd);
        buffer = buffer.substring(lineEnd + 2);

        const code = parseInt(line.substring(0, 3), 10);

        if (step === 0 && code === 220) {
          sendCmd();
        } else if (code >= 200 && code < 400) {
          if (step < commands.length) {
            sendCmd();
          } else {
            clearTimeout(timeout);
            socket.end();
            resolve({ success: true });
          }
        } else if (code >= 400) {
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: false, error: `SMTP error: ${line}` });
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    });
  });
}
