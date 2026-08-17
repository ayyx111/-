/**
 * 收藏控制器
 */
const { Favorite, Product } = require('../models');
const { Op } = require('sequelize');
const { ApiError } = require('../middleware/errorHandler');
const ResponseUtil = require('../utils/response');
const validator = require('../utils/validator');

/** 收藏商品 */
exports.add = async (req, res, next) => {
  try {
    const { productId } = req.body;
    if (!validator.isPositiveId(productId)) throw new ApiError('商品ID非法', 400);
    const product = await Product.findByPk(productId);
    if (!product) throw new ApiError('商品不存在', 404);

    const [fav, created] = await Favorite.findOrCreate({
      where: { user_id: req.user.id, product_id: productId },
      defaults: { user_id: req.user.id, product_id: productId }
    });
    if (created) {
      // 收藏数 +1
      await Product.increment('favorite_count', { where: { id: productId } });
    }
    ResponseUtil.success(res, { id: fav.id, favorited: true }, created ? '收藏成功' : '已收藏');
  } catch (err) { next(err); }
};

/** 取消收藏 */
exports.remove = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    if (!validator.isPositiveId(productId)) throw new ApiError('商品ID非法', 400);
    const deleted = await Favorite.destroy({
      where: { user_id: req.user.id, product_id: productId }
    });
    if (deleted > 0) {
      await Product.decrement('favorite_count', {
        where: { id: productId, favorite_count: { [Op.gt]: 0 } }
      });
    }
    ResponseUtil.success(res, { favorited: false }, '已取消收藏');
  } catch (err) { next(err); }
};

/** 收藏列表 */
exports.list = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const { rows, count } = await Favorite.findAndCountAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Product, as: 'product',
          attributes: ['id', 'title', 'price', 'status', 'view_count', 'favorite_count', 'created_at'],
          include: [
            { model: require('../models/ProductImage'), as: 'images', attributes: ['id', 'image_url', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      distinct: true
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};
