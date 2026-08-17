/**
 * 消息控制器
 */
const messageService = require('../services/messageService');
const ResponseUtil = require('../utils/response');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');

/** 会话列表 */
exports.conversations = async (req, res, next) => {
  try {
    const list = await messageService.listConversations(req.user.id);
    ResponseUtil.success(res, list);
  } catch (err) { next(err); }
};

/** 聊天记录 */
exports.history = async (req, res, next) => {
  try {
    const otherUserId = Number(req.params.userId);
    const { beforeId, limit } = req.query;
    const messages = await messageService.getChatHistory(req.user.id, otherUserId, { beforeId, limit });
    ResponseUtil.success(res, messages);
  } catch (err) { next(err); }
};

/** 发送消息(REST,WebSocket 也走同一服务) */
exports.send = async (req, res, next) => {
  try {
    const { toUserId, content, msgType, productId } = req.body;
    const message = await messageService.sendMessage({
      fromUserId: req.user.id,
      toUserId,
      content,
      msgType,
      productId
    });
    ResponseUtil.created(res, message, '发送成功');
  } catch (err) { next(err); }
};

/** 标记已读 */
exports.markRead = async (req, res, next) => {
  try {
    const fromUserId = Number(req.params.userId);
    if (!validator.isPositiveId(fromUserId)) throw new ApiError('用户ID非法', 400);
    const count = await messageService.markRead(req.user.id, fromUserId);
    ResponseUtil.success(res, { updated: count }, '已标记已读');
  } catch (err) { next(err); }
};
