/**
 * 消息服务
 * 会话列表、聊天记录、发送消息、标记已读
 */
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Message, User, Product } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');
const { redis, redisKeys } = require('../config/cache');
const notifService = require('./notificationService');

/**
 * 会话列表:与当前用户有过消息往来的对方列表(含最后一条消息与未读数)
 * 使用原始查询获取每个会话最后一条消息ID,避免复杂的分组表达式
 */
async function listConversations(userId) {
  const sql = `
    SELECT MAX(id) AS last_id FROM messages
    WHERE from_user_id = ? OR to_user_id = ?
    GROUP BY CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END
  `;
  const lastMsgRows = await sequelize.query(sql, {
    replacements: [userId, userId, userId],
    type: sequelize.QueryTypes.SELECT
  });

  if (!lastMsgRows.length) return [];

  const lastIds = lastMsgRows.map((r) => r.last_id);
  const messages = await Message.findAll({
    where: { id: { [Op.in]: lastIds } },
    include: [
      { model: User, as: 'sender', attributes: ['id', 'username', 'avatar', 'nickname'] },
      { model: User, as: 'receiver', attributes: ['id', 'username', 'avatar', 'nickname'] }
    ],
    order: [['created_at', 'DESC']]
  });

  // 组装会话:对方信息 + 最后消息 + 未读数 + 在线状态
  const conversations = [];
  for (const msg of messages) {
    const isSender = msg.from_user_id === userId;
    const other = isSender ? msg.receiver : msg.sender;
    const unreadCount = await Message.count({
      where: { from_user_id: other.id, to_user_id: userId, is_read: 0 }
    });
    const online = await isUserOnline(other.id);
    conversations.push({
      user: other,
      last_message: {
        id: msg.id,
        content: msg.content,
        msg_type: msg.msg_type,
        created_at: msg.created_at,
        from_user_id: msg.from_user_id
      },
      unread_count: unreadCount,
      online
    });
  }
  return conversations;
}

/**
 * 聊天记录(与某用户)
 * @param {number} beforeId 分页游标:取该ID之前的消息
 */
async function getChatHistory(userId, otherUserId, { beforeId, limit = 30 }) {
  if (!validator.isPositiveId(otherUserId)) throw new ApiError('用户ID非法', 400);
  const where = {
    [Op.or]: [
      { from_user_id: userId, to_user_id: otherUserId },
      { from_user_id: otherUserId, to_user_id: userId }
    ]
  };
  if (beforeId) {
    where.id = { [Op.lt]: Number(beforeId) };
  }
  const messages = await Message.findAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'title', 'price'], required: false }
    ],
    order: [['id', 'DESC']],
    limit: Math.min(Number(limit) || 30, 100)
  });
  return messages; // 倒序返回,前端可自行 reverse
}

/**
 * 发送消息(REST 与 WebSocket 共用)
 */
async function sendMessage({ fromUserId, toUserId, content, msgType = 0, productId = null }) {
  if (!validator.isPositiveId(toUserId)) throw new ApiError('接收者ID非法', 400);
  if (!content) throw new ApiError('消息内容不能为空', 400);
  if (fromUserId === Number(toUserId)) throw new ApiError('不能给自己发消息', 400);

  const toUser = await User.findByPk(toUserId, { attributes: ['id', 'status'] });
  if (!toUser) throw new ApiError('接收用户不存在', 404);

  const message = await Message.create({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    product_id: productId || null,
    content,
    msg_type: Number(msgType) || 0,
    is_read: 0
  });

  // 若对方不在线,生成聊天通知
  const online = await isUserOnline(toUserId);
  if (!online) {
    const fromUser = await User.findByPk(fromUserId, { attributes: ['nickname', 'username'] });
    const name = (fromUser && (fromUser.nickname || fromUser.username)) || '用户';
    await notifService.createNotification({
      userId: toUserId,
      type: notifService.NOTIF_TYPE.CHAT,
      title: '您收到一条新消息',
      content: `${name}: ${content.length > 50 ? content.slice(0, 50) + '...' : content}`,
      relatedId: fromUserId
    });
  }

  const full = await Message.findByPk(message.id, {
    include: [{ model: Product, as: 'product', attributes: ['id', 'title', 'price'], required: false }]
  });
  return full;
}

/**
 * 标记来自某用户的消息为已读
 */
async function markRead(userId, fromUserId) {
  if (!validator.isPositiveId(fromUserId)) throw new ApiError('用户ID非法', 400);
  const [count] = await Message.update(
    { is_read: 1 },
    { where: { from_user_id: fromUserId, to_user_id: userId, is_read: 0 } }
  );
  return count;
}

/**
 * 用户在线状态(基于 Redis)
 */
async function setUserOnline(userId, socketId) {
  await redis.set(redisKeys.wsOnline(userId), socketId, 'EX', 300);
}

async function setUserOffline(userId) {
  await redis.del(redisKeys.wsOnline(userId));
}

async function isUserOnline(userId) {
  const v = await redis.get(redisKeys.wsOnline(userId));
  return !!v;
}

module.exports = {
  listConversations,
  getChatHistory,
  sendMessage,
  markRead,
  setUserOnline,
  setUserOffline,
  isUserOnline
};
