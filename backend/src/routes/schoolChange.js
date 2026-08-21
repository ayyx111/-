/**
 * 学校修改申请路由
 */
const express = require('express');
const router = express.Router();
const schoolChangeController = require('../controllers/schoolChangeController');
const { auth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permission');

// 用户端路由(需登录)
router.use(auth);
router.post('/school-change-requests', schoolChangeController.submitRequest);
router.get('/school-change-requests/mine', schoolChangeController.myRequests);
router.get('/school-change-requests/pending', schoolChangeController.checkPending);

// 管理员路由(需管理员权限)
router.get('/admin/school-change-requests', requireAdmin, schoolChangeController.listRequests);
router.put('/admin/school-change-requests/:id/review', requireAdmin, schoolChangeController.reviewRequest);

module.exports = router;
