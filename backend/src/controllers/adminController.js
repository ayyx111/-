/**
 * 管理后台控制器(需 role=1)
 */
const { Op, fn, col, literal } = require('sequelize');
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
    // 只查校园认证相关：verifyStatus=0/1/2/3 过滤(默认不过滤)
    if (req.query.verifyStatus !== undefined && req.query.verifyStatus !== '') {
      where.is_verified = Number(req.query.verifyStatus);
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });
    // 给每行补 camelCase alias:
    // Users.vue / Verify 审核前端读 isVerified 等字段,老 sequelize 返回只有 snake(如 is_verified),
    // 导致 2(待审核)/3(未通过) 显示成 "未认证",管理员永远看不到"认证待审核"。
    const normalized = rows.map((u) => {
      const obj = u.toJSON ? u.toJSON() : u;
      obj.isVerified = obj.is_verified ?? 0;
      obj.studentId = obj.student_id;
      obj.campusProof = obj.campus_proof;
      obj.enrollmentYear = obj.enrollment_year;
      obj.creditScore = obj.credit_score;
      obj.lastLoginAt = obj.last_login_at;
      obj.createdAt = obj.created_at || obj.createdAt;
      return obj;
    });
    ResponseUtil.paginate(res, normalized, count, page, pageSize);
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

/** 计算今日 00:00:00 以后的增量计数;列不存在或 SQL 报错则 fallback 0 */
async function countToday(Model, dateCol, extraWhere) {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const where = { [dateCol]: { [Op.gte]: start } };
    if (extraWhere) Object.assign(where, extraWhere);
    return await Model.count({ where });
  } catch (e) {
    console.warn(`[admin/stats] 今日增量查 ${Model.name}.${dateCol} 失败(列可能不存在): ${e.message}`);
    return 0;
  }
}

/** 数据统计
 *  返回字段兼容两套命名:
 *   - 后端原有: users/products/onSale/pendingReview/orders/completed/reports/pendingReports/categories/categoryStats
 *   - 前端 Overview.vue 期待: userCount/productCount/orderCount/pendingReviews/pendingReports/todayNewUsers/todayNewProducts
 *   - 前端 Statistics.vue category: 返回 categories 列表(含{name,count})与趋势列表(近14天{date, users, products, orders})
 */
exports.stats = async (req, res, next) => {
  try {
    const type = req.query.type || 'overview'; // overview | category | trend

    const [
      userCount,
      productCount,
      onSaleCount,
      pendingReviewCount,
      rejectedCount,
      orderCount,
      completedCount,
      reportCount,
      pendingReportCount,
      categoryCount,
      pendingVerificationCount,
    ] = await Promise.all([
      User.count(),
      Product.count(),
      Product.count({ where: { status: productService.PRODUCT_STATUS.ON_SALE } }),
      Product.count({ where: { status: productService.PRODUCT_STATUS.PENDING } }),
      Product.count({ where: { status: productService.PRODUCT_STATUS.REJECTED } }),
      Order.count(),
      Order.count({ where: { status: 3 } }),
      Report.count(),
      Report.count({ where: { status: 0 } }),
      Category.count(),
      User.count({ where: { is_verified: 2 } }), // 2=待审核
    ]);

    // 今日新增(如果表没有 created_at 列, fallback 0)
    const [todayNewUsers, todayNewProducts] = await Promise.all([
      countToday(User, 'created_at'),
      countToday(Product, 'created_at')
    ]);

    const base = {
      // 后端原有命名
      users: userCount,
      products: productCount,
      onSale: onSaleCount,
      pendingReview: pendingReviewCount,
      rejected: rejectedCount,
      orders: orderCount,
      completed: completedCount,
      reports: reportCount,
      pendingReports: pendingReportCount,
      categories: categoryCount,
      pendingVerifications: pendingVerificationCount,
      // Overview.vue 期待命名(必须完全对齐)
      userCount,
      productCount,
      orderCount,
      pendingReviews: pendingReviewCount,
      pendingReports: pendingReportCount,
      pendingVerificationsCount: pendingVerificationCount, // 统计页兼容
      todayNewUsers,
      todayNewProducts,
      // Statistics.vue 条形图字段
      categoryStats: []
    };

    // 各分类商品数(条形图 + trend 共用)
    const catRows = await Product.findAll({
      attributes: ['category_id', [fn('COUNT', literal('1')), 'count']],
      where: { status: productService.PRODUCT_STATUS.ON_SALE },
      group: ['category_id'],
      raw: true
    });
    // 关联查分类名
    const allCats = await Category.findAll({ raw: true });
    const catNameMap = {};
    allCats.forEach((c) => (catNameMap[c.id] = c.name));
    base.categoryStats = catRows.map((r) => ({
      categoryId: r.category_id,
      name: catNameMap[r.category_id] || `#${r.category_id}`,
      count: Number(r.count || 0),
    }));

    // 按 type 差异化返回
    if (type === 'category') {
      return ResponseUtil.success(res, {
        ...base,
        categories: base.categoryStats, // Statistics.vue category: read from "categories" list
        list: base.categoryStats
      });
    }

    if (type === 'trend') {
      // 近 14 天按日期 group: users/products/orders 增量
      const labels = [];
      const rows = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const next = new Date(d.getTime() + 86400000);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
        const [us, ps, os] = await Promise.all([
          countBetween(User, 'created_at', d, next),
          countBetween(Product, 'created_at', d, next),
          countBetween(Order, 'created_at', d, next),
        ]);
        rows.push({ date: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, users: us, products: ps, orders: os });
      }
      return ResponseUtil.success(res, {
        ...base,
        labels,
        list: rows,
        trend: rows,
      });
    }

    // overview(默认)
    ResponseUtil.success(res, base);
  } catch (err) { next(err); }
};

/** [start,end) 范围内计数,列不存在 fallback 0 */
async function countBetween(Model, dateCol, start, end) {
  try {
    return await Model.count({
      where: { [dateCol]: { [Op.gte]: start, [Op.lt]: end } }
    });
  } catch (e) { return 0; }
}

/** 校园认证待审核列表(is_verified=2,按提交时间正序)
 *  GET /admin/verifications?page=&pageSize=
 */
exports.listVerifications = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    // 0 未认证 1 已认证 2 待审核 3 未通过;默认只看 2(待审核)
    const vs = req.query.verifyStatus !== undefined && req.query.verifyStatus !== ''
      ? Number(req.query.verifyStatus) : 2;
    const where = { is_verified: vs };
    if (req.query.keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${req.query.keyword}%` } },
        { nickname: { [Op.like]: `%${req.query.keyword}%` } },
        { student_id: { [Op.like]: `%${req.query.keyword}%` } },
        { school: { [Op.like]: `%${req.query.keyword}%` } },
        { college: { [Op.like]: `%${req.query.keyword}%` } },
      ];
    }
    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['updated_at', 'ASC']],
      limit: pageSize,
      offset,
    });
    const normalized = rows.map((u) => {
      const obj = u.toJSON ? u.toJSON() : u;
      obj.isVerified = obj.is_verified ?? 0;
      obj.studentId = obj.student_id;
      obj.campusProof = obj.campus_proof;
      obj.enrollmentYear = obj.enrollment_year;
      obj.creditScore = obj.credit_score;
      obj.lastLoginAt = obj.last_login_at;
      obj.createdAt = obj.created_at || obj.createdAt;
      return obj;
    });
    ResponseUtil.paginate(res, normalized, count, page, pageSize);
  } catch (err) { next(err); }
};

/** 审核校园认证 action: pass | reject
 *  PUT /admin/users/:id/verify
 */
exports.reviewVerification = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { action, reason } = req.body;
    if (!validator.isPositiveId(id)) throw new ApiError('用户ID非法', 400);
    if (!['pass', 'reject'].includes(action)) {
      throw new ApiError('action 参数非法(pass/reject)', 400);
    }
    const user = await User.findByPk(id);
    if (!user) throw new ApiError('用户不存在', 404);
    if (user.is_verified !== 2) throw new ApiError('该用户当前不在待审核状态', 400);

    if (action === 'pass') {
      await user.update({ is_verified: 1 });
      await notifService.createNotification({
        userId: id,
        type: notifService.NOTIF_TYPE.SYSTEM,
        title: '校园认证通过',
        content: '恭喜,你的校园认证已通过,可发布和购买商品了~',
        relatedId: id,
      });
      await logAction(req, 'verify_campus_pass', 'user', id, { reason: reason || '' });
      ResponseUtil.success(res, null, '已通过校园认证');
    } else {
      await user.update({ is_verified: 3 }); // 3=未通过
      await notifService.createNotification({
        userId: id,
        type: notifService.NOTIF_TYPE.SYSTEM,
        title: '校园认证未通过',
        content: `原因:${reason || '资料不完整或有误,请重新提交'}`,
        relatedId: id,
      });
      await logAction(req, 'verify_campus_reject', 'user', id, { reason: reason || '' });
      ResponseUtil.success(res, null, '已驳回校园认证');
    }
  } catch (err) { next(err); }
};

/** 管理员后台: 汇总待处理数 (pendingProducts + pendingReports + pendingVerifications)
 *  给管理后台右上角"待办小红点"用; GET /admin/todo-count
 */
exports.todoCount = async (req, res, next) => {
  try {
    const [p, r, v] = await Promise.all([
      Product.count({ where: { status: productService.PRODUCT_STATUS.PENDING } }),
      Report.count({ where: { status: 0 } }),
      User.count({ where: { is_verified: 2 } }),
    ]);
    ResponseUtil.success(res, {
      pendingProducts: p, pendingReports: r, pendingVerifications: v,
      total: p + r + v,
    });
  } catch (err) { next(err); }
};
