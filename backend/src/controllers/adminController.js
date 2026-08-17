/**
 * 管理后台控制器(需 role=1)
 */
const { Op, fn, col } = require('sequelize');
const {
  User, Product, Report, AdminLog, Order, Category,
  ProductImage, Review
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const ResponseUtil = require('../utils/response');
const validator = require('../utils/validator');
const productService = require('../services/productService');
const notifService = require('../services/notificationService');

/**
 * 记录管理员操作日志
 */
async function logAction(req, action, targetType, targetId, detail) {
  try {
    await AdminLog.create({
      admin_id: req.user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail ? JSON.stringify(detail) : null,
      ip_address: req.ip
    });
  } catch (e) {
    console.error('[AdminLog] 写入失败:', e.message);
  }
}

/** 待审核商品列表 */
exports.pendingProducts = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const where = { status: productService.PRODUCT_STATUS.PENDING };
    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname'] },
        { model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }
      ],
      order: [['created_at', 'ASC']],
      limit: pageSize,
      offset,
      distinct: true
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/** 审核商品 action: pass | reject */
exports.reviewProduct = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body;
    if (!validator.isPositiveId(id)) throw new ApiError('商品ID非法', 400);
    if (!['pass', 'reject'].includes(action)) throw new ApiError('action 参数非法(pass/reject)', 400);

    const product = await Product.findByPk(id);
    if (!product) throw new ApiError('商品不存在', 404);
    if (product.status !== productService.PRODUCT_STATUS.PENDING) {
      throw new ApiError('该商品不在待审核状态', 400);
    }

    const newStatus = action === 'pass' ? productService.PRODUCT_STATUS.ON_SALE : productService.PRODUCT_STATUS.REJECTED;
    // 管理员审核优先级高于 AI:通过则置 ai_review_result=0,拒绝则置 2
    await product.update({ status: newStatus, ai_review_result: action === 'pass' ? 0 : 2 });

    await logAction(req, 'review_product', 'product', id, { action, aiReviewResult: product.ai_review_result });
    await notifService.createNotification({
      userId: product.user_id,
      type: notifService.NOTIF_TYPE.AUDIT,
      title: action === 'pass' ? '商品审核通过' : '商品审核未通过',
      content: `您的商品「${product.title}」${action === 'pass' ? '已审核通过,现已上架' : '审核未通过,请修改后重新发布'}。${product.ai_review_reason ? '[AI 提示]' + product.ai_review_reason : ''}`,
      relatedId: product.id
    });
    ResponseUtil.success(res, null, action === 'pass' ? '已通过审核' : '已拒绝');
  } catch (err) { next(err); }
};

/**
 * 重新触发 AI 审核(管理员手动调用,用于 AI 审核异常或调整后重审)
 * GET /admin/products/:id/ai-review
 */
exports.reReviewByAi = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!validator.isPositiveId(id)) throw new ApiError('商品ID非法', 400);
    const product = await Product.findByPk(id);
    if (!product) throw new ApiError('商品不存在', 404);

    const { result, reason, newStatus } = await productService.applyAiReview(product, {
      title: product.title,
      description: product.description,
      price: parseFloat(product.price)
    });

    await logAction(req, 'ai_re_review', 'product', id, { result, reason, newStatus });
    ResponseUtil.success(res, { result, reason, status: newStatus, aiReviewResult: product.ai_review_result }, `AI 重审完成:${result}`);
  } catch (err) { next(err); }
};

/** 用户列表 */
exports.listUsers = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const where = {};
    if (req.query.keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${req.query.keyword}%` } },
        { nickname: { [Op.like]: `%${req.query.keyword}%` } },
        { student_id: { [Op.like]: `%${req.query.keyword}%` } }
      ];
    }
    if (req.query.status !== undefined && req.query.status !== '') {
      where.status = Number(req.query.status);
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/** 封禁/解封用户 status: 0封禁 1正常 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!validator.isPositiveId(id)) throw new ApiError('用户ID非法', 400);
    if (![0, 1].includes(Number(status))) throw new ApiError('status 非法(0封禁 1正常)', 400);
    if (id === req.user.id) throw new ApiError('不可操作自己的账号', 400);

    const user = await User.findByPk(id);
    if (!user) throw new ApiError('用户不存在', 404);
    if (user.role === 1) throw new ApiError('不可封禁管理员', 400);

    await user.update({ status: Number(status) });
    await logAction(req, 'update_user_status', 'user', id, { status });
    ResponseUtil.success(res, null, Number(status) === 0 ? '已封禁' : '已解封');
  } catch (err) { next(err); }
};

/** 举报列表 */
exports.listReports = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const where = {};
    if (req.query.status !== undefined && req.query.status !== '') {
      where.status = Number(req.query.status);
    }
    const { rows, count } = await Report.findAndCountAll({
      where,
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: User, as: 'handler', attributes: ['id', 'username', 'nickname'] }
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      distinct: true
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/** 处理举报 status: 1已处理 2已驳回, handleResult */
exports.handleReport = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, handleResult } = req.body;
    if (!validator.isPositiveId(id)) throw new ApiError('举报ID非法', 400);
    if (![1, 2].includes(Number(status))) throw new ApiError('status 非法(1已处理 2已驳回)', 400);

    const report = await Report.findByPk(id);
    if (!report) throw new ApiError('举报不存在', 404);
    if (report.status !== 0) throw new ApiError('该举报已处理', 400);

    await report.update({
      status: Number(status),
      handle_result: handleResult || null,
      handler_id: req.user.id,
      handled_at: new Date()
    });
    await logAction(req, 'handle_report', 'report', id, { status, handleResult });
    ResponseUtil.success(res, null, '处理成功');
  } catch (err) { next(err); }
};

/** 数据统计 */
exports.stats = async (req, res, next) => {
  try {
    const [
      userCount,
      productCount,
      onSaleCount,
      pendingReviewCount,
      orderCount,
      completedCount,
      reportCount,
      pendingReportCount,
      categoryCount
    ] = await Promise.all([
      User.count(),
      Product.count(),
      Product.count({ where: { status: productService.PRODUCT_STATUS.ON_SALE } }),
      Product.count({ where: { status: productService.PRODUCT_STATUS.PENDING } }),
      Order.count(),
      Order.count({ where: { status: 3 } }),
      Report.count(),
      Report.count({ where: { status: 0 } }),
      Category.count()
    ]);

    // 各分类商品数
    const categoryStats = await Product.findAll({
      attributes: ['category_id', [fn('COUNT', col('id')), 'count']],
      where: { status: productService.PRODUCT_STATUS.ON_SALE },
      group: ['category_id'],
      raw: true
    });

    ResponseUtil.success(res, {
      users: userCount,
      products: productCount,
      onSale: onSaleCount,
      pendingReview: pendingReviewCount,
      orders: orderCount,
      completed: completedCount,
      reports: reportCount,
      pendingReports: pendingReportCount,
      categories: categoryCount,
      categoryStats
    });
  } catch (err) { next(err); }
};
