/**
 * 收藏路由
 */
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { auth } = require('../middleware/auth');

router.post('/favorites', auth, favoriteController.add);
router.delete('/favorites/:productId', auth, favoriteController.remove);
router.get('/favorites', auth, favoriteController.list);

module.exports = router;
