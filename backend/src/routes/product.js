/**
 * 商品路由
 */
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth, optionalAuth } = require('../middleware/auth');
const { imageUploadArray } = require('../middleware/upload');

// 分类列表(公开)
router.get('/categories', productController.categories);

// 商品列表(公开)
router.get('/products', optionalAuth, productController.list);

// 我的发布(需登录)
router.get('/user/products', auth, productController.myProducts);

// 商品详情(公开,登录则记录浏览历史)
router.get('/products/:id', optionalAuth, productController.detail);

// 发布商品(需登录,多图上传)
router.post('/products', auth, imageUploadArray(9), productController.create);

// 更新商品(仅作者)
router.put('/products/:id', auth, imageUploadArray(9), productController.update);

// 删除商品(仅作者)
router.delete('/products/:id', auth, productController.remove);

module.exports = router;
