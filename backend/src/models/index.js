/**
 * 模型统一入口
 * - 导入所有模型
 * - 建立关联关系
 */
const sequelize = require('../config/database');

// 导入所有模型
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const ProductImage = require('./ProductImage');
const Order = require('./Order');
const Review = require('./Review');
const Message = require('./Message');
const Favorite = require('./Favorite');
const Report = require('./Report');
const Notification = require('./Notification');
const UserBrowseHistory = require('./UserBrowseHistory');
const AdminLog = require('./AdminLog');
const SchoolChangeRequest = require('./SchoolChangeRequest');

// ============ 关联关系 ============

// 用户 ↔ 商品 (1:N) 发布者
User.hasMany(Product, { foreignKey: 'user_id', as: 'products' });
Product.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 分类 ↔ 商品 (1:N)
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 商品 ↔ 图片 (1:N)
Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 商品 ↔ 订单 (1:N,通常为1:1但保留历史)
Product.hasMany(Order, { foreignKey: 'product_id', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 ↔ 订单(买家/卖家)
User.hasMany(Order, { foreignKey: 'buyer_id', as: 'buyerOrders' });
Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });
User.hasMany(Order, { foreignKey: 'seller_id', as: 'sellerOrders' });
Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// 订单 ↔ 评价 (1:1)
Order.hasMany(Review, { foreignKey: 'order_id', as: 'reviews', onDelete: 'CASCADE' });
Review.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 用户 ↔ 评价(发送/接收)
User.hasMany(Review, { foreignKey: 'from_user_id', as: 'reviewsGiven' });
Review.belongsTo(User, { foreignKey: 'from_user_id', as: 'reviewer' });
User.hasMany(Review, { foreignKey: 'to_user_id', as: 'reviewsReceived' });
Review.belongsTo(User, { foreignKey: 'to_user_id', as: 'reviewee' });

// 用户 ↔ 消息 (发送/接收)
User.hasMany(Message, { foreignKey: 'from_user_id', as: 'messagesSent' });
Message.belongsTo(User, { foreignKey: 'from_user_id', as: 'sender' });
User.hasMany(Message, { foreignKey: 'to_user_id', as: 'messagesReceived' });
Message.belongsTo(User, { foreignKey: 'to_user_id', as: 'receiver' });
// 商品 ↔ 消息(可选关联)
Product.hasMany(Message, { foreignKey: 'product_id', as: 'messages' });
Message.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 ↔ 收藏 (1:N),商品 ↔ 收藏 (1:N)
User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Product.hasMany(Favorite, { foreignKey: 'product_id', as: 'favorites' });
Favorite.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 ↔ 举报(举报人/处理人)
User.hasMany(Report, { foreignKey: 'reporter_id', as: 'reportsMade' });
Report.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' });
User.hasMany(Report, { foreignKey: 'handler_id', as: 'reportsHandled' });
Report.belongsTo(User, { foreignKey: 'handler_id', as: 'handler' });

// 用户 ↔ 通知 (1:N)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 ↔ 浏览记录 (1:N)
User.hasMany(UserBrowseHistory, { foreignKey: 'user_id', as: 'browseHistory' });
UserBrowseHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Product.hasMany(UserBrowseHistory, { foreignKey: 'product_id', as: 'browseHistory', onDelete: 'CASCADE' });
UserBrowseHistory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 ↔ 管理日志 (1:N)
User.hasMany(AdminLog, { foreignKey: 'admin_id', as: 'adminLogs' });
AdminLog.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

// 用户 ↔ 学校修改申请 (1:N)
User.hasMany(SchoolChangeRequest, { foreignKey: 'user_id', as: 'schoolChangeRequests' });
SchoolChangeRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
SchoolChangeRequest.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
  Order,
  Review,
  Message,
  Favorite,
  Report,
  Notification,
  UserBrowseHistory,
  AdminLog,
  SchoolChangeRequest
};
