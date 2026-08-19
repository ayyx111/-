/**
 * 订单路由
 */
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth } = require('../middleware/auth');

// 注意: index.js 挂在 '/orders'(router.use('/orders', require('./order'))),
// 所以这里子路由直接挂根路径,避免变成 /orders/orders(前端调用 /orders POST 会 404 "资源不存在").
router.post('/', auth, orderController.create);
router.get('/', auth, orderController.list);
router.get('/:id', auth, orderController.detail);
router.put('/:id/confirm', auth, orderController.confirm);
router.put('/:id/cancel', auth, orderController.cancel);
router.put('/:id/complete', auth, orderController.complete);
router.post('/:id/review', auth, orderController.review);

module.exports = router;
