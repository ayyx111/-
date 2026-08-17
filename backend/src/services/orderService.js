/**
 * 订单服务
 */
const { Op } = require('sequelize');
const { sequelize, Order, Product, Review, User, ProductImage } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');
const productService = require('./productService');
const notifService = require('./notificationService');

// 订单状态
const ORDER_STATUS = {
  PENDING: 0, // 待确认
  WAITING: 1, // 待交易
  TRADING: 2, // 交易中
  COMPLETED: 3, // 已完成
  CANCELED: 4 // 已取消
};

/**
 * 生成订单号: OF + yyyyMMddHHmmss + 6位随机
 */
function genOrderNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OF${ts}${rand}`;
}

/**
 * 创建订单
 * - 不可买自己的商品
 * - 商品必须为在售状态
 * - 商品锁定
 */
async function createOrder(buyerId, { productId, remark }) {
  if (!validator.isPositiveId(productId)) throw new ApiError('商品ID非法', 400);
  const product = await Product.findByPk(productId);
  if (!product) throw new ApiError('商品不存在', 404);
  if (product.user_id === buyerId) throw new ApiError('不能购买自己的商品', 400);
  if (product.status !== productService.PRODUCT_STATUS.ON_SALE) {
    throw new ApiError('该商品当前不可购买', 400);
  }

  const t = await sequelize.transaction();
  try {
    // 锁定商品
    await product.update({ status: productService.PRODUCT_STATUS.LOCKED }, { transaction: t });

    const order = await Order.create({
      order_no: genOrderNo(),
      product_id: product.id,
      buyer_id: buyerId,
      seller_id: product.user_id,
      price: product.price,
      trade_type: product.trade_type,
      remark: remark || null,
      product_title: product.title,
      status: ORDER_STATUS.PENDING
    }, { transaction: t });

    await t.commit();

    // 通知卖家有新订单
    await notifService.createNotification({
      userId: product.user_id,
      type: notifService.NOTIF_TYPE.ORDER,
      title: '您有新的订单',
      content: `买家对「${product.title}」发起了购买请求,请尽快处理。`,
      relatedId: order.id
    });

    return order;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * 订单列表(buyer/seller/all筛选)
 */
async function listOrders(userId, query) {
  const { page, pageSize, offset } = validator.parsePaging({ query });
  const where = {};
  if (query.role === 'buyer') {
    where.buyer_id = userId;
  } else if (query.role === 'seller') {
    where.seller_id = userId;
  } else {
    where[Op.or] = [{ buyer_id: userId }, { seller_id: userId }];
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [
      { model: Product, as: 'product', attributes: ['id', 'title', 'price', 'status'] },
      { model: User, as: 'buyer', attributes: ['id', 'username', 'avatar', 'nickname'] },
      { model: User, as: 'seller', attributes: ['id', 'username', 'avatar', 'nickname'] }
    ],
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset
  });

  return { list: rows, total: count, page, pageSize };
}

/**
 * 订单详情(买卖双方可查)
 */
async function getOrderDetail(userId, id) {
  const order = await Order.findByPk(id, {
    include: [
      { model: Product, as: 'product', include: [{ model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'] }] },
      { model: User, as: 'buyer', attributes: ['id', 'username', 'avatar', 'nickname'] },
      { model: User, as: 'seller', attributes: ['id', 'username', 'avatar', 'nickname'] },
      { model: Review, as: 'review' }
    ]
  });
  if (!order) throw new ApiError('订单不存在', 404);
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw new ApiError('无权查看该订单', 403);
  }
  return order;
}

/**
 * 卖家确认/拒绝订单
 * action: accept | reject
 */
async function confirmOrder(userId, id, action, reason) {
  const order = await Order.findByPk(id);
  if (!order) throw new ApiError('订单不存在', 404);
  if (order.seller_id !== userId) throw new ApiError('仅卖家可操作', 403);
  if (order.status !== ORDER_STATUS.PENDING) throw new ApiError('当前订单状态不可操作', 400);

  const t = await sequelize.transaction();
  try {
    const product = await Product.findByPk(order.product_id, { transaction: t });
    if (action === 'accept') {
      await order.update({ status: ORDER_STATUS.WAITING, seller_confirmed: 1 }, { transaction: t });
      // 通知买家
      await notifService.createNotification({
        userId: order.buyer_id,
        type: notifService.NOTIF_TYPE.ORDER,
        title: '卖家已确认订单',
        content: `卖家已确认「${order.product_title}」的订单,可联系交易。`,
        relatedId: order.id
      });
    } else if (action === 'reject') {
      await order.update({
        status: ORDER_STATUS.CANCELED,
        canceled_at: new Date(),
        cancel_reason: reason || '卖家拒绝'
      }, { transaction: t });
      // 商品恢复在售
      if (product) {
        await product.update({ status: productService.PRODUCT_STATUS.ON_SALE }, { transaction: t });
      }
      await notifService.createNotification({
        userId: order.buyer_id,
        type: notifService.NOTIF_TYPE.ORDER,
        title: '卖家拒绝了您的订单',
        content: `卖家拒绝了「${order.product_title}」的订单。`,
        relatedId: order.id
      });
    } else {
      throw new ApiError('action 参数非法(accept/reject)', 400);
    }
    await t.commit();
    return order;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * 买家取消订单(仅 待确认/待交易 状态)
 */
async function cancelOrder(userId, id, reason) {
  const order = await Order.findByPk(id);
  if (!order) throw new ApiError('订单不存在', 404);
  if (order.buyer_id !== userId) throw new ApiError('仅买家可取消', 403);
  if (![ORDER_STATUS.PENDING, ORDER_STATUS.WAITING].includes(order.status)) {
    throw new ApiError('当前订单状态不可取消', 400);
  }

  const t = await sequelize.transaction();
  try {
    await order.update({
      status: ORDER_STATUS.CANCELED,
      canceled_at: new Date(),
      cancel_reason: reason || '买家取消'
    }, { transaction: t });

    const product = await Product.findByPk(order.product_id, { transaction: t });
    if (product && product.status === productService.PRODUCT_STATUS.LOCKED) {
      await product.update({ status: productService.PRODUCT_STATUS.ON_SALE }, { transaction: t });
    }

    await t.commit();
    // 通知卖家
    await notifService.createNotification({
      userId: order.seller_id,
      type: notifService.NOTIF_TYPE.ORDER,
      title: '买家取消了订单',
      content: `买家取消了「${order.product_title}」的订单。`,
      relatedId: order.id
    });
    return order;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * 确认完成(买卖双方各自确认;双方均确认后订单完成)
 * 角色由 userId 与订单买卖双方比对自动推断
 */
async function completeOrder(userId, id) {
  const order = await Order.findByPk(id);
  if (!order) throw new ApiError('订单不存在', 404);

  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  if (!isBuyer && !isSeller) throw new ApiError('无权操作该订单', 403);
  if (order.status !== ORDER_STATUS.WAITING && order.status !== ORDER_STATUS.TRADING) {
    throw new ApiError('当前订单状态不可确认完成', 400);
  }

  const t = await sequelize.transaction();
  try {
    const update = {};
    if (isBuyer) update.buyer_confirmed = 1;
    if (isSeller) update.seller_confirmed = 1;

    // 刷新当前确认状态
    const buyerConfirmed = isBuyer ? 1 : order.buyer_confirmed;
    const sellerConfirmed = isSeller ? 1 : order.seller_confirmed;

    if (buyerConfirmed && sellerConfirmed) {
      update.status = ORDER_STATUS.COMPLETED;
      update.confirmed_at = new Date();
      // 商品标记已售
      const product = await Product.findByPk(order.product_id, { transaction: t });
      if (product) {
        await product.update({ status: productService.PRODUCT_STATUS.SOLD }, { transaction: t });
      }
    } else {
      update.status = ORDER_STATUS.TRADING; // 进入交易中
    }

    await order.update(update, { transaction: t });
    await t.commit();

    // 完成后通知双方
    if (update.status === ORDER_STATUS.COMPLETED) {
      await notifService.createNotifications([
        { userId: order.buyer_id, type: notifService.NOTIF_TYPE.ORDER, title: '交易已完成', content: `「${order.product_title}」的交易已完成,请及时评价。`, relatedId: order.id },
        { userId: order.seller_id, type: notifService.NOTIF_TYPE.ORDER, title: '交易已完成', content: `「${order.product_title}」的交易已完成,请及时评价。`, relatedId: order.id }
      ]);
    }
    return order;
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * 评价(订单完成后,买卖双方互评)
 */
async function reviewOrder(userId, id, { rating, content }) {
  if (!rating || rating < 1 || rating > 5) throw new ApiError('评分为1-5星', 400);
  const order = await Order.findByPk(id);
  if (!order) throw new ApiError('订单不存在', 404);
  if (order.status !== ORDER_STATUS.COMPLETED) throw new ApiError('订单未完成,不可评价', 400);

  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  if (!isBuyer && !isSeller) throw new ApiError('无权评价该订单', 403);

  // 是否已评价(一个订单最多两条评价:买家评卖家、卖家评买家)
  const existing = await Review.findOne({ where: { order_id: id, from_user_id: userId } });
  if (existing) throw new ApiError('您已评价过该订单', 400);

  const toUserId = isBuyer ? order.seller_id : order.buyer_id;
  const review = await Review.create({
    order_id: id,
    from_user_id: userId,
    to_user_id: toUserId,
    reviewer_role: isBuyer ? 1 : 2,
    rating: Number(rating),
    content: content || null
  });

  // 通知对方
  await notifService.createNotification({
    userId: toUserId,
    type: notifService.NOTIF_TYPE.REVIEW,
    title: '您收到一条新评价',
    content: `${isBuyer ? '买家' : '卖家'}对您做出了 ${rating} 星评价。`,
    relatedId: review.id
  });

  return review;
}

module.exports = {
  ORDER_STATUS,
  createOrder,
  listOrders,
  getOrderDetail,
  confirmOrder,
  cancelOrder,
  completeOrder,
  reviewOrder
};
