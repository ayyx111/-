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
router.get('/admin/reports', adminController.listReports);
router.put('/admin/reports/:id', adminController.handleReport);
router.get('/admin/stats', adminController.stats);

module.exports = router;
