/**
 * 学校修改申请控制器
 */
const { SchoolChangeRequest, User } = require('../models');
const ResponseUtil = require('../utils/response');
const { ApiError } = require('../middleware/errorHandler');
const validator = require('../utils/validator');

/**
 * 提交学校修改申请
 */
exports.submitRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newSchool, newCollege, reason } = req.body;

    if (!newSchool || !newSchool.trim()) {
      throw new ApiError('新学校不能为空', 400);
    }

    const user = await User.findByPk(userId);
    if (!user) throw new ApiError('用户不存在', 404);
    if (user.is_verified !== 1) throw new ApiError('请先完成校园认证', 400);

    // 检查是否有待审核的申请
    const pending = await SchoolChangeRequest.findOne({
      where: { user_id: userId, status: 0 }
    });
    if (pending) throw new ApiError('您已有待审核的申请,请勿重复提交', 400);

    const request = await SchoolChangeRequest.create({
      user_id: userId,
      old_school: user.school,
      old_college: user.college,
      new_school: newSchool.trim(),
      new_college: newCollege?.trim() || null,
      reason: reason?.trim() || null,
      status: 0
    });

    ResponseUtil.success(res, request, '申请已提交,等待管理员审核');
  } catch (err) { next(err); }
};

/**
 * 获取我的申请列表
 */
exports.myRequests = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const { rows, count } = await SchoolChangeRequest.findAndCountAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/**
 * 管理员:获取所有申请列表
 */
exports.listRequests = async (req, res, next) => {
  try {
    const { page, pageSize, offset } = validator.parsePaging(req);
    const where = {};
    if (req.query.status !== undefined && req.query.status !== '') {
      where.status = Number(req.query.status);
    }
    if (req.query.keyword) {
      where[require('sequelize').Op.or] = [
        { new_school: { [require('sequelize').Op.like]: `%${req.query.keyword}%` } },
        { new_college: { [require('sequelize').Op.like]: `%${req.query.keyword}%` } }
      ];
    }
    const { rows, count } = await SchoolChangeRequest.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'nickname'] }
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });
    ResponseUtil.paginate(res, rows, count, page, pageSize);
  } catch (err) { next(err); }
};

/**
 * 管理员:审核申请(通过/拒绝)
 */
exports.reviewRequest = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { action, reviewNote } = req.body;
    if (!validator.isPositiveId(id)) throw new ApiError('申请ID非法', 400);
    if (!['approve', 'reject'].includes(action)) throw new ApiError('action参数非法(approve/reject)', 400);

    const request = await SchoolChangeRequest.findByPk(id);
    if (!request) throw new ApiError('申请不存在', 404);
    if (request.status !== 0) throw new ApiError('该申请已审核', 400);

    const status = action === 'approve' ? 1 : 2;
    await request.update({
      status,
      reviewer_id: req.user.id,
      review_note: reviewNote || null,
      reviewed_at: new Date()
    });

    // 如果通过,更新用户学校信息
    if (action === 'approve') {
      const user = await User.findByPk(request.user_id);
      if (user) {
        await user.update({
          school: request.new_school,
          college: request.new_college
        });
      }
    }

    ResponseUtil.success(res, null, action === 'approve' ? '已通过申请' : '已拒绝申请');
  } catch (err) { next(err); }
};

/**
 * 检查用户是否有待审核的学校修改申请
 */
exports.checkPending = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const pending = await SchoolChangeRequest.findOne({
      where: { user_id: userId, status: 0 }
    });
    ResponseUtil.success(res, {
      hasPending: !!pending,
      request: pending
    });
  } catch (err) { next(err); }
};
