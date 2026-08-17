/**
 * WebSocket 聊天处理器
 * 事件:message:send / message:receive / message:read / typing / user:online / user:offline
 *
 * 连接方式:ws://host:port/ws/chat?token=<accessToken>
 * 每个用户加入以自身ID命名的房间 user_{id},便于精准推送
 */
const jwtUtil = require('../utils/jwt');
const messageService = require('../services/messageService');
const { redis, redisKeys } = require('../config/cache');

// 在线用户:userId -> Set<socketId>
const onlineSockets = new Map();

function getUserRoom(userId) {
  return `user_${userId}`;
}

/**
 * 初始化 WebSocket
 * @param {import('socket.io').Server} io
 */
function setupChat(io) {
  // 连接鉴权中间件
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('未提供认证Token'));
    }
    try {
      const blacklisted = await jwtUtil.isBlacklisted(token);
      if (blacklisted) return next(new Error('登录已失效'));
      const payload = jwtUtil.verifyAccessToken(token);
      if (payload.type !== 'access') return next(new Error('Token类型错误'));
      socket.user = { id: payload.id, username: payload.username, role: payload.role };
      next();
    } catch (e) {
      next(new Error('认证失败:' + (e.message || '')));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    // 加入个人房间
    socket.join(getUserRoom(userId));

    // 维护在线 socket 集合
    if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
    onlineSockets.get(userId).add(socket.id);

    // 标记在线 + 广播上线
    messageService.setUserOnline(userId, socket.id).catch(() => {});
    io.emit('user:online', { userId, username: socket.user.username });

    // ====== 发送消息 ======
    socket.on('message:send', async (payload, ack) => {
      try {
        const { toUserId, content, msgType, productId } = payload || {};
        const message = await messageService.sendMessage({
          fromUserId: userId,
          toUserId: Number(toUserId),
          content,
          msgType: msgType || 0,
          productId: productId || null
        });
        // 推送给接收者(若在线)
        io.to(getUserRoom(Number(toUserId))).emit('message:receive', message);
        // 回执给发送者
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
        else socket.emit('error', { event: 'message:send', message: err.message });
      }
    });

    // ====== 标记已读 ======
    socket.on('message:read', async (payload) => {
      try {
        const { fromUserId } = payload || {};
        const from = Number(fromUserId);
        if (!from) return;
        await messageService.markRead(userId, from);
        // 通知对方"对方已读"
        io.to(getUserRoom(from)).emit('message:read', { fromUserId: userId, toUserId: from });
      } catch (err) {
        socket.emit('error', { event: 'message:read', message: err.message });
      }
    });

    // ====== 正在输入 ======
    socket.on('typing', (payload) => {
      const { toUserId, isTyping } = payload || {};
      io.to(getUserRoom(Number(toUserId))).emit('typing', {
        fromUserId: userId,
        toUserId: Number(toUserId),
        isTyping: !!isTyping
      });
    });

    // ====== 断开连接 ======
    socket.on('disconnect', async () => {
      const set = onlineSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineSockets.delete(userId);
          await messageService.setUserOffline(userId).catch(() => {});
          io.emit('user:offline', { userId, username: socket.user.username });
        }
      }
    });
  });
}

/**
 * 查询用户是否在线(供其它模块使用)
 */
function isUserOnlineSync(userId) {
  return onlineSockets.has(userId);
}

module.exports = { setupChat, isUserOnlineSync, getUserRoom };
