/**
 * 商品控制器
 */
const productService = require('../services/productService');
const ResponseUtil = require('../utils/response');
const { ApiError } = require('../middleware/errorHandler');
const { resolveUploadUrl } = require('../utils/uploadUrl');

/** 商品列表 */
exports.list = async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.query);
    ResponseUtil.paginate(res, result.list, result.total, result.page, result.pageSize);
  } catch (err) { next(err); }
};

/** 商品详情 */
exports.detail = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const detail = await productService.getProductDetail(Number(req.params.id), userId);
    ResponseUtil.success(res, detail);
  } catch (err) { next(err); }
};

/** 发布商品(多图上传) */
exports.create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    // 从上传的图片中提取URL
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((f) => resolveUploadUrl(f.path));
    } else if (req.body.images) {
      // 兼容直接传图片URL数组的情况
      imageUrls = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    }
    const product = await productService.createProduct(userId, req.body, imageUrls);
    ResponseUtil.created(res, product, '发布成功,等待审核');
  } catch (err) { next(err); }
};

/** 更新商品 */
exports.update = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let imageUrls;
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((f) => resolveUploadUrl(f.path));
    } else if (req.body.images) {
      imageUrls = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    }
    const product = await productService.updateProduct(userId, Number(req.params.id), req.body, imageUrls);
    ResponseUtil.success(res, product, '更新成功');
  } catch (err) { next(err); }
};

/** 删除商品 */
exports.remove = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.user.id, Number(req.params.id));
    ResponseUtil.success(res, null, '删除成功');
  } catch (err) { next(err); }
};

/** 分类列表 */
exports.categories = async (req, res, next) => {
  try {
    const list = await productService.listCategories();
    ResponseUtil.success(res, list);
  } catch (err) { next(err); }
};

/** 我的发布 */
exports.myProducts = async (req, res, next) => {
  try {
    const result = await productService.myProducts(req.user.id, req.query);
    ResponseUtil.paginate(res, result.list, result.total, result.page, result.pageSize);
  } catch (err) { next(err); }
};
