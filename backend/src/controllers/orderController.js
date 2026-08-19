/**
 * 订单控制器
 */
const orderService = require('../services/orderService');
const ResponseUtil = require('../utils/response');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');

/** 创建订单 */
exports.create = async (req, res, next) => {
  try {
    const { productId, remark } = req.body;
    const order = await orderService.createOrder(req.user.id, { productId, remark });
    // OrderDetail 路由:router.push({name:'OrderDetail', params:{id:res.orderId}})
    // 需要返回 id(orderId) + 兼容字段,避免前端跳 /orders/undefined → 404 "资源不存在"
    ResponseUtil.created(res, {
      id: order.id,
      orderId: order.id,
      orderNo: order.order_no || order.orderNo,
      status: order.status,
      order,
    }, '下单成功');
  } catch (err) { next(err); }
};

/** 订单列表 */
exports.list = async (req, res, next) => {
  try {
    const result = await orderService.listOrders(req.user.id, req.query);
    ResponseUtil.paginate(res, result.list, result.total, result.page, result.pageSize);
  } catch (err) { next(err); }
};

/** 订单详情 */
exports.detail = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!validator.isPositiveId(id)) throw new ApiError('订单ID非法', 400);
    const order = await orderService.getOrderDetail(req.user.id, id);
    ResponseUtil.success(res, order);
  } catch (err) { next(err); }
};

/** 卖家确认/拒绝 */
exports.confirm = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const order = await orderService.confirmOrder(req.user.id, Number(req.params.id), action, reason);
    ResponseUtil.success(res, order, action === 'accept' ? '已确认订单' : '已拒绝订单');
  } catch (err) { next(err); }
};

/** 买家取消 */
exports.cancel = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.user.id, Number(req.params.id), reason);
    ResponseUtil.success(res, order, '订单已取消');
  } catch (err) { next(err); }
};

/** 确认完成(买卖双方各自确认;双方均确认后订单完成) */
exports.complete = async (req, res, next) => {
  try {
    const order = await orderService.completeOrder(req.user.id, Number(req.params.id));
    ResponseUtil.success(res, order, '操作成功');
  } catch (err) { next(err); }
};

/** 评价 */
exports.review = async (req, res, next) => {
  try {
    const { rating, content } = req.body;
    const review = await orderService.reviewOrder(req.user.id, Number(req.params.id), { rating, content });
    ResponseUtil.created(res, review, '评价成功');
  } catch (err) { next(err); }
};
