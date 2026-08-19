/**
 * 通知服务
 * 统一封装通知创建逻辑,供订单/审核/评价/聊天模块复用
 */
const { Notification } = require('../models');
const { getIo } = require('../sockets/wsHelper');

// 通知类型常量
const NOTIF_TYPE = {
  ORDER: 1,
  AUDIT: 2,
  REVIEW: 3,
  SYSTEM: 4,
  CHAT: 5
};

/** 通知对象 → 前端 camel 字段(NavBar下拉+点击跳转直接用) */
function normalize(n) {
  if (!n) return null;
  const o = n.toJSON ? n.toJSON() : n;
  o.type = o.type;
  o.relatedId = o.related_id;
  o.isRead = o.is_read;
  o.createdAt = o.created_at || o.createdAt;
  o.updatedAt = o.updated_at || o.updatedAt;
  return o;
}

/**
 * 推送给在线用户(WS房间 `user_${userId}` — 与 chatHandler.getUserRoom 保持一致)
 * - 事件: notification:new payload: { notification }
 * - 前端收到后:顶栏红点+1 / 下拉里 unshift 一条新通知 / 点击跳对应页面
 */
function broadcastToUser(userId, notif) {
  if (!userId || !notif) return;
  try {
    const io = getIo();
    if (!io) return;
    io.to(`user_${userId}`).emit('notification:new', { notification: normalize(notif) });
  } catch (_) {
    // WS 未初始化或房间不存在静默忽略
  }
}

/**
 * 创建通知
 * @param {object} data { userId, type, title, content, relatedId, transaction }
 * 注意: 若在某个 sequelize 事务内调用(如卖家确认订单), 必须传 transaction,
 * 否则会开第二条写连接与事务写锁冲突 → SQLite BUSY → "服务器开小差/系统繁忙"。
 */
async function createNotification({ userId, type, title, content, relatedId = null, transaction = null }) {
  if (!userId || !type || !title || !content) return null;
  const row = await Notification.create({
    user_id: userId,
    type,
    title,
    content,
    related_id: relatedId
  }, transaction ? { transaction } : undefined);
  broadcastToUser(userId, row);
  return row;
}

/**
 * 批量创建通知
 */
async function createNotifications(list) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const rows = list.map((item) => ({
    user_id: item.userId,
    type: item.type,
    title: item.title,
    content: item.content,
    related_id: item.relatedId || null
  }));
  const created = await Notification.bulkCreate(rows);
  created.forEach((row, idx) => broadcastToUser(rows[idx].user_id, row));
  return created;
}

module.exports = {
  NOTIF_TYPE,
  createNotification,
  createNotifications
};
