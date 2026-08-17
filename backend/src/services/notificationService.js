/**
 * 通知服务
 * 统一封装通知创建逻辑,供订单/审核/评价/聊天模块复用
 */
const { Notification } = require('../models');

// 通知类型常量
const NOTIF_TYPE = {
  ORDER: 1,
  AUDIT: 2,
  REVIEW: 3,
  SYSTEM: 4,
  CHAT: 5
};

/**
 * 创建通知
 * @param {object} data { userId, type, title, content, relatedId }
 */
async function createNotification({ userId, type, title, content, relatedId = null }) {
  if (!userId || !type || !title || !content) return null;
  return Notification.create({
    user_id: userId,
    type,
    title,
    content,
    related_id: relatedId
  });
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
  return Notification.bulkCreate(rows);
}

module.exports = {
  NOTIF_TYPE,
  createNotification,
  createNotifications
};
