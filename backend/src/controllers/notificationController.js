/**
 * 通知控制器
 */
const { Notification } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const ResponseUtil = require('../utils/response');
const validator = require('../utils/validator');

/** 通知列表 */
exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const where = { user_id: req.user.id };
    if (req.query.type) where.type = Number(req.query.type);
    if (req.query.isRead !== undefined && req.query.isRead !== '') {
      where.is_read = Number(req.query.isRead);
    }
    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/** 标记单条已读 */
exports.markRead = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!validator.isPositiveId(id)) throw new ApiError('ID非法', 400);
    const notif = await Notification.findByPk(id);
    if (!notif) throw new ApiError('通知不存在', 404);
    if (notif.user_id !== req.user.id) throw new ApiError('无权操作', 403);
    await notif.update({ is_read: 1 });
    ResponseUtil.success(res, null, '已标记为已读');
  } catch (err) { next(err); }
};

/** 全部已读 */
exports.markAllRead = async (req, res, next) => {
  try {
    const [count] = await Notification.update(
      { is_read: 1 },
      { where: { user_id: req.user.id, is_read: 0 } }
    );
    ResponseUtil.success(res, { updated: count }, '全部已读');
  } catch (err) { next(err); }
};

/** 未读数量 */
exports.unreadCount = async (req, res, next) => {
  try {
    const count = await Notification.count({
      where: { user_id: req.user.id, is_read: 0 }
    });
    ResponseUtil.success(res, { count });
  } catch (err) { next(err); }
};
