/**
 * 管理后台路由(需 role=1)
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permission');

// 全部接口需登录 + 管理员权限
router.use(auth, requireAdmin);

router.get('/admin/products/pending', adminController.pendingProducts);
router.put('/admin/products/:id/review', adminController.reviewProduct);
router.post('/admin/products/:id/ai-review', adminController.reReviewByAi);
router.get('/admin/users', adminController.listUsers);
router.put('/admin/users/:id/status', adminController.updateUserStatus);
// 校园认证审核: 列表 + pass/reject; verifyStatus 过滤默认 2(待审核)
router.get('/admin/verifications', adminController.listVerifications);
router.put('/admin/users/:id/verify', adminController.reviewVerification);
// 管理员待办汇总 (商品审核+举报+认证待审)
router.get('/admin/todo-count', adminController.todoCount);

router.get('/admin/reports', adminController.listReports);
router.put('/admin/reports/:id', adminController.handleReport);
router.get('/admin/stats', adminController.stats);

module.exports = router;
