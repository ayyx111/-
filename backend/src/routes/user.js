/**
 * 用户路由
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');

router.get('/profile', auth, userController.getProfile);
router.get('/:id/profile', userController.getPublicProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/password', auth, userController.changePassword);
router.put('/email', auth, userController.changeEmail);

module.exports = router;
