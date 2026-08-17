/**
 * 举报路由
 */
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

router.post('/reports', auth, reportController.create);

module.exports = router;
