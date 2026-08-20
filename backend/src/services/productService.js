/**
 * 商品服务
 */
const { Op } = require('sequelize');
const { Product, ProductImage, Category, User, Order, Review, UserBrowseHistory, Favorite } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');
const { redis, redisKeys } = require('../config/cache');
const aiService = require('./aiService');

// 商品状态
const PRODUCT_STATUS = {
  PENDING: 0, // 待审核
  ON_SALE: 1, // 在售
  LOCKED: 2, // 已锁定
  SOLD: 3, // 已售
  OFF_SHELF: 4, // 已下架
  REJECTED: 5 // 审核拒绝
};

/**
 * 商品列表查询(分页/分类/搜索/价格筛选/排序)
 */
async function listProducts(query) {
  const { page, pageSize, offset } = validator.parsePaging({ query });
  const where = { status: PRODUCT_STATUS.ON_SALE };

  // 分类筛选
  if (query.categoryId) {
    where.category_id = Number(query.categoryId);
  }

  // 关键词搜索(标题/描述)
  if (query.keyword) {
    where[Op.or] = [
      { title: { [Op.like]: `%${query.keyword}%` } },
      { description: { [Op.like]: `%${query.keyword}%` } }
    ];
  }

  // 价格区间
  if (query.minPrice !== undefined && query.minPrice !== '') {
    where.price = { ...where.price, [Op.gte]: Number(query.minPrice) };
  }
  if (query.maxPrice !== undefined && query.maxPrice !== '') {
    where.price = { ...where.price, [Op.le]: Number(query.maxPrice) };
  }

  // 新旧程度
  if (query.conditionLevel) {
    where.condition_level = Number(query.conditionLevel);
  }

  // 排序
  const order = [];
  switch (query.sort) {
    case 'price_asc': order.push(['price', 'ASC']); break;
    case 'price_desc': order.push(['price', 'DESC']); break;
    case 'view': order.push(['view_count', 'DESC']); break;
    case 'favorite': order.push(['favorite_count', 'DESC']); break;
    default: order.push(['created_at', 'DESC']); // 最新
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'avatar', 'nickname'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }
    ],
    distinct: true,
    order,
    limit: pageSize,
    offset
  });

  return { list: rows, total: count, page, pageSize };
}

/**
 * 商品详情(记录浏览历史、增加浏览量)
 */
async function getProductDetail(id, userId) {
  if (!validator.isPositiveId(id)) throw new ApiError('商品ID非法', 400);
  const product = await Product.findByPk(id, {
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'avatar', 'nickname', 'school', 'college', 'is_verified', 'credit_score'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], order: [['sort_order', 'ASC']] }
    ]
  });
  if (!product) throw new ApiError('商品不存在', 404);

  // 浏览量自增(防刷:同一用户10分钟内仅计一次)
  if (userId) {
    const viewKey = redisKeys.viewProduct(id, userId);
    const first = await redis.set(viewKey, '1', 'EX', 600, 'NX');
    if (first) {
      await Product.increment('view_count', { where: { id } });
      // 记录浏览历史
      await UserBrowseHistory.create({
        user_id: userId,
        product_id: id,
        category_id: product.category_id
      }).catch(() => {}); // 忽略历史记录写入异常
    }
  } else {
    await Product.increment('view_count', { where: { id } });
  }

  // 是否被当前用户收藏
  let isFavorited = false;
  if (userId) {
    const fav = await Favorite.findOne({ where: { user_id: userId, product_id: id } });
    isFavorited = !!fav;
  }

  const result = product.toJSON();
  result.is_favorited = isFavorited;
  // 前端 ProductDetail.vue 读的是 res.isFavorited(camelCase),这里同时写 camel 别名,
  // 避免返回只有 snake 的 is_favorited,前端永远是 false→"收藏过的商品仍显示『收藏』"。
  result.isFavorited = isFavorited;

  // 该商品已成交订单上的买家评价(买家对卖家售卖商品的评价),供商品详情页下展示
  const ordersForProduct = await Order.findAll({
    where: { product_id: id, status: 3 }, // 已完成订单
    attributes: ['id'],
    include: [
      {
        model: Review,
        as: 'reviews',
        where: { reviewer_role: 1 }, // 仅买家评价
        required: false,
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'username', 'avatar', 'nickname'] }]
      }
    ]
  });
  const productReviews = (ordersForProduct || []).flatMap((o) => (o.reviews || []).map((r) => r.toJSON()));
  result.reviews = productReviews;
  return result;
}

/**
 * 发布商品(事务:写商品+图片)
 * 图片为已上传返回的URL数组
 */
async function createProduct(userId, data, imageUrls = []) {
  // 校验
  if (!data.title || data.title.length > 100) throw new ApiError('标题不能为空且不超过100字', 400);
  if (!data.description) throw new ApiError('描述不能为空', 400);
  if (!validator.isPrice(data.price)) throw new ApiError('售价格式不正确', 400);
  if (data.originalPrice !== undefined && data.originalPrice !== '' && !validator.isPrice(data.originalPrice)) {
    throw new ApiError('原价格式不正确', 400);
  }
  if (![1, 2, 3, 4].includes(Number(data.conditionLevel))) throw new ApiError('新旧程度非法', 400);
  if (![1, 2, 3].includes(Number(data.tradeType))) throw new ApiError('交易方式非法', 400);
  if (!data.categoryId) throw new ApiError('请选择分类', 400);

  // 分类存在性
  const category = await Category.findByPk(Number(data.categoryId));
  if (!category) throw new ApiError('分类不存在', 400);

  if (!imageUrls || imageUrls.length === 0) throw new ApiError('请至少上传一张商品图片', 400);
  if (imageUrls.length > 9) throw new ApiError('最多上传9张图片', 400);

  const product = await Product.create({
    user_id: userId,
    category_id: Number(data.categoryId),
    title: data.title,
    description: data.description,
    original_price: data.originalPrice || null,
    price: data.price,
    condition_level: Number(data.conditionLevel),
    trade_type: Number(data.tradeType),
    location: data.location || null,
    status: PRODUCT_STATUS.PENDING, // 创建时先置为待审核,AI 审核后再决定
    ai_review_result: null
  });

  // 批量写入图片
  const images = imageUrls.map((url, idx) => ({
    product_id: product.id,
    image_url: url,
    sort_order: idx
  }));
  await ProductImage.bulkCreate(images);

  // 调用 AI 自动审核,根据结果更新商品状态
  await applyAiReview(product, { title: product.title, description: product.description, price: parseFloat(product.price) });

  return product;
}

/**
 * 调用 AI 审核并更新商品状态
 * - pass       → status=1 在售(直接上架)
 * - suspicious → status=0 待人工复审
 * - reject     → status=5 审核拒绝
 * AI 服务不可用时降级为 pass
 */
async function applyAiReview(product, { title, description, price }) {
  try {
    const { result, reason } = await aiService.reviewProduct(title, description, price);
    const { aiReviewResult, newStatus } = aiService.mapAiResultToStatus(result);
    await product.update({
      ai_review_result: aiReviewResult,
      ai_review_reason: reason,
      ai_reviewed_at: new Date(),
      status: newStatus
    });
    console.log(`[AI审核] 商品 #${product.id} "${title}" → ${result} (status=${newStatus})`);
    return { result, reason, newStatus };
  } catch (err) {
    console.error('[AI审核] 调用异常,默认放行:', err.message);
    await product.update({ status: PRODUCT_STATUS.ON_SALE, ai_review_result: 0, ai_review_reason: 'AI 审核异常,已放行待人工复核', ai_reviewed_at: new Date() });
    return { result: 'pass', reason: err.message, newStatus: PRODUCT_STATUS.ON_SALE };
  }
}

/**
 * 更新商品(仅作者)
 */
async function updateProduct(userId, id, data, imageUrls) {
  const product = await Product.findByPk(id);
  if (!product) throw new ApiError('商品不存在', 404);
  if (product.user_id !== userId) throw new ApiError('无权操作他人商品', 403);
  if (product.status === PRODUCT_STATUS.SOLD) throw new ApiError('已售商品不可修改', 400);

  const update = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.originalPrice !== undefined) update.original_price = data.originalPrice || null;
  if (data.price !== undefined) {
    if (!validator.isPrice(data.price)) throw new ApiError('售价格式不正确', 400);
    update.price = data.price;
  }
  if (data.conditionLevel !== undefined) update.condition_level = Number(data.conditionLevel);
  if (data.tradeType !== undefined) update.trade_type = Number(data.tradeType);
  if (data.location !== undefined) update.location = data.location;
  if (data.categoryId !== undefined) {
    const cat = await Category.findByPk(Number(data.categoryId));
    if (!cat) throw new ApiError('分类不存在', 400);
    update.category_id = Number(data.categoryId);
  }

  // 更新后重新进入待审核
  update.status = PRODUCT_STATUS.PENDING;
  update.ai_review_result = null;
  update.ai_review_reason = null;

  await product.update(update);

  // 若传入新图片,则替换旧图
  if (imageUrls && imageUrls.length > 0) {
    if (imageUrls.length > 9) throw new ApiError('最多上传9张图片', 400);
    await ProductImage.destroy({ where: { product_id: id } });
    const images = imageUrls.map((url, idx) => ({
      product_id: id,
      image_url: url,
      sort_order: idx
    }));
    await ProductImage.bulkCreate(images);
  }

  // 重新调用 AI 审核
  await applyAiReview(product, { title: product.title, description: product.description, price: parseFloat(product.price) });

  return product;
}

/**
 * 删除商品(仅作者)
 */
async function deleteProduct(userId, id) {
  const product = await Product.findByPk(id);
  if (!product) throw new ApiError('商品不存在', 404);
  if (product.user_id !== userId) throw new ApiError('无权操作他人商品', 403);
  // 软删除?此处采用真实删除并级联图片
  await product.destroy();
  return true;
}

/**
 * 我的发布
 */
async function myProducts(userId, query) {
  const { page, pageSize, offset } = validator.parsePaging({ query });
  const where = { user_id: userId };
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }
  const { rows, count } = await Product.findAndCountAll({
    where,
    include: [
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: ProductImage, as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }
    ],
    distinct: true,
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset
  });
  return { list: rows, total: count, page, pageSize };
}

/**
 * 分类列表
 */
async function listCategories() {
  return Category.findAll({
    order: [['sort_order', 'ASC'], ['id', 'ASC']]
  });
}

module.exports = {
  PRODUCT_STATUS,
  listProducts,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  myProducts,
  listCategories,
  applyAiReview
};
