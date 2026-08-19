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
  // 注意:前端 messageStore/conversations 数组和 Index.vue 全是 camelCase 字段契约:
  //   { userId, nickname, avatar, lastMessage, lastMessageTime, unreadCount, online }
  // 老后端返回 snake:{ user:{id,...}, last_message:{...}, unread_count, online }→字段对不上,
  // .find(c => c.userId === ...) 永远 null → "我的消息永远是空会话、发了消息也看不到"。
  const conversations = [];
  for (const msg of messages) {
    const isSender = msg.from_user_id === userId;
    const other = isSender ? msg.receiver : msg.sender;
    const unreadCount = await Message.count({
      where: { from_user_id: other.id, to_user_id: userId, is_read: 0 }
    });
    const online = await isUserOnline(other.id);
    conversations.push({
      userId: other.id,
      id: other.id,
      username: other.username,
      nickname: other.nickname || other.username || ('用户' + other.id),
      avatar: other.avatar || '',
      user: other, // 兼容老字段
      lastMessage: msg.content,
      last_message: { // 兼容老字段
        id: msg.id, content: msg.content, msg_type: msg.msg_type,
        created_at: msg.created_at, from_user_id: msg.from_user_id,
      },
      lastMessageTime: msg.created_at,
      unreadCount,
      unread_count: unreadCount, // 兼容老字段
      online,
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
  // 返回时给每条消息补 camelCase 别名:
  // 前端 message row 用 `msg.isSelf || msg.fromUserId === userInfo?.id` 判断气泡归属,
  // 老后端只返回 snake(from_user_id/to_user_id)→这些判断永远 false→"发了消息自己/对面都看不到"。
  return messages.map((m) => {
    const obj = m.toJSON();
    obj.fromUserId = obj.from_user_id;
    obj.toUserId = obj.to_user_id;
    obj.msgType = obj.msg_type ?? obj.msgType;
    obj.isRead = !!obj.is_read;
    obj.productId = obj.product_id;
    obj.createdAt = obj.created_at || obj.createdAt;
    return obj;
  });
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
  // 补 camel alias: 前端 messageStore sendMessage 成功替换临时消息时读 saved.fromUserId/saved.createdAt
  const obj = full.toJSON();
  obj.fromUserId = obj.from_user_id;
  obj.toUserId = obj.to_user_id;
  obj.msgType = obj.msg_type;
  obj.createdAt = obj.created_at || obj.createdAt;
  obj.updatedAt = obj.updated_at || obj.updatedAt;
  obj.productId = obj.product_id;
  obj.isRead = obj.is_read;
  return obj;
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
