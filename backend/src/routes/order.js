/**
 * 订单路由
 */
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth } = require('../middleware/auth');

router.post('/orders', auth, orderController.create);
router.get('/orders', auth, orderController.list);
router.get('/orders/:id', auth, orderController.detail);
router.put('/orders/:id/confirm', auth, orderController.confirm);
router.put('/orders/:id/cancel', auth, orderController.cancel);
router.put('/orders/:id/complete', auth, orderController.complete);
router.post('/orders/:id/review', auth, orderController.review);

module.exports = router;
