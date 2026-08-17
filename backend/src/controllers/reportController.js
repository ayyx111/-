/**
 * 举报控制器
 */
const { Report, Product, User } = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const ResponseUtil = require('../utils/response');
const validator = require('../utils/validator');

/** 提交举报 */
exports.create = async (req, res, next) => {
  try {
    const { targetType, targetId, reason, description } = req.body;
    if (![1, 2].includes(Number(targetType))) throw new ApiError('目标类型非法(1商品 2用户)', 400);
    if (!validator.isPositiveId(targetId)) throw new ApiError('目标ID非法', 400);
    if (!reason) throw new ApiError('请填写举报原因', 400);

    // 校验目标存在
    if (Number(targetType) === 1) {
      const p = await Product.findByPk(targetId);
      if (!p) throw new ApiError('被举报商品不存在', 404);
    } else {
      const u = await User.findByPk(targetId);
      if (!u) throw new ApiError('被举报用户不存在', 404);
    }

    const report = await Report.create({
      reporter_id: req.user.id,
      target_type: Number(targetType),
      target_id: targetId,
      reason,
      description: description || null,
      status: 0
    });
    ResponseUtil.created(res, { id: report.id }, '举报已提交,我们将尽快处理');
  } catch (err) { next(err); }
};
